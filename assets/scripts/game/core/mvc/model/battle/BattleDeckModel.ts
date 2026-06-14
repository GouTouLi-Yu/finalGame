import { Card } from '../card/Card';

/** 战斗牌堆：抽牌堆 / 手牌 / 弃牌堆 / 消耗堆（持有 Card 引用，不复制实例） */
export class BattleDeckModel {

    private _library: Card[] = [];
    private _hand: Card[] = [];
    private _discard: Card[] = [];
    private _exhaust: Card[] = [];

    /** 抽牌堆 */
    get library(): readonly Card[] {
        return this._library;
    }

    /** 手牌 */
    get hand(): readonly Card[] {
        return this._hand;
    }

    /** 弃牌堆 */
    get discard(): readonly Card[] {
        return this._discard;
    }

    /** 消耗堆 */
    get exhaust(): readonly Card[] {
        return this._exhaust;
    }

    get totalCount(): number {
        return this._library.length + this._hand.length + this._discard.length + this._exhaust.length;
    }

    /** 进战：接管 Card 引用，默认全部放入抽牌堆并洗牌 */
    initFromCards(cards: Card[], shuffle = true): void {
        this.resetToDefault();
        this._library = [...cards];
        if (shuffle) {
            this.shuffleLibrary();
        }
    }

    /** 出战：合并四堆，供 {@link AdventureCardModel.restoreFromBattle} */
    collectAllCards(): Card[] {
        return [...this._library, ...this._hand, ...this._discard, ...this._exhaust];
    }

    shuffleLibrary(): void {
        const arr = this._library;
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
    }

    resetToDefault(): void {
        this._library.length = 0;
        this._hand.length = 0;
        this._discard.length = 0;
        this._exhaust.length = 0;
    }
}
