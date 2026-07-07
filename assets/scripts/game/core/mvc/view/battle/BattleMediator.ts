import { DEV } from 'cc/env';

import { EventKeyboard, input, Input, KeyCode, Label, Layout, Node } from 'cc';

import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';

import { PCEventType } from 'db://assets/scripts/frame/event/PCEventType';

import { mountBattleDemoAnim } from '../../../../anim/AnimQualityDemo';
import { BattleFacade } from '../../facade/battle/BattleFacade';

import { Card } from '../../model/card/Card';

import { BattleHandCardLayoutUtil } from '../../util/BattleHandCardLayoutUtil';

import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';
import { UIManager } from '../../../../ui/UIManager';



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



    private _cardTempNode: Node;

    private _cardLayoutNode: Node;

    private _layout: Layout | null = null;

    private _onHandChanged = (): void => {

        this.refreshHandFromBattle();

    };



    public initialize(..._any: any[]): void { }



    public onRegister(): void {

        super.onRegister();

        this.registerUI();

        this.mapEventListeners();

        if (DEV) {

            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);

        }

    }



    public onRemove(): void {

        this.unmapEventListener(PCEventType.EVT_BATTLE_HAND_CHANGED, this, this._onHandChanged);

        if (DEV) {

            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);

        }

        super.onRemove();

    }



    registerUI(): void {

        this._cardTempNode = this.view.getChildByName('cardTemp');

        this._cardLayoutNode = this.view.getChildByFullName('card/Layout');

        this._layout = this._cardLayoutNode?.getComponent(Layout) ?? null;

        if (this._cardTempNode != null) {

            this._cardTempNode.active = false;

        }

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



    /** 按当前战斗 Session 手牌刷新 UI */

    refreshHandFromBattle(): void {

        if (this._cardLayoutNode == null || this._cardTempNode == null) {

            return;

        }

        const hand = BattleFacade.getInstance().session?.deck.hand ?? [];

        this.clearHandCardNodes();



        const cardNodes: Node[] = [];

        for (let i = 0; i < hand.length; i++) {

            const data = hand[i] as Card;

            const card = this._cardTempNode.clone() as Node;

            card.active = true;

            card.name = `HandCard_${i + 1}`;

            this._cardLayoutNode.addChild(card);

            this.setCardDebugLabel(card, i + 1, data.id);

            cardNodes.push(card);

        }



        const count = hand.length;

        if (count > 0) {

            BattleHandCardLayoutUtil.apply(this._cardLayoutNode, this._layout, cardNodes, count);

        } else if (this._layout != null) {

            this._layout.enabled = true;

            this._layout.updateLayout(true);

        }



        const mode =

            count <= 0

                ? '空'

                : count <= BattleHandCardLayoutUtil.LAYOUT_MAX_COUNT

                    ? 'Layout'

                    : `Config(${count})`;

        console.log(`[BattleHand] 刷新 ${count} 张 | 模式=${mode}`);

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



    private clearHandCardNodes(): void {

        const layoutNode = this._cardLayoutNode;

        const keep = this._cardTempNode;

        const toDestroy: Node[] = [];

        for (const child of layoutNode.children) {

            if (child !== keep) {

                toDestroy.push(child);

            }

        }

        for (const n of toDestroy) {

            n.destroy();

        }

    }



    private setCardDebugLabel(card: Node, index: number, cardId: string): void {

        const labelNode = card.getChildByName('Label') ?? card.getChildByName('Num');

        const label = labelNode?.getComponent(Label);

        if (label != null) {

            label.string = `${index}\n${cardId}`;

        }

    }

}



ClassConfig.addClass('BattleMediator', BattleMediator);


