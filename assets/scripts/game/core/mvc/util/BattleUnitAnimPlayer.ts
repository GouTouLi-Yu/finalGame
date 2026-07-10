import { Animation, instantiate, Node, Prefab } from 'cc';
import { BattleAnimCatalog, EBattleAnimAction, TBattleAnimRootType } from '../../../anim/BattleAnimCatalog';
import { BattleAnimIdResolver } from '../../../anim/BattleAnimIdResolver';
import { BattleAnimLoadScheduler } from '../../../anim/BattleAnimLoadScheduler';
import { AnimQualityService } from '../../../anim/AnimQualityService';
import { EBundleType, ResManager } from '../../../manager/ResManager';
import { BattleFieldModel } from '../model/battle/BattleFieldModel';
import { EBattleSide } from '../model/battle/BattleEnums';

/**
 * 战场单位动画播放：在 anim/characterN|enemyN 下挂载动作 prefab（子节点名 anim）。
 * idle 等资源 playOnLoad=true，挂上即播；并刷新画质档。
 */
export class BattleUnitAnimPlayer {
    private _viewRoot: Node | null = null;
    private _field: BattleFieldModel | null = null;

    bind(viewRoot: Node, field: BattleFieldModel | null): void {
        this._viewRoot = viewRoot;
        this._field = field;
    }

    /** 场上所有单位播待机 */
    async playIdleAll(): Promise<void> {
        const field = this._field;
        if (field == null) {
            return;
        }
        const tasks: Promise<boolean>[] = [];
        for (const unit of field.units.values()) {
            tasks.push(this.play(unit.unitId, EBattleAnimAction.Idle));
        }
        await Promise.all(tasks);
        AnimQualityService.refreshAll();
    }

    async play(unitId: string, action: EBattleAnimAction): Promise<boolean> {
        const field = this._field;
        const viewRoot = this._viewRoot;
        if (field == null || viewRoot == null) {
            return false;
        }
        const unit = field.getUnit(unitId);
        if (unit == null) {
            console.warn(`[战场动画] 无单位 ${unitId}`);
            return false;
        }

        const rootType: TBattleAnimRootType = unit.side === EBattleSide.Ally ? 'character' : 'enemy';
        const animPath = BattleAnimIdResolver.resolveAnimPath(rootType, unitId);
        const parentName = unit.side === EBattleSide.Ally
            ? `character${unit.slotIndex + 1}`
            : `enemy${unit.slotIndex + 1}`;

        const animRoot = viewRoot.getChildByName('anim');
        const slotParent = animRoot?.getChildByName(parentName) ?? null;
        if (slotParent == null) {
            console.warn(`[战场动画] 未找到挂点 anim/${parentName}`);
            return false;
        }

        const prefab = await this.loadPrefab(rootType, animPath, action);
        if (prefab == null) {
            return false;
        }

        this.replaceAnimNode(slotParent, prefab);
        console.log(`[战场动画] 播放 ${rootType}/${animPath}/battle/${action} @ ${parentName}`);
        return true;
    }

    private async loadPrefab(
        rootType: TBattleAnimRootType,
        animPath: string,
        action: EBattleAnimAction,
    ): Promise<Prefab | null> {
        const cached = BattleAnimLoadScheduler.getPrefab(rootType, animPath, action);
        if (cached != null) {
            return cached;
        }
        const path = BattleAnimCatalog.prefabPath(rootType, animPath, action);
        try {
            return await ResManager.loadAsset(EBundleType.ANIM, path, Prefab);
        } catch (e) {
            console.warn(`[战场动画] 加载失败 ${path}`, e);
            return null;
        }
    }

    private replaceAnimNode(slotParent: Node, prefab: Prefab): Node {
        const old = slotParent.getChildByName('anim');
        if (old != null && old.isValid) {
            old.removeFromParent();
            old.destroy();
        }
        const node = instantiate(prefab);
        node.name = 'anim';
        node.setPosition(0, 0, 0);
        slotParent.addChild(node);

        const animation = node.getComponent(Animation);
        if (animation != null && !animation.getState(animation.defaultClip?.name ?? '')?.isPlaying) {
            if (animation.defaultClip != null) {
                animation.play(animation.defaultClip.name);
            } else {
                animation.play();
            }
        }
        return node;
    }
}
