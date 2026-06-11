import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { ICardSaveData } from '../../../../save/PlayerSaveData';
import { Model } from '../Model';
import { Card } from './Card';

export class CardModel extends Model {
    private _cards: Map<string, Card>;

    synchronize(data: ICardSaveData): void {

    }

    getSaveData(): ICardSaveData {
        return {
            cards: null,
        };
    }

    resetToDefault(): void {

    }

    grantAll(): void {
        console.log("发送所有卡牌");

    }
}
ClassConfig.addClass('CardModel', CardModel);

