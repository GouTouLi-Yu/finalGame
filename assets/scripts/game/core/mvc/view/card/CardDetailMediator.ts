import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { Node } from 'cc';
import { PopupViewMediator } from '../../../view/PopupViewMediator';
import { Card } from '../../model/card/Card';
import { CardViewUtil } from '../../util/CardViewUtil';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

export interface ICardDetailEnterData {
    card: Card;
}

/**
 * 卡牌详情弹窗。
 * 约定：界面 id `CardDetailView` → `prefab/Card/CardDetailLayer`（ui bundle）。
 * 预制体根下需有名为 `card` 的卡牌展示节点（结构与 cardTemp 一致）。
 */
export class CardDetailMediator extends PopupViewMediator {
    public static fullPath = 'prefab/Card';

    BtnHandles: Record<string, string> = {
        btn_close: 'onClickClose',
        close: 'onClickClose',
        btnClose: 'onClickClose',
    };

    private _cardNode: Node | null = null;
    private _card: Card | null = null;

    public initialize(..._any: unknown[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
        this.mapEventListeners();
    }

    registerUI(): void {
        this._cardNode = this.view.getChildByName('card')
            ?? this.view.getChildByName('Card')
            ?? this.view.getChildByName('cardTemp');
    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
    }

    public enterWithData(data?: ICardDetailEnterData): void {
        super.enterWithData(data);
        this._card = data?.card ?? null;
        this.setupView();
    }

    public setupView(_data?: unknown): void {
        if (this._cardNode == null || this._card == null) {
            console.warn('[CardDetail] 缺少 card 节点或入参 Card');
            return;
        }
        CardViewUtil.apply(this._cardNode, this._card, { descKind: 'detailed' });
    }

    onClickClose(): void {
        this.dismiss();
    }
}

ClassConfig.addClass('CardDetailMediator', CardDetailMediator);
