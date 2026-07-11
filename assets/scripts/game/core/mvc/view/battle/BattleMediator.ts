import { EventKeyboard, EventMouse, EventTouch, input, Input, KeyCode, Node } from 'cc';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { PCEventType } from 'db://assets/scripts/frame/event/PCEventType';
import { DevConfig } from '../../../../config/DevConfig';
import { UIManager } from '../../../../ui/UIManager';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { BattleFacade } from '../../facade/battle/BattleFacade';
import { Card } from '../../model/card/Card';
import { EBattleSide, EChooseTarget } from '../../model/battle/BattleEnums';
import { ActionUtil } from '../../util/ActionUtil';
import { BattleHandAimFxBinder } from '../../util/BattleHandAimFxBinder';
import { BattleHandCardLayoutUtil } from '../../util/BattleHandCardLayoutUtil';
import { BattleUnitAnimHooks } from '../../util/BattleUnitAnimHooks';
import { BattleUnitAnimPlayer } from '../../util/BattleUnitAnimPlayer';
import { BattleEnemyInfoBinder } from '../../util/BattleEnemyInfoBinder';
import { BattleSeqBarBinder } from '../../util/BattleSeqBarBinder';
import { BattleUnitSlotBinder } from '../../util/BattleUnitSlotBinder';
import { BattleUtil } from '../../util/BattleUtil';
import { CardUtil } from '../../util/CardUtil';
import { CardViewUtil } from '../../util/CardViewUtil';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';
import { EBattlePlayFail } from '../../model/battle/BattleTypes';
import type { IBattleUnitHitSlot } from '../../util/BattleUnitSlotBinder';

/** 超过该像素位移视为拖拽（与 NodeExt addClickListener 一致：10px） */
const DRAG_THRESHOLD_SQ = 100;

interface IHandDragState {
    index: number;
    card: Card;
    originNode: Node;
    startUiX: number;
    startUiY: number;
    lastUiX: number;
    lastUiY: number;
    dragging: boolean;
    chooseTarget: EChooseTarget;
    originOpacity: number;
    restX: number;
    restY: number;
    restScaleX: number;
    restScaleY: number;
}

/**
 * 战斗全屏界面 Mediator。
 * 约定：界面 id `BattleView` → `prefab/battle/BattleLayer`（ui bundle）。
 */
export class BattleMediator extends AreaViewMediator {
    public static fullPath = 'prefab/battle';

    BtnHandles: Record<string, string> = {
        ['card/TestPrev']: 'onHandTestPrev',
        ['card/TestNext']: 'onHandTestNext',
        ['img/rightTop/btn_stop']: 'onClickOpenSetting',
    };

    private _cardTempNode: Node | null = null;
    private _cardRootNode: Node | null = null;
    private _handLayerNode: Node | null = null;
    /** 固定复用的手牌节点池（最多 maxCardNum 张） */
    private _handCardNodes: Node[] = [];
    private _handTouchBound = false;
    private _unitBinder = new BattleUnitSlotBinder();
    private _seqBarBinder = new BattleSeqBarBinder();
    private _enemyInfoBinder = new BattleEnemyInfoBinder();
    private _animPlayer = new BattleUnitAnimPlayer();
    private _aimFx = new BattleHandAimFxBinder();
    private _drag: IHandDragState | null = null;
    private _lastLoggedHandCount = -1;

    private _onHandChanged = (): void => {
        if (this._drag != null) {
            const actorId = BattleFacade.getInstance().currentActorUnitId;
            const slot = actorId != null ? this._unitBinder.getSlotByUnitId(actorId) : null;
            if (actorId != null && slot != null && this._drag.dragging) {
                BattleUnitAnimHooks.playPrepBack(
                    actorId,
                    slot.slotIndex,
                    this._drag.chooseTarget !== EChooseTarget.Self,
                );
            }
            this.cancelDragVisual(false);
        }
        this.refreshHandFromBattle();
    };

    private _onPlayerTurnChanged = (): void => {
        const actor = BattleFacade.getInstance().currentActorUnitId;
        console.log(`[手牌] 当前状态：玩家回合行动者=${actor ?? '无'}`);
        this.refreshSeqBar(true);
    };

    private _onEnemyInfoChanged = (): void => {
        this.refreshEnemyInfo();
    };

    public initialize(..._any: any[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
        this.mapEventListeners();
        if (DevConfig.isGMAllowed()) {
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        }
    }

    public onRemove(): void {
        this.unmapEventListener(PCEventType.EVT_BATTLE_HAND_CHANGED, this, this._onHandChanged);
        this.unmapEventListener(PCEventType.EVT_BATTLE_PLAYER_TURN_CHANGED, this, this._onPlayerTurnChanged);
        this.unmapEventListener(PCEventType.EVT_BATTLE_ENEMY_INFO_CHANGED, this, this._onEnemyInfoChanged);
        if (DevConfig.isGMAllowed()) {
            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        }
        this.unbindGlobalDragInput();
        this.cancelDragVisual(false);
        this._aimFx.dispose();
        this._enemyInfoBinder.dispose();
        BattleUnitAnimHooks.bindPlayer(null);
        this._handCardNodes = [];
        this._handTouchBound = false;
        super.onRemove();
    }

    registerUI(): void {
        this._cardTempNode = this.view.getChildByName('cardTemp');
        this._cardRootNode = this.view.getChildByFullName('card');
        this._handLayerNode = this.view.getChildByName('Layer');
        if (this._cardTempNode != null) {
            this._cardTempNode.active = false;
        }
        this.ensureHandCardPool();
        this.bindHandCardTouches();
        this._seqBarBinder.bind(this.view);
        this._enemyInfoBinder.bind(this.view);
    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
        this.mapEventListener(PCEventType.EVT_BATTLE_HAND_CHANGED, this, this._onHandChanged);
        this.mapEventListener(PCEventType.EVT_BATTLE_PLAYER_TURN_CHANGED, this, this._onPlayerTurnChanged);
        this.mapEventListener(PCEventType.EVT_BATTLE_ENEMY_INFO_CHANGED, this, this._onEnemyInfoChanged);
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {
        const facade = BattleFacade.getInstance();
        facade.opEnsureDevHandTestBattle();
        this._unitBinder.bind(this.view, facade.fieldModel);
        this._aimFx.bind(this.view, this._unitBinder);
        this._animPlayer.bind(this.view, facade.fieldModel);
        BattleUnitAnimHooks.bindPlayer(this._animPlayer);
        this.advanceToPlayerTurn();
        this.refreshHandFromBattle();
        this.refreshSeqBar();
        this.refreshEnemyInfo();
        // 先预载 prep/other，再挂 idle，保证拖牌/收回能同步切到动画
        void (async () => {
            await this._animPlayer.preloadAllyBattleAnims();
            await this._animPlayer.playIdleAll();
            console.log('[战场动画] 全员 idle 就绪');
        })();
        console.log('[手牌] 操作说明：点击看详情；拖出手牌区出牌；需目标则拖到单位上松手');
    }

    /** 刷新行动条 seq1~8；animate=true 时左侧滑出、右侧左挤 */
    refreshSeqBar(animate = false): void {
        this._seqBarBinder.refresh(BattleFacade.getInstance().session, animate);
    }

    /** 刷新敌人头顶 HP / 脆弱 / Buff / 元素印记 */
    refreshEnemyInfo(): void {
        this._enemyInfoBinder.refresh(BattleFacade.getInstance().fieldModel);
    }

    /** 按当前战斗 Session 手牌刷新 UI（复用节点：显隐 / 刷数据 / 摆位） */
    refreshHandFromBattle(): void {
        if (!this.ensureHandCardPool()) {
            return;
        }

        const hand = BattleFacade.getInstance().session?.deck.hand ?? [];
        const count = Math.min(hand.length, this._handCardNodes.length);
        const visibleNodes: Node[] = [];

        for (let i = 0; i < this._handCardNodes.length; i++) {
            const node = this._handCardNodes[i];
            if (node == null) {
                continue;
            }
            if (i < count) {
                const data = hand[i] as Card;
                CardViewUtil.apply(node, data);
                node.active = true;
                node.setOpacity(255);
                visibleNodes.push(node);
            } else {
                node.active = false;
            }
        }

        if (visibleNodes.length > 0) {
            BattleHandCardLayoutUtil.apply(this._cardRootNode!, visibleNodes, visibleNodes.length);
        }

        // 刷新日志降噪：仅手牌数量变化时打印
        if (this._lastLoggedHandCount !== visibleNodes.length) {
            this._lastLoggedHandCount = visibleNodes.length;
            console.log(`[手牌] 当前状态：手牌 ${visibleNodes.length} 张`);
        }
    }

    onHandTestPrev(): void {
        BattleFacade.getInstance().cheatRemoveHandAtPosition(
            BattleFacade.getInstance().session?.deck.hand.length ?? 0,
        );
    }

    onHandTestNext(): void {
        BattleFacade.getInstance().cheatAddRandomHandCard(1);
    }

    onClickOpenSetting(): void {
        void UIManager.gotoView('SettingView', undefined, { showPopupMask: false });
    }

    private onKeyDown(e: EventKeyboard): void {
        const facade = BattleFacade.getInstance();
        const code = e.keyCode;
        if (code >= KeyCode.DIGIT_1 && code <= KeyCode.DIGIT_9) {
            facade.cheatAddHandCard('card_001', code - KeyCode.DIGIT_1 + 1);
            return;
        }
        if (code === KeyCode.DIGIT_0) {
            facade.cheatAddHandCard('card_001', 10);
            return;
        }
        // 空格：推进跑条 / 结束当前玩家回合后再推进
        if (code === KeyCode.SPACE) {
            if (facade.isWaitingPlayerTurn) {
                facade.opEndPlayerTurn();
            }
            facade.opAdvanceActionBar();
            this._unitBinder.bind(this.view, facade.fieldModel);
            this.refreshSeqBar(true);
        }
    }

    /** 推进到第一个可手操的友方回合 */
    private advanceToPlayerTurn(): void {
        const facade = BattleFacade.getInstance();
        let guard = 0;
        while (!facade.isWaitingPlayerTurn && guard++ < 40) {
            const events = facade.opAdvanceActionBar();
            if (events.length === 0) {
                break;
            }
        }
        this._unitBinder.bind(this.view, facade.fieldModel);
        this.refreshSeqBar();
        if (!facade.isWaitingPlayerTurn) {
            console.warn('[手牌] 未能进入玩家回合（请检查上阵与跑条）');
        }
    }

    private bindHandCardTouches(): void {
        if (this._handTouchBound) {
            return;
        }
        for (let i = 0; i < this._handCardNodes.length; i++) {
            const node = this._handCardNodes[i];
            if (node == null) {
                continue;
            }
            const index = i;
            node.registerScriptTouchHandler((eventName, px, py, event) => {
                this.onHandCardTouch(index, eventName, px, py, event);
            });
        }
        this._handTouchBound = true;
    }

    private onHandCardTouch(
        index: number,
        eventName: string,
        px: number,
        py: number,
        _event?: EventTouch,
    ): void {
        if (eventName === 'began') {
            this.onHandTouchBegan(index, px, py);
            return;
        }
        // 拖拽中改由全局输入接管，避免拖出牌节点后变成 cancelled 被静默收回
        if (this._drag?.dragging) {
            return;
        }
        if (this._drag == null || this._drag.index !== index) {
            return;
        }
        if (eventName === 'moved') {
            this.onHandTouchMoved(px, py);
            return;
        }
        if (eventName === 'ended' || eventName === 'cancelled') {
            this.onHandTouchEnded(px, py);
        }
    }

    private onHandTouchBegan(index: number, px: number, py: number): void {
        if (this._drag != null) {
            return;
        }
        const facade = BattleFacade.getInstance();
        const hand = facade.session?.deck.hand ?? [];
        const card = hand[index];
        const originNode = this._handCardNodes[index];
        if (card == null || originNode == null || !originNode.active) {
            return;
        }

        const actionId = CardUtil.getActionId(card.id);
        const chooseTarget = ActionUtil.getChooseTargetForCard(card.id, actionId);
        this._drag = {
            index,
            card,
            originNode,
            startUiX: px,
            startUiY: py,
            lastUiX: px,
            lastUiY: py,
            dragging: false,
            chooseTarget,
            originOpacity: originNode.getOpacity?.() ?? 255,
            restX: originNode.position.x,
            restY: originNode.position.y,
            restScaleX: originNode.scale.x,
            restScaleY: originNode.scale.y,
        };
        this.bindGlobalDragInput();
    }

    private onHandTouchMoved(px: number, py: number): void {
        const drag = this._drag;
        if (drag == null) {
            return;
        }
        drag.lastUiX = px;
        drag.lastUiY = py;
        const dx = px - drag.startUiX;
        const dy = py - drag.startUiY;
        if (!drag.dragging) {
            if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) {
                return;
            }
            this.beginDragVisual(drag);
        }
        this.updateAimVisual(drag, px, py);
    }

    private onHandTouchEnded(px: number, py: number): void {
        const drag = this._drag;
        if (drag == null) {
            return;
        }
        drag.lastUiX = px;
        drag.lastUiY = py;

        if (!drag.dragging) {
            this.unbindGlobalDragInput();
            this._drag = null;
            this.openCardDetail(drag.card);
            return;
        }

        // 拖出牌区后节点常发 cancelled；全局松手也走同一套判定，不再静默收回
        this.resolveDragPlay(drag, px, py);
    }

    /** 拖出牌节点后仍能收到移动/松手（地图、敌人、友方上） */
    private bindGlobalDragInput(): void {
        this.unbindGlobalDragInput();
        input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
    }

    private unbindGlobalDragInput(): void {
        input.off(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchEnd, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onGlobalMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
    }

    private onGlobalTouchMove(event: EventTouch): void {
        if (this._drag == null) {
            return;
        }
        const loc = event.getUILocation();
        this.onHandTouchMoved(loc.x, loc.y);
    }

    private onGlobalTouchEnd(event: EventTouch): void {
        if (this._drag == null) {
            return;
        }
        const loc = event.getUILocation();
        this.onHandTouchEnded(loc.x, loc.y);
    }

    private onGlobalMouseMove(event: EventMouse): void {
        if (this._drag == null) {
            return;
        }
        const loc = event.getUILocation();
        this.onHandTouchMoved(loc.x, loc.y);
    }

    private onGlobalMouseUp(event: EventMouse): void {
        if (this._drag == null) {
            return;
        }
        const loc = event.getUILocation();
        this.onHandTouchEnded(loc.x, loc.y);
    }

    private beginDragVisual(drag: IHandDragState): void {
        drag.dragging = true;
        this._aimFx.begin(
            drag.originNode,
            {
                restX: drag.restX,
                restY: drag.restY,
                restScaleX: drag.restScaleX,
                restScaleY: drag.restScaleY,
                originOpacity: drag.originOpacity,
            },
            this._handCardNodes,
            drag.index,
            drag.chooseTarget,
            drag.lastUiX,
            drag.lastUiY,
        );

        const actorId = BattleFacade.getInstance().currentActorUnitId;
        if (actorId == null) {
            console.warn('[战场动画] 拖牌开始但无当前行动者，跳过预备动画');
            return;
        }
        // 不依赖 touchLayer 槽位：Player 只需要 unitId
        const unit = BattleFacade.getInstance().fieldModel?.getUnit(actorId);
        const slotIndex = unit?.slotIndex
            ?? this._unitBinder.getSlotByUnitId(actorId)?.slotIndex
            ?? 0;
        BattleUnitAnimHooks.playPrepStartChain(
            actorId,
            slotIndex,
            drag.chooseTarget !== EChooseTarget.Self,
        );
    }

    private updateAimVisual(drag: IHandDragState, uiX: number, uiY: number): void {
        this._aimFx.updateAim(drag.originNode, drag.chooseTarget, uiX, uiY);
    }

    private resolveDragPlay(drag: IHandDragState, uiX: number, uiY: number): void {
        const facade = BattleFacade.getInstance();
        const actorId = facade.currentActorUnitId;
        const actorSlot = actorId != null ? this._unitBinder.getSlotByUnitId(actorId) : null;
        const inHandLayer = BattleUnitSlotBinder.isPointInHandLayer(this._handLayerNode, uiX, uiY);
        const needTarget = drag.chooseTarget !== EChooseTarget.None;
        const targetTypeLabel = this.chooseTargetLabel(drag.chooseTarget);
        // 松手点实际压到谁（不限阵营），用于状态展示
        const underFinger = this._unitBinder.hitTestAny(uiX, uiY);
        const underFingerText = this.formatHitUnit(underFinger);
        this.logReleaseStatus({
            cardId: drag.card.id,
            actorId,
            needTarget,
            targetType: targetTypeLabel,
            inHandLayer,
            underFingerText,
            uiX,
            uiY,
        });

        if (actorId == null) {
            this.logPlayResult({
                outcome: 'cancel',
                reason: '当前不是玩家回合（无行动者）',
                cardId: drag.card.id,
                actorId: null,
                needTarget,
                targetType: targetTypeLabel,
                targetId: null,
                underFingerText,
            });
            this.returnCardToHand(drag);
            return;
        }

        // 需要选目标：优先看是否命中合法单位（即使落点仍在 Layer 重叠区，命中目标也算出牌）
        if (needTarget) {
            const hit = this._unitBinder.hitTest(uiX, uiY, drag.chooseTarget);
            if (hit != null) {
                this.tryPlayCard(drag, actorId, actorSlot?.slotIndex ?? 0, hit.unitId, drag.chooseTarget, underFingerText);
                return;
            }
            // 未命中目标：在手牌区 → 明确收回；在手牌区外 → 也收回（选目标失败）
            this.logPlayResult({
                outcome: 'cancel',
                reason: inHandLayer
                    ? `需要选择目标（${targetTypeLabel}），松手在手牌区且未命中合法目标 → 收回`
                    : `需要选择目标（${targetTypeLabel}），松手未命中合法单位 → 收回`,
                cardId: drag.card.id,
                actorId,
                needTarget: true,
                targetType: targetTypeLabel,
                targetId: null,
                underFingerText,
            });
            this.returnCardToHand(drag);
            return;
        }

        // 无需选目标：仍在手牌区 → 收回；拖出 Layer → 打出
        if (inHandLayer) {
            this.logPlayResult({
                outcome: 'cancel',
                reason: '无需选目标，但松手仍在手牌区内 → 收回',
                cardId: drag.card.id,
                actorId,
                needTarget: false,
                targetType: targetTypeLabel,
                targetId: null,
                underFingerText,
            });
            this.returnCardToHand(drag);
            return;
        }

        this.tryPlayCard(drag, actorId, actorSlot?.slotIndex ?? 0, null, EChooseTarget.None, underFingerText);
    }

    private tryPlayCard(
        drag: IHandDragState,
        actorId: string,
        actorSlotIndex: number,
        targetId: string | null,
        chooseTarget: EChooseTarget,
        underFingerText: string,
    ): void {
        const facade = BattleFacade.getInstance();
        const needTarget = chooseTarget !== EChooseTarget.None;
        const targetTypeLabel = this.chooseTargetLabel(chooseTarget);
        const towardEnemy = chooseTarget !== EChooseTarget.Self;
        const wasDragging = drag.dragging;
        // 先清拖拽，避免 opPlayCard 触发手牌刷新时误播 prepBack
        this.cancelDragVisual(true);

        const res = facade.opPlayCard({
            card: drag.card,
            actorUnitId: actorId,
            chosenTargetId: targetId,
        });

        if (!res.ok) {
            this.logPlayResult({
                outcome: 'fail',
                reason: this.playFailReasonLabel(res.reason),
                cardId: drag.card.id,
                actorId,
                needTarget,
                targetType: targetTypeLabel,
                targetId: targetId ?? res.chosenTargetId ?? null,
                underFingerText,
            });
            if (wasDragging && actorId) {
                BattleUnitAnimHooks.playPrepBack(actorId, actorSlotIndex, towardEnemy);
            }
            this.refreshHandFromBattle();
            return;
        }

        this.logPlayResult({
            outcome: 'play',
            reason: needTarget ? '拖到目标并松手' : '拖出手牌区（无需选目标）',
            cardId: drag.card.id,
            actorId: res.actorUnitId ?? actorId,
            needTarget,
            targetType: targetTypeLabel,
            targetId: res.chosenTargetId ?? targetId,
            underFingerText,
            manaCost: res.manaCost,
        });

        if (wasDragging) {
            BattleUnitAnimHooks.playUsingMagic(actorId, actorSlotIndex);
        }
        // 手牌刷新由 EVT_BATTLE_HAND_CHANGED 触发
    }

    private returnCardToHand(drag: IHandDragState): void {
        const actorId = BattleFacade.getInstance().currentActorUnitId;
        if (actorId != null && drag.dragging) {
            const unit = BattleFacade.getInstance().fieldModel?.getUnit(actorId);
            const slotIndex = unit?.slotIndex
                ?? this._unitBinder.getSlotByUnitId(actorId)?.slotIndex
                ?? 0;
            BattleUnitAnimHooks.playPrepBack(
                actorId,
                slotIndex,
                drag.chooseTarget !== EChooseTarget.Self,
            );
        }
        this.cancelDragVisual(false);
        this.refreshHandFromBattle();
    }

    private chooseTargetLabel(t: EChooseTarget): string {
        switch (t) {
            case EChooseTarget.Enemy:
                return '敌人';
            case EChooseTarget.Self:
                return '友方';
            default:
                return '无需选目标';
        }
    }

    /** 松手点下的单位：敌人 / 友方 / 未选中任何人 */
    private formatHitUnit(slot: IBattleUnitHitSlot | null): string {
        if (slot == null) {
            return '未选中任何人';
        }
        const sideText = slot.side === EBattleSide.Enemy ? '敌人' : '友方';
        return `${sideText}（槽位${slot.slotIndex + 1}，单位=${slot.unitId}）`;
    }

    private formatChosenTarget(targetId: string | null | undefined): string {
        if (targetId == null || targetId === '') {
            return '未选中任何人';
        }
        const slot = this._unitBinder.getSlotByUnitId(targetId);
        if (slot != null) {
            return this.formatHitUnit(slot);
        }
        return `未知单位（${targetId}）`;
    }

    private playFailReasonLabel(reason: string | undefined): string {
        switch (reason) {
            case EBattlePlayFail.NO_MANA:
                return '费用不足';
            case EBattlePlayFail.NO_TARGET:
                return '没有合法目标';
            case EBattlePlayFail.NOT_IN_HAND:
                return '牌不在手牌中';
            case EBattlePlayFail.SILENCED:
                return '沉默中无法出牌';
            case EBattlePlayFail.DISCARD_FAIL:
                return '弃牌失败';
            case EBattlePlayFail.NO_HAND:
                return '没有手牌';
            default:
                return reason != null && reason !== '' ? String(reason) : '未知原因';
        }
    }

    private logReleaseStatus(info: {
        cardId: string;
        actorId: string | null | undefined;
        needTarget: boolean;
        targetType: string;
        inHandLayer: boolean;
        underFingerText: string;
        uiX: number;
        uiY: number;
    }): void {
        console.log(
            `[手牌] 松手状态 | 牌=${info.cardId}`
            + ` | 行动者=${info.actorId ?? '无'}`
            + ` | 需要目标=${info.needTarget ? info.targetType : '否'}`
            + ` | 是否在手牌区=${info.inHandLayer ? '是' : '否'}`
            + ` | 松手选中=${info.underFingerText}`
            + ` | 坐标=(${info.uiX.toFixed(0)},${info.uiY.toFixed(0)})`,
        );
    }

    private logPlayResult(info: {
        outcome: 'play' | 'cancel' | 'fail';
        reason: string;
        cardId: string;
        actorId: string | null | undefined;
        needTarget: boolean;
        targetType: string;
        targetId: string | null | undefined;
        underFingerText: string;
        manaCost?: number;
    }): void {
        const outcomeText =
            info.outcome === 'play' ? '已打出'
                : info.outcome === 'fail' ? '出牌失败（牌收回）'
                    : '未打出（牌收回）';
        const chosenText = info.needTarget
            ? this.formatChosenTarget(info.targetId)
            : '无需选目标';
        const manaText = info.manaCost != null ? ` | 费用=${info.manaCost}` : '';
        console.log(
            `[手牌] ${outcomeText}`
            + ` | 牌=${info.cardId}`
            + ` | 行动者=${info.actorId ?? '无'}`
            + ` | 松手选中=${info.underFingerText}`
            + ` | 出牌目标=${chosenText}${manaText}`
            + ` | ${info.reason}`,
        );
    }

    private openCardDetail(card: Card): void {
        void UIManager.gotoView('CardDetailView', { card });
    }

    /** 清理拖拽表现；played=true 表示已出牌（原牌交给 refresh） */
    private cancelDragVisual(played: boolean): void {
        this.unbindGlobalDragInput();
        this._aimFx.end(this._handCardNodes);
        const drag = this._drag;
        this._drag = null;
        if (drag == null) {
            return;
        }
        if (drag.originNode?.isValid) {
            this._aimFx.restoreCard(
                drag.originNode,
                {
                    restX: drag.restX,
                    restY: drag.restY,
                    restScaleX: drag.restScaleX,
                    restScaleY: drag.restScaleY,
                    originOpacity: drag.originOpacity,
                },
                played,
            );
        }
    }

    /** 首次准备手牌节点池：优先复用 card 下预制体摆好的卡，不足再 clone cardTemp */
    private ensureHandCardPool(): boolean {
        if (this._handCardNodes.length > 0) {
            return true;
        }
        if (this._cardRootNode == null) {
            return false;
        }

        const max = BattleUtil.maxCardNum;
        const placed = [...this._cardRootNode.children];
        if (placed.length > 0) {
            this._handCardNodes = placed.slice(0, max);
            for (const node of this._handCardNodes) {
                node.active = false;
            }
        }

        if (this._handCardNodes.length >= max) {
            return true;
        }

        if (this._cardTempNode == null) {
            return this._handCardNodes.length > 0;
        }

        const start = this._handCardNodes.length;
        for (let i = start; i < max; i++) {
            const node = this._cardTempNode.clone() as Node;
            node.name = `HandCard_${i + 1}`;
            node.active = false;
            this._cardRootNode.addChild(node);
            this._handCardNodes.push(node);
        }
        return this._handCardNodes.length > 0;
    }
}

ClassConfig.addClass('BattleMediator', BattleMediator);
