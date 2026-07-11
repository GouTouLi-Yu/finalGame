import { Animation, AnimationClip, instantiate, Node, Prefab } from 'cc';
import { BattleAnimCatalog, EBattleAnimAction, TBattleAnimRootType } from '../../../anim/BattleAnimCatalog';
import { BattleAnimIdResolver } from '../../../anim/BattleAnimIdResolver';
import { BattleAnimLoadScheduler } from '../../../anim/BattleAnimLoadScheduler';
import { AnimQualityService } from '../../../anim/AnimQualityService';
import { EBundleType, ResManager } from '../../../manager/ResManager';
import { BattleFieldModel } from '../model/battle/BattleFieldModel';
import { EBattleSide } from '../model/battle/BattleEnums';

const ONE_SHOT_ACTIONS: ReadonlySet<EBattleAnimAction> = new Set([
    EBattleAnimAction.PrepStart,
    EBattleAnimAction.PrepBack,
    EBattleAnimAction.UsingMagic,
    EBattleAnimAction.Hurt,
    EBattleAnimAction.Die,
]);

/** 友方拖牌/出牌常用动作，开战预载 */
const ALLY_PRELOAD_ACTIONS: readonly EBattleAnimAction[] = [
    EBattleAnimAction.Idle,
    EBattleAnimAction.Hurt,
    EBattleAnimAction.PrepStart,
    EBattleAnimAction.PrepIdle,
    EBattleAnimAction.PrepBack,
    EBattleAnimAction.UsingMagic,
];

/**
 * 战场单位动画。
 * - 缓存命中时同步切换（避免 await 被松手 cancel）
 * - 开战预挂各动作节点；战斗中只显隐切换，尽量不再 addChild
 * - 绝不 removeFromParent/destroy（否则会弄脏 UI 兄弟列表）
 */
export class BattleUnitAnimPlayer {
    private _viewRoot: Node | null = null;
    private _field: BattleFieldModel | null = null;
    private _playGen = new Map<string, number>();
    private _prefabCache = new Map<string, Prefab>();

    bind(viewRoot: Node, field: BattleFieldModel | null): void {
        this._viewRoot = viewRoot;
        this._field = field;
        this._playGen.clear();
    }

    async preloadAllyBattleAnims(): Promise<void> {
        const field = this._field;
        if (field == null) {
            return;
        }
        let ok = 0;
        let fail = 0;
        const seen = new Set<string>();
        for (const unit of field.units.values()) {
            if (unit.side !== EBattleSide.Ally) {
                continue;
            }
            const animPath = BattleAnimIdResolver.resolveAnimPath('character', unit.unitId);
            for (const action of ALLY_PRELOAD_ACTIONS) {
                const path = BattleAnimCatalog.prefabPath('character', animPath, action);
                if (seen.has(path)) {
                    continue;
                }
                seen.add(path);
                const synced = this.syncResolvePrefab('character', animPath, action, path);
                if (synced != null) {
                    ok += 1;
                    continue;
                }
                const loaded = await this.cachePrefabByPath(path);
                if (loaded != null) {
                    ok += 1;
                } else {
                    fail += 1;
                }
            }
        }
        // 资源就绪后预挂到槽位（inactive），拖牌时只切显隐
        let mounted = 0;
        for (const unit of field.units.values()) {
            if (unit.side !== EBattleSide.Ally) {
                continue;
            }
            for (const action of ALLY_PRELOAD_ACTIONS) {
                if (this.ensureMountedNode(unit.unitId, action, false) != null) {
                    mounted += 1;
                }
            }
        }
        console.log(
            `[战场动画] 预载完成 ok=${ok} fail=${fail} mounted=${mounted}（本地缓存 ${this._prefabCache.size}）`,
        );
    }

    playIdleAll(): Promise<void> {
        const field = this._field;
        if (field == null) {
            return Promise.resolve();
        }
        for (const unit of field.units.values()) {
            this.play(unit.unitId, EBattleAnimAction.Idle);
        }
        AnimQualityService.refreshAll();
        return Promise.resolve();
    }

    cancel(unitId: string): void {
        this.bumpGen(unitId);
    }

    play(unitId: string, action: EBattleAnimAction): Promise<boolean> {
        const gen = this.bumpGen(unitId);
        const dur = this.tryMountSync(unitId, action, gen);
        if (dur != null) {
            return Promise.resolve(true);
        }
        return this.mountAfterLoad(unitId, action, gen).then((d) => d != null);
    }

    playThen(unitId: string, first: EBattleAnimAction, second: EBattleAnimAction): Promise<boolean> {
        const gen = this.bumpGen(unitId);
        const dur = this.tryMountSync(unitId, first, gen);
        if (dur != null) {
            return this.delaySeconds(dur + 0.02).then(() => {
                if (!this.isCurrentGen(unitId, gen)) {
                    console.log(`[战场动画] 链被取消（${first} 之后）unit=${unitId}`);
                    return false;
                }
                const d2 = this.tryMountSync(unitId, second, gen);
                if (d2 != null) {
                    return true;
                }
                return this.mountAfterLoad(unitId, second, gen).then((d) => d != null);
            });
        }

        console.warn(
            `[战场动画] ${first} 未同步命中缓存，改为异步加载 unit=${unitId} `
            + this.debugCacheHint(unitId, first),
        );
        return this.mountAfterLoad(unitId, first, gen).then(async (d1) => {
            if (d1 == null || !this.isCurrentGen(unitId, gen)) {
                console.warn(`[战场动画] 链中断（未挂上 ${first}）unit=${unitId}`);
                return false;
            }
            await this.delaySeconds(d1 + 0.02);
            if (!this.isCurrentGen(unitId, gen)) {
                console.log(`[战场动画] 链被取消（${first} 之后）unit=${unitId}`);
                return false;
            }
            const d2 = this.tryMountSync(unitId, second, gen);
            if (d2 != null) {
                return true;
            }
            const loaded = await this.mountAfterLoad(unitId, second, gen);
            if (loaded == null) {
                console.warn(`[战场动画] 链中断（未挂上 ${second}）unit=${unitId}`);
            }
            return loaded != null;
        });
    }

    private bumpGen(unitId: string): number {
        const next = (this._playGen.get(unitId) ?? 0) + 1;
        this._playGen.set(unitId, next);
        return next;
    }

    private isCurrentGen(unitId: string, gen: number): boolean {
        return this._playGen.get(unitId) === gen;
    }

    private tryMountSync(unitId: string, action: EBattleAnimAction, gen: number): number | null {
        if (!this.isCurrentGen(unitId, gen)) {
            console.log(`[战场动画] skip ${action}（gen 过期）unit=${unitId}`);
            return null;
        }
        const ctx = this.resolveSlot(unitId);
        if (ctx == null) {
            return null;
        }
        const path = BattleAnimCatalog.prefabPath(ctx.rootType, ctx.animPath, action);
        const prefab = this.syncResolvePrefab(ctx.rootType, ctx.animPath, action, path);
        if (prefab == null) {
            return null;
        }
        try {
            const dur = this.mountPrefab(ctx.slotParent, prefab, action);
            console.log(
                `[战场动画] ✓ ${ctx.parentName} ← ${action} `
                + `dur=${dur.toFixed(2)} oneShot=${ONE_SHOT_ACTIONS.has(action)} path=${path}`,
            );
            return dur;
        } catch (e) {
            console.error(`[战场动画] mount 异常 ${path}`, e);
            return null;
        }
    }

    private async mountAfterLoad(
        unitId: string,
        action: EBattleAnimAction,
        gen: number,
    ): Promise<number | null> {
        if (!this.isCurrentGen(unitId, gen)) {
            return null;
        }
        const ctx = this.resolveSlot(unitId);
        if (ctx == null) {
            return null;
        }
        const path = BattleAnimCatalog.prefabPath(ctx.rootType, ctx.animPath, action);
        const prefab = await this.cachePrefabByPath(path);
        if (prefab == null) {
            console.warn(`[战场动画] 加载失败 ${path}`);
            return null;
        }
        if (!this.isCurrentGen(unitId, gen)) {
            console.log(`[战场动画] skip ${action}（加载后 gen 过期）unit=${unitId}`);
            return null;
        }
        return this.tryMountSync(unitId, action, gen);
    }

    private syncResolvePrefab(
        rootType: TBattleAnimRootType,
        animPath: string,
        action: EBattleAnimAction,
        path: string,
    ): Prefab | null {
        let prefab = this._prefabCache.get(path) ?? null;
        if (prefab == null) {
            prefab = BattleAnimLoadScheduler.getPrefab(rootType, animPath, action);
        }
        if (prefab == null) {
            prefab = ResManager.peekAsset(EBundleType.ANIM, path, Prefab);
        }
        if (prefab != null && prefab.isValid) {
            this._prefabCache.set(path, prefab);
            return prefab;
        }
        return null;
    }

    private debugCacheHint(unitId: string, action: EBattleAnimAction): string {
        const ctx = this.resolveSlot(unitId);
        if (ctx == null) {
            return '(无挂点)';
        }
        const path = BattleAnimCatalog.prefabPath(ctx.rootType, ctx.animPath, action);
        const local = this._prefabCache.has(path);
        const sched = BattleAnimLoadScheduler.has(ctx.rootType, ctx.animPath, action);
        const res = ResManager.peekAsset(EBundleType.ANIM, path, Prefab) != null;
        return `path=${path} local=${local} sched=${sched} res=${res}`;
    }

    private resolveSlot(unitId: string): {
        rootType: TBattleAnimRootType;
        animPath: string;
        parentName: string;
        slotParent: Node;
    } | null {
        const field = this._field;
        const viewRoot = this._viewRoot;
        if (field == null || viewRoot == null) {
            console.warn('[战场动画] view/field 未绑定');
            return null;
        }
        const unit = field.getUnit(unitId);
        if (unit == null) {
            console.warn(`[战场动画] 无单位 ${unitId}`);
            return null;
        }
        const rootType: TBattleAnimRootType = unit.side === EBattleSide.Ally ? 'character' : 'enemy';
        const animPath = BattleAnimIdResolver.resolveAnimPath(rootType, unitId);
        const parentName = unit.side === EBattleSide.Ally
            ? `character${unit.slotIndex + 1}`
            : `enemy${unit.slotIndex + 1}`;
        const slotParent = viewRoot.getChildByName('anim')?.getChildByName(parentName) ?? null;
        if (slotParent == null) {
            console.warn(`[战场动画] 未找到挂点 anim/${parentName}`);
            return null;
        }
        return { rootType, animPath, parentName, slotParent };
    }

    private mountPrefab(slotParent: Node, prefab: Prefab, action: EBattleAnimAction): number {
        const nodeName = `anim__${action}`;

        // 只隐藏，不摘树、不销毁
        for (const child of slotParent.children) {
            if (child == null || !child.isValid) {
                continue;
            }
            if (child.name === 'touchLayer') {
                continue;
            }
            if (child.name === nodeName) {
                continue;
            }
            child.active = false;
            child.getComponent(Animation)?.stop();
        }

        let node = slotParent.getChildByName(nodeName);
        if (node != null && !node.isValid) {
            node = null;
        }
        if (node == null) {
            node = instantiate(prefab);
            node.name = nodeName;
            node.layer = slotParent.layer;
            node.setPosition(0, 0, 0);
            slotParent.addChild(node);
        }
        node.active = true;

        const animation = node.getComponent(Animation);
        const clip = animation?.defaultClip
            ?? animation?.clips.find((c) => c != null)
            ?? null;
        const oneShot = ONE_SHOT_ACTIONS.has(action);
        const dur = Math.max(0.1, Number(clip?.duration) || 0.5);

        if (clip != null) {
            clip.wrapMode = oneShot
                ? AnimationClip.WrapMode.Normal
                : AnimationClip.WrapMode.Loop;
        }
        if (animation != null) {
            animation.playOnLoad = false;
            if (clip != null) {
                animation.stop();
                animation.defaultClip = clip;
                animation.play(clip.name);
                const state = animation.getState(clip.name);
                if (state != null) {
                    state.wrapMode = oneShot
                        ? AnimationClip.WrapMode.Normal
                        : AnimationClip.WrapMode.Loop;
                    if (oneShot) {
                        state.repeatCount = 1;
                    }
                    state.time = 0;
                    state.speed = 1;
                }
            }
        }

        return dur;
    }

    /** 预挂或取回动作节点；active=false 时只确保在树上 */
    private ensureMountedNode(
        unitId: string,
        action: EBattleAnimAction,
        playNow: boolean,
    ): Node | null {
        const ctx = this.resolveSlot(unitId);
        if (ctx == null) {
            return null;
        }
        const path = BattleAnimCatalog.prefabPath(ctx.rootType, ctx.animPath, action);
        const prefab = this.syncResolvePrefab(ctx.rootType, ctx.animPath, action, path);
        if (prefab == null) {
            return null;
        }
        if (playNow) {
            this.mountPrefab(ctx.slotParent, prefab, action);
            return ctx.slotParent.getChildByName(`anim__${action}`);
        }

        const nodeName = `anim__${action}`;
        let node = ctx.slotParent.getChildByName(nodeName);
        if (node != null && !node.isValid) {
            node = null;
        }
        if (node == null) {
            node = instantiate(prefab);
            node.name = nodeName;
            node.layer = ctx.slotParent.layer;
            node.setPosition(0, 0, 0);
            node.active = false;
            const animation = node.getComponent(Animation);
            if (animation != null) {
                animation.playOnLoad = false;
                animation.stop();
            }
            ctx.slotParent.addChild(node);
        } else {
            node.active = false;
            node.getComponent(Animation)?.stop();
        }
        return node;
    }

    private delaySeconds(sec: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, Math.max(16, Math.ceil(sec * 1000)));
        });
    }

    private async cachePrefabByPath(path: string): Promise<Prefab | null> {
        const hit = this._prefabCache.get(path);
        if (hit != null && hit.isValid) {
            return hit;
        }
        const peeked = ResManager.peekAsset(EBundleType.ANIM, path, Prefab);
        if (peeked != null && peeked.isValid) {
            this._prefabCache.set(path, peeked);
            return peeked;
        }
        try {
            const prefab = await ResManager.loadAsset(EBundleType.ANIM, path, Prefab);
            this._prefabCache.set(path, prefab);
            return prefab;
        } catch (e) {
            console.warn(`[战场动画] 加载失败 ${path}`, e);
            return null;
        }
    }
}
