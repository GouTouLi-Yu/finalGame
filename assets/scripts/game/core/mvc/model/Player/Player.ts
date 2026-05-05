import { Injector } from "db://assets/scripts/frame/Injector/Injector";
import { PlayerSaveData, SAVE_VERSION } from "db://assets/scripts/game/save/PlayerSaveData";
import { ElementModel } from "../element/ElementModel";
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

    constructor() {
        super();
        this._elementModel = Injector.shared.getInstance(ElementModel);

    }

    synchronize(data: PlayerSaveData): void {
        if (data.elementModel != null) {
            this._elementModel.synchronize(data.elementModel);
        }
    }

    getSaveData(): PlayerSaveData {
        return {
            version: SAVE_VERSION,
            elementModel: this._elementModel.getSaveData(),
        };
    }

    resetToDefault(): void {
        this._elementModel.resetToDefault();
    }

    // 打印玩家数据
    printPlayerData(): void {
        console.log("玩家数据 ===>", this.getSaveData());
    }
}


