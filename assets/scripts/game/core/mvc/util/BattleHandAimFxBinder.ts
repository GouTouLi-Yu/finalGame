import { Node, UITransform, Vec2, Vec3 } from 'cc';
import { BattleFacade } from '../facade/battle/BattleFacade';
import { EBattleSide, EChooseTarget } from '../model/battle/BattleEnums';
import { BattleTargetArcFx } from './BattleTargetArcFx';
import { BattleTargetLockRing } from './BattleTargetLockRing';
import { BattleTargetSpotlight } from './BattleTargetSpotlight';
import type { BattleUnitSlotBinder, IBattleUnitHitSlot } from './BattleUnitSlotBinder';

const CARD_LIFT_Y = 56;
const CARD_LIFT_SCALE = 1.08;
const OTHER_HAND_DIM = 100;

export interface IHandCardLiftPose {
    restX: number;
    restY: number;
    restScaleX: number;
    restScaleY: number;
    originOpacity: number;
}

/**
 * 手牌拖拽瞄准表现（与出牌判定解耦）：
 * - 手牌抬起 / 其余手牌压暗
 * - 指向弧光
 * - 目标碎星环
 * - 舞台暗幕 + 追光
 */
export class BattleHandAimFxBinder {
    private _viewRoot: Node | null = null;
    private _unitBinder: BattleUnitSlotBinder | null = null;
    private _arcFx: BattleTargetArcFx | null = null;
    private _lockRingHostId: string | null = null;
    private readonly _arcFrom = new Vec2();
    private readonly _arcTo = new Vec2();

    bind(viewRoot: Node, unitBinder: BattleUnitSlotBinder): void {
        this.dispose();
        this._viewRoot = viewRoot;
        this._unitBinder = unitBinder;
    }

    dispose(): void {
        this.clearAll();
        this._arcFx = null;
        this._viewRoot = null;
        this._unitBinder = null;
    }

    /** 开始拖拽瞄准：抬牌、压暗其余手牌、显示弧光并刷新舞台 */
    begin(
        cardNode: Node,
        pose: IHandCardLiftPose,
        handNodes: readonly Node[],
        activeIndex: number,
        chooseTarget: EChooseTarget,
        uiX: number,
        uiY: number,
    ): IBattleUnitHitSlot | null {
        this.liftCard(cardNode, pose);
        this.applyOtherHandDim(handNodes, activeIndex);
        this.ensureArc().show();
        return this.updateAim(cardNode, chooseTarget, uiX, uiY);
    }

    /** 拖动中刷新弧光 / 锁环 / 舞台追光，返回当前合法命中 */
    updateAim(
        cardNode: Node,
        chooseTarget: EChooseTarget,
        uiX: number,
        uiY: number,
    ): IBattleUnitHitSlot | null {
        const from = this.getCardArcStartUi(cardNode);
        this._arcFrom.set(from.x, from.y);
        this._arcTo.set(uiX, uiY);

        const needTarget = chooseTarget !== EChooseTarget.None;
        const hit = needTarget && this._unitBinder != null
            ? this._unitBinder.hitTest(uiX, uiY, chooseTarget)
            : null;
        this.ensureArc().setEndpoints(this._arcFrom, this._arcTo, hit != null ? 'lock' : 'aim');
        this.updateLockRing(hit);
        this.updateStageSpotlight(chooseTarget, hit);
        return hit;
    }

    /** 结束瞄准表现（不清手牌节点位姿以外的业务状态） */
    end(handNodes: readonly Node[]): void {
        this.ensureArc().hide();
        this.clearLockRing();
        this.clearStageSpotlight();
        this.clearOtherHandDim(handNodes);
    }

    liftCard(cardNode: Node, pose: IHandCardLiftPose): void {
        cardNode.setPosition(pose.restX, pose.restY + CARD_LIFT_Y, 0);
        cardNode.setScale(pose.restScaleX * CARD_LIFT_SCALE, pose.restScaleY * CARD_LIFT_SCALE, 1);
        cardNode.setOpacity(255);
    }

    restoreCard(cardNode: Node, pose: IHandCardLiftPose, played: boolean): void {
        if (!cardNode.isValid) {
            return;
        }
        cardNode.setPosition(pose.restX, pose.restY, 0);
        cardNode.setScale(pose.restScaleX, pose.restScaleY, 1);
        if (!played) {
            cardNode.setOpacity(pose.originOpacity || 255);
            cardNode.active = true;
        }
    }

    private clearAll(): void {
        this._arcFx?.hide();
        this.clearLockRing();
        this.clearStageSpotlight();
        this._lockRingHostId = null;
    }

    private ensureArc(): BattleTargetArcFx {
        if (this._arcFx == null && this._viewRoot != null) {
            this._arcFx = BattleTargetArcFx.create(this._viewRoot);
        }
        return this._arcFx!;
    }

    private getCardArcStartUi(cardNode: Node): Vec2 {
        const ut = cardNode.getComponent(UITransform);
        if (ut == null) {
            const wp = cardNode.worldPosition;
            return new Vec2(wp.x, wp.y);
        }
        const localTop = new Vec3(0, ut.height * (1 - ut.anchorY), 0);
        const world = ut.convertToWorldSpaceAR(localTop);
        return new Vec2(world.x, world.y);
    }

    private updateLockRing(hit: IBattleUnitHitSlot | null): void {
        if (hit == null) {
            this.clearLockRing();
            return;
        }
        if (this._lockRingHostId === hit.unitId) {
            return;
        }
        this.clearLockRing();
        const ring = BattleTargetLockRing.ensure(hit.hitNode);
        ring.show();
        this._lockRingHostId = hit.unitId;
    }

    private clearLockRing(): void {
        if (this._lockRingHostId == null || this._unitBinder == null) {
            this._lockRingHostId = null;
            return;
        }
        const slot = this._unitBinder.getSlotByUnitId(this._lockRingHostId);
        slot?.hitNode.getChildByName('LockRing')?.getComponent(BattleTargetLockRing)?.hide();
        this._lockRingHostId = null;
    }

    private updateStageSpotlight(chooseTarget: EChooseTarget, hit: IBattleUnitHitSlot | null): void {
        if (this._viewRoot == null || this._unitBinder == null || chooseTarget === EChooseTarget.None) {
            this.clearStageSpotlight();
            return;
        }
        const raiseHosts: Node[] = [];
        const eligibleTouches: Node[] = [];
        const pushHost = (host: Node | null | undefined): void => {
            if (host == null || !host.isValid) {
                return;
            }
            if (raiseHosts.indexOf(host) < 0) {
                raiseHosts.push(host);
            }
        };
        for (const slot of this._unitBinder.slots) {
            const eligible = (chooseTarget === EChooseTarget.Enemy && slot.side === EBattleSide.Enemy)
                || (chooseTarget === EChooseTarget.Self && slot.side === EBattleSide.Ally);
            if (eligible) {
                pushHost(slot.hitNode.parent);
                if (slot.hitNode.isValid) {
                    eligibleTouches.push(slot.hitNode);
                }
            }
        }
        const actorId = BattleFacade.getInstance().currentActorUnitId;
        const actorSlot = actorId != null ? this._unitBinder.getSlotByUnitId(actorId) : null;
        pushHost(actorSlot?.hitNode.parent);

        BattleTargetSpotlight.ensure(this._viewRoot).setAim(
            raiseHosts,
            eligibleTouches,
            actorSlot?.hitNode ?? null,
            hit?.hitNode ?? null,
            hit?.side ?? null,
        );
    }

    private clearStageSpotlight(): void {
        this._viewRoot?.getChildByName('StageSpotlight')?.getComponent(BattleTargetSpotlight)?.hide();
    }

    private applyOtherHandDim(handNodes: readonly Node[], activeIndex: number): void {
        for (let i = 0; i < handNodes.length; i++) {
            const node = handNodes[i];
            if (node == null || !node.isValid || !node.active) {
                continue;
            }
            node.setOpacity(i === activeIndex ? 255 : OTHER_HAND_DIM);
        }
    }

    private clearOtherHandDim(handNodes: readonly Node[]): void {
        for (const node of handNodes) {
            if (node == null || !node.isValid || !node.active) {
                continue;
            }
            node.setOpacity(255);
        }
    }
}
