import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { Card } from '../card/Card';
import { Model } from '../Model';
import { BattleDeckModel } from './BattleDeckModel';

/** 单场战斗运行时数据（牌堆、回合等；一般不写入冒险存档） */
export class BattleModel extends Model {
    private _deckModel = new BattleDeckModel();

    get deckModel(): BattleDeckModel {
        return this._deckModel;
    }

    get isInBattle(): boolean {
        return this._deckModel.totalCount > 0;
    }

    /**
     * 进战斗：接管冒险移交的 Card 引用并初始化牌堆。
     * 典型用法：`battleModel.beginFromAdventureCards(adventureCardModel.takeAllCardsForBattle())`
     */
    beginFromAdventureCards(cards: Card[]): void {
        this._deckModel.initFromCards(cards);
    }

    /**
     * 出战斗：收集全部 Card 并清空战斗牌堆。
     * 典型用法：`adventureCardModel.restoreFromBattle(battleModel.endBattleAndCollectCards())`
     */
    endBattleAndCollectCards(): Card[] {
        const cards = this._deckModel.collectAllCards();
        this.resetToDefault();
        return cards;
    }

    synchronize(_data?: unknown): void {
        this.resetToDefault();
    }

    getSaveData(): null {
        return null;
    }

    resetToDefault(): void {
        this._deckModel.resetToDefault();
    }
}

ClassConfig.addClass('BattleModel', BattleModel);
