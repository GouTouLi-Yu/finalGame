import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { IAdventureSaveData } from '../../../../save/PlayerSaveData';
import { Model } from '../Model';
import { AdventureCardModel } from './AdventureCardModel';
import { AdventureDeployModel } from 'db://assets/scripts/game/core/mvc/model/adventure/AdventureDeployModel';

/** 一局冒险的运行时数据（地图、卡牌、圣物等；牌堆 hand/library 属于战斗层） */
export class AdventureModel extends Model {
    private _cardModel = new AdventureCardModel();
    private _deployModel = new AdventureDeployModel();

    get cardModel(): AdventureCardModel {
        return this._cardModel;
    }

    get deployModel(): AdventureDeployModel {
        return this._deployModel;
    }

    synchronize(data: IAdventureSaveData | null | undefined): void {
        if (data == null) {
            this.resetToDefault();
            return;
        }
        this._cardModel.synchronize(data.adventureCards);
        this._deployModel.synchronize(data.deploy);
    }

    getSaveData(): IAdventureSaveData {
        return {
            adventureCards: this._cardModel.getSaveData(),
            deploy: this._deployModel.getSaveData(),
        };
    }

    resetToDefault(): void {
        this._cardModel.resetToDefault();
        this._deployModel.resetToDefault();
    }

    /** 秘籍：发放本局冒险道具（卡牌、货币、装备等；目前仅卡牌） */
    grantAllAdventureItems(): { cards: number } {
        const cards = this._cardModel.grantAllCards();
        return { cards };
    }
}

ClassConfig.addClass('AdventureModel', AdventureModel);
