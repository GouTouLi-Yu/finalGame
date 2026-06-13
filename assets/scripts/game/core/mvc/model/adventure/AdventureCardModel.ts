import { IAdventureCardSaveData } from '../../../../save/PlayerSaveData';
import { CardUtil } from '../../util/CardUtil';
import { Card } from '../card/Card';

/** 冒险内本局拥有的卡牌（权威列表；战斗牌堆在战斗开始时引用移交） */
export class AdventureCardModel {
    private _cards: Card[] = [];

    get cards(): readonly Card[] {
        return this._cards;
    }

    addCardById(id: string, level: number = 1): Card {
        const card = new Card(id, level);
        this._cards.push(card);
        return card;
    }

    hasCardById(id: string): boolean {
        return this._cards.some((c) => c.id === id);
    }

    /** 发放 CardConfig 中尚未拥有的全部卡牌，返回新增数量 */
    grantAllCards(level: number = 1): number {
        let added = 0;
        for (const id of CardUtil.getAllIds()) {
            if (this.hasCardById(id)) {
                continue;
            }
            this.addCardById(id, level);
            added++;
        }
        return added;
    }

    /** 进战斗：将当前全部卡牌引用移交给战斗系统（冒险列表暂空，出战后 merge 回来） */
    takeAllCardsForBattle(): Card[] {
        const taken = this._cards;
        this._cards = [];
        return taken;
    }

    /** 出战斗：合并回冒险牌组 */
    restoreFromBattle(cards: Card[]): void {
        this._cards = [...cards];
    }

    synchronize(data: IAdventureCardSaveData[] | null | undefined): void {
        this._cards = [];
        if (data == null) {
            return;
        }
        for (const item of data) {
            if (item?.id) {
                this._cards.push(new Card(item.id, item.level));
            }
        }
    }

    getSaveData(): IAdventureCardSaveData[] {
        return this._cards.map((c) => ({ id: c.id, level: c.level }));
    }

    resetToDefault(): void {
        this._cards.length = 0;
    }
}
