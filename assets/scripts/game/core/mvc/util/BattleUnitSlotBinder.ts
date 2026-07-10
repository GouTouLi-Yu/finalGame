import { Node, UITransform, Vec2 } from 'cc';
import { EBattleSide, EChooseTarget } from '../model/battle/BattleEnums';
import { BattleFieldModel } from '../model/battle/BattleFieldModel';
import { EnemyUtil } from './EnemyUtil';
import { HeroUtil } from './HeroUtil';

export interface IBattleUnitHitSlot {
    side: EBattleSide;
    slotIndex: number;
    unitId: string;
    /** 碰撞检测节点：anim/characterN|enemyN/touchLayer */
    hitNode: Node;
}

/**
 * 战场单位节点绑定与命中检测。
 * 预制体约定：
 * - anim/character1~4/touchLayer（尺寸/位置读 HeroBase）
 * - anim/enemy1~4/touchLayer（尺寸/位置读 EnemyConfig）
 * slotIndex 与 field 中 0-based 槽位一致（节点名为 1-based）。
 */
export class BattleUnitSlotBinder {
    private _slots: IBattleUnitHitSlot[] = [];

    bind(viewRoot: Node, field: BattleFieldModel | null): void {
        this._slots = [];
        if (viewRoot == null || field == null) {
            return;
        }
        const animRoot = viewRoot.getChildByName('anim');
        if (animRoot == null) {
            console.warn('[战场单位] 未找到 anim 根节点');
            return;
        }

        for (const unit of field.units.values()) {
            const parentName = unit.side === EBattleSide.Ally
                ? `character${unit.slotIndex + 1}`
                : `enemy${unit.slotIndex + 1}`;
            const parent = animRoot.getChildByName(parentName);
            if (parent == null) {
                console.warn(`[战场单位] 未找到节点 anim/${parentName}（单位=${unit.unitId}）`);
                continue;
            }

            const hit = this.bindTouchLayer(parent, unit.side, unit.unitId, parentName);
            if (hit == null) {
                console.warn(`[战场单位] 未找到命中节点 anim/${parentName}/touchLayer（单位=${unit.unitId}）`);
                continue;
            }

            this._slots.push({
                side: unit.side,
                slotIndex: unit.slotIndex,
                unitId: unit.unitId,
                hitNode: hit,
            });
        }
    }

    /** 取 touchLayer，并按 HeroBase / EnemyConfig 赋值尺寸与位置 */
    private bindTouchLayer(
        slotNode: Node,
        side: EBattleSide,
        unitId: string,
        parentName: string,
    ): Node | null {
        const touch = slotNode.getChildByName('touchLayer');
        if (touch == null) {
            return null;
        }
        const cfg = side === EBattleSide.Ally
            ? HeroUtil.getTouchLayer(unitId)
            : EnemyUtil.getTouchLayer(unitId);
        if (cfg == null) {
            const table = side === EBattleSide.Ally ? 'HeroBase' : 'EnemyConfig';
            console.warn(`[战场单位] ${table} 无 touchLayer 配置：${unitId}（anim/${parentName}/touchLayer 保持预制体默认）`);
            return touch;
        }
        const ut = touch.getComponent(UITransform) ?? touch.addComponent(UITransform);
        ut.setContentSize(cfg.width, cfg.height);
        touch.setPosition(cfg.x, cfg.y, touch.position.z);
        return touch;
    }

    get slots(): readonly IBattleUnitHitSlot[] {
        return this._slots;
    }

    getSlotByUnitId(unitId: string): IBattleUnitHitSlot | null {
        return this._slots.find((s) => s.unitId === unitId) ?? null;
    }

    static isPointInHandLayer(layer: Node | null, uiX: number, uiY: number): boolean {
        return this.containsUiPoint(layer, uiX, uiY);
    }

    hitTestAny(uiX: number, uiY: number): IBattleUnitHitSlot | null {
        let found: IBattleUnitHitSlot | null = null;
        for (const slot of this._slots) {
            if (BattleUnitSlotBinder.containsUiPoint(slot.hitNode, uiX, uiY)) {
                found = slot;
            }
        }
        return found;
    }

    hitTest(uiX: number, uiY: number, chooseTarget: EChooseTarget): IBattleUnitHitSlot | null {
        if (chooseTarget === EChooseTarget.None) {
            return null;
        }
        let found: IBattleUnitHitSlot | null = null;
        for (const slot of this._slots) {
            if (chooseTarget === EChooseTarget.Enemy && slot.side !== EBattleSide.Enemy) {
                continue;
            }
            if (chooseTarget === EChooseTarget.Self && slot.side !== EBattleSide.Ally) {
                continue;
            }
            if (BattleUnitSlotBinder.containsUiPoint(slot.hitNode, uiX, uiY)) {
                found = slot;
            }
        }
        return found;
    }

    static containsUiPoint(node: Node | null, uiX: number, uiY: number): boolean {
        if (node == null || !node.isValid || !node.activeInHierarchy) {
            return false;
        }
        const ut = node.getComponent(UITransform);
        if (ut == null) {
            return false;
        }
        return ut.getBoundingBoxToWorld().contains(new Vec2(uiX, uiY));
    }
}
