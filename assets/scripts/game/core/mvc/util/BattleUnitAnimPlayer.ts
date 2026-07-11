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

/** 友方开战预挂：idle/hurt + prep 全套 + usingMagic（冒险遇战时应已在调度器缓存） */
const ALLY_PRELOAD_ACTIONS: readonly EBattleAnimAction[] = [
    ...BattleAnimCatalog.HOT_ACTIONS,
    ...BattleAnimCatalog.WARM_ACTIONS,
];

interface ISlotCtx {
    rootType: TBattleAnimRootType;
    animPath: string;
    parentName: string;
    slotParent: Node;
}

/**
 * 战场单位动画：每动作一个子节点 `anim__{action}`，战斗中只切显隐。
 *
 * 约束（踩坑总结）：
 * 1. 播放路径必须能同步完成（预载 + 本地/调度器/ResManager 三层缓存），
 *    否则松手 bumpGen 会取消尚未 await 完的挂载。
 * 2. 战斗中禁止 removeFromParent / destroy 动画节点，
 *    否则同帧 UITransform 兄弟排序会读到空引用。
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

    /** 预载 prefab 并预挂友方动作节点（inactive） */
    async preloadAllyBattleAnims(): Promise<void> {
        const field = this._field;
        if (field == null) {
            return;
        }

        const paths = new Map<string, { rootType: TBattleAnimRootType; animPath: string; action: EBattleAnimAction }>();
        for (const unit of field.units.values()) {
            if (unit.side !== EBattleSide.Ally) {
                continue;
            }
            const animPath = BattleAnimIdResolver.resolveAnimPath('character', unit.unitId);
            for (const action of ALLY_PRELOAD_ACTIONS) {
                const path = BattleAnimCatalog.prefabPath('character', animPath, action);
                if (!paths.has(path)) {
                    paths.set(path, { rootType: 'character', animPath, action });
                }
            }
        }

        let ok = 0;
        let fail = 0;
        for (const [path, meta] of paths) {
            const hit = this.resolvePrefab(meta.rootType, meta.animPath, meta.action, path)
                ?? await this.loadPrefab(path);
            if (hit != null) {
                ok += 1;
            } else {
                fail += 1;
            }
        }

        let mounted = 0;
        for (const unit of field.units.values()) {
            if (unit.side !== EBattleSide.Ally) {
                continue;
            }
            for (const action of ALLY_PRELOAD_ACTIONS) {
                if (this.ensureNode(unit.unitId, action, false) != null) {
                    mounted += 1;
                }
            }
        }
        console.log(`[战场动画] 预载 ok=${ok} fail=${fail} mounted=${mounted}`);
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
        if (this.playSync(unitId, action, gen) != null) {
            return Promise.resolve(true);
        }
        return this.playAsync(unitId, action, gen).then((d) => d != null);
    }

    playThen(unitId: string, first: EBattleAnimAction, second: EBattleAnimAction): Promise<boolean> {
        const gen = this.bumpGen(unitId);
        const runSecond = async (okFirst: boolean): Promise<boolean> => {
            if (!okFirst || !this.isCurrentGen(unitId, gen)) {
                return false;
            }
            const d2 = this.playSync(unitId, second, gen) ?? await this.playAsync(unitId, second, gen);
            return d2 != null;
        };

        const d1 = this.playSync(unitId, first, gen);
        if (d1 != null) {
            return this.delaySeconds(d1 + 0.02).then(() => runSecond(this.isCurrentGen(unitId, gen)));
        }
        return this.playAsync(unitId, first, gen).then(async (d) => {
            if (d == null || !this.isCurrentGen(unitId, gen)) {
                return false;
            }
            await this.delaySeconds(d + 0.02);
            return runSecond(this.isCurrentGen(unitId, gen));
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

    /** 同步播放；资源未就绪返回 null */
    private playSync(unitId: string, action: EBattleAnimAction, gen: number): number | null {
        if (!this.isCurrentGen(unitId, gen)) {
            return null;
        }
        const node = this.ensureNode(unitId, action, true);
        if (node == null) {
            return null;
        }
        const ctx = this.resolveSlot(unitId);
        if (ctx != null) {
            console.log(`[战场动画] ✓ ${ctx.parentName} ← ${action}`);
        }
        return this.readDuration(node, action);
    }

    private async playAsync(
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
        const prefab = await this.loadPrefab(path);
        if (prefab == null || !this.isCurrentGen(unitId, gen)) {
            return null;
        }
        return this.playSync(unitId, action, gen);
    }

    /**
     * 确保槽位上有该动作节点。
     * @param activate true=隐藏其它动作并播放；false=仅预挂为 inactive
     */
    private ensureNode(unitId: string, action: EBattleAnimAction, activate: boolean): Node | null {
        const ctx = this.resolveSlot(unitId);
        if (ctx == null) {
            return null;
        }
        const path = BattleAnimCatalog.prefabPath(ctx.rootType, ctx.animPath, action);
        const prefab = this.resolvePrefab(ctx.rootType, ctx.animPath, action, path);
        if (prefab == null) {
            return null;
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
            const animation = node.getComponent(Animation);
            if (animation != null) {
                animation.playOnLoad = false;
            }
            ctx.slotParent.addChild(node);
        }

        if (!activate) {
            node.active = false;
            node.getComponent(Animation)?.stop();
            return node;
        }

        this.hideOtherAnims(ctx.slotParent, nodeName);
        node.active = true;
        this.playClipOn(node, action);
        return node;
    }

    private hideOtherAnims(slotParent: Node, keepName: string): void {
        for (const child of slotParent.children) {
            if (child == null || !child.isValid || child.name === 'touchLayer' || child.name === keepName) {
                continue;
            }
            // 编辑器嵌套的默认 idle 等也一并藏起
            child.active = false;
            child.getComponent(Animation)?.stop();
        }
    }

    private playClipOn(node: Node, action: EBattleAnimAction): void {
        const animation = node.getComponent(Animation);
        const clip = animation?.defaultClip
            ?? animation?.clips.find((c) => c != null)
            ?? null;
        if (animation == null || clip == null) {
            return;
        }
        const oneShot = ONE_SHOT_ACTIONS.has(action);
        clip.wrapMode = oneShot ? AnimationClip.WrapMode.Normal : AnimationClip.WrapMode.Loop;
        animation.playOnLoad = false;
        animation.stop();
        animation.defaultClip = clip;
        animation.play(clip.name);
        const state = animation.getState(clip.name);
        if (state != null) {
            state.wrapMode = oneShot ? AnimationClip.WrapMode.Normal : AnimationClip.WrapMode.Loop;
            if (oneShot) {
                state.repeatCount = 1;
            }
            state.time = 0;
            state.speed = 1;
        }
    }

    private readDuration(node: Node, action: EBattleAnimAction): number {
        const animation = node.getComponent(Animation);
        const clip = animation?.defaultClip
            ?? animation?.clips.find((c) => c != null)
            ?? null;
        return Math.max(0.1, Number(clip?.duration) || (ONE_SHOT_ACTIONS.has(action) ? 0.5 : 1));
    }

    private resolvePrefab(
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

    private async loadPrefab(path: string): Promise<Prefab | null> {
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

    private resolveSlot(unitId: string): ISlotCtx | null {
        const field = this._field;
        const viewRoot = this._viewRoot;
        if (field == null || viewRoot == null) {
            return null;
        }
        const unit = field.getUnit(unitId);
        if (unit == null) {
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

    private delaySeconds(sec: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, Math.max(16, Math.ceil(sec * 1000)));
        });
    }
}
