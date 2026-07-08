import { EventKeyboard, input, Input, KeyCode, Node } from 'cc';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { PCEventType } from 'db://assets/scripts/frame/event/PCEventType';
import { mountBattleDemoAnim } from '../../../../anim/AnimQualityDemo';
import { DevConfig } from '../../../../config/DevConfig';
import { UIManager } from '../../../../ui/UIManager';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { BattleFacade } from '../../facade/battle/BattleFacade';
import { Card } from '../../model/card/Card';
import { BattleHandCardLayoutUtil } from '../../util/BattleHandCardLayoutUtil';
import { BattleUtil } from '../../util/BattleUtil';
import { CardViewUtil } from '../../util/CardViewUtil';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

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
    /** 固定复用的手牌节点池（最多 maxCardNum 张） */
    private _handCardNodes: Node[] = [];

    private _onHandChanged = (): void => {
        this.refreshHandFromBattle();
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
        if (DevConfig.isGMAllowed()) {
            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        }
        this._handCardNodes = [];
        super.onRemove();
    }

    registerUI(): void {
        this._cardTempNode = this.view.getChildByName('cardTemp');
        this._cardRootNode = this.view.getChildByFullName('card');
        if (this._cardTempNode != null) {
            this._cardTempNode.active = false;
        }
        this.ensureHandCardPool();
    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
        this.mapEventListener(PCEventType.EVT_BATTLE_HAND_CHANGED, this, this._onHandChanged);
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {
        BattleFacade.getInstance().opEnsureDevHandTestBattle();
        this.refreshHandFromBattle();
        void mountBattleDemoAnim(this.view);
        console.log(
            '[BattleHand] GM 秘籍示例: addHandCard card_001 3 | addRandHandCard 2 | delRandCardByPos 1 | delAllRandCard | delRndCardById card_001',
        );
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
                visibleNodes.push(node);
            } else {
                node.active = false;
            }
        }

        if (visibleNodes.length > 0) {
            BattleHandCardLayoutUtil.apply(this._cardRootNode!, visibleNodes, visibleNodes.length);
        }

        const mode = visibleNodes.length <= 0 ? '空' : `Config(${visibleNodes.length})`;
        console.log(`[BattleHand] 刷新 ${visibleNodes.length} 张 | 模式=${mode}`);
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
