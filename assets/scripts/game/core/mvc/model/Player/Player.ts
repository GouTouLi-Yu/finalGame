import { Injector } from "db://assets/scripts/frame/Injector/Injector";
import { PlayerSaveData, SAVE_VERSION } from "db://assets/scripts/game/save/PlayerSaveData";
import { AdventureModel } from "../adventure/AdventureModel";
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

    private _adventureModel: AdventureModel;
    get adventureModel(): AdventureModel {
        return this._adventureModel;
    }

    constructor() {
        super();
        this._elementModel = Injector.shared.getInstance(ElementModel);
        this._itemModel = Injector.shared.getInstance(ItemModel);
        this._adventureModel = Injector.shared.getInstance(AdventureModel);
    }

    synchronize(data: PlayerSaveData): void {
        if (data.elementDatas != null) {
            this._elementModel.synchronize(data.elementDatas);
        }
        if (data.itemDatas != null) {
            this._itemModel.synchronize(data.itemDatas);
        }
        if (data.adventureDatas != null) {
            this._adventureModel.synchronize(data.adventureDatas);
        } else {
            this._adventureModel.resetToDefault();
        }
    }

    getSaveData(): PlayerSaveData {
        return {
            version: SAVE_VERSION,
            elementDatas: this._elementModel.getSaveData(),
            itemDatas: this._itemModel.getSaveData(),
            adventureDatas: this._adventureModel.getSaveData(),
        };
    }

    resetToDefault(): void {
        this._elementModel.resetToDefault();
        this._itemModel.resetToDefault();
        this._adventureModel.resetToDefault();
    }

    printPlayerData(): void {
        console.log("玩家数据 ===>", this.getSaveData());
    }

    /** 秘籍：发放局外全部道具（养成、解锁等） */
    grantAllItems(): void {
        this._itemModel.addItem('god');
    }
}
