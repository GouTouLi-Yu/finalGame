import { Injector } from "db://assets/scripts/frame/Injector/Injector";
import { PlayerSaveData, SAVE_VERSION } from "db://assets/scripts/game/save/PlayerSaveData";
import { CardModel } from "../card/CardModel";
import { ElementModel } from "../element/ElementModel";
import { ItemModel } from "../item/ItemModel";
import { Model } from "../Model";


export class Player extends Model {
    private static _instance: Player;
    static get instance(): Player {
        if (!Player._instance) {
            Player._instance = new Player();
        }
        return Player._instance;
    }

    private _elementModel: ElementModel;
    get elementModel(): ElementModel {
        return this._elementModel;
    }

    private _itemModel: ItemModel;
    get itemModel(): ItemModel {
        return this._itemModel;
    }

    private _cardModel: CardModel;
    get cardModel(): CardModel {
        return this._cardModel;
    }

    constructor() {
        super();
        this._elementModel = Injector.shared.getInstance(ElementModel);
        this._itemModel = Injector.shared.getInstance(ItemModel);
    }

    synchronize(data: PlayerSaveData): void {
        if (data.elementDatas != null) {
            this._elementModel.synchronize(data.elementDatas);
        }

        if (data.itemDatas != null) {
            this._itemModel.synchronize(data.itemDatas);
        }

        if (data.cardDatas != null) {
            this._cardModel.synchronize(data.cardDatas);
        }
    }

    getSaveData(): PlayerSaveData {
        return {
            version: SAVE_VERSION,
            elementDatas: this._elementModel.getSaveData(),
            itemDatas: this._itemModel.getSaveData(),
            cardDatas: this._cardModel.getSaveData(),
        };
    }

    resetToDefault(): void {
        this._elementModel.resetToDefault();
        this._itemModel.resetToDefault();
    }

    // 打印玩家数据
    printPlayerData(): void {
        console.log("玩家数据 ===>", this.getSaveData());
    }


    grantAll(): void {
        console.log("发送所有道具：")
        this._cardModel.grantAll();
    }
}


