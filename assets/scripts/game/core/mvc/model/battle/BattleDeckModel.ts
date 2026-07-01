import { BattleUtil } from '../../util/BattleUtil';
import { Card } from '../card/Card';
import { EDeckPile } from './DeckPile';

/**
 * 战斗牌堆：抽牌堆 / 手牌 / 弃牌堆 / 消耗堆（持有 Card 引用，不复制实例）。
 *
 * 顺序约定（对外语义）：
 * - **堆顶** = 下一张会被摸到 / 最后弃入的那张
 * - **堆底** = 最远离堆顶的那张
 *
 * 内部存储：数组 `[0]` 为堆底、`[length-1]` 为堆顶，摸牌 `pop()` O(1)。
 * {@link library} / {@link discard} 返回内部顺序（堆底在前）；UI 从顶展示请用 {@link viewLibraryFromTop}。
 *
 * 不自动洗牌；仅在有「洗牌」类机制时显式调用 {@link shuffleLibrary}。
 *
 * 扩展机制：固定顺序操作用 draw/put/insert；随机或跨堆效果用 {@link pickRandomFromPile}、{@link moveCardBetweenPiles}。
 */
export class BattleDeckModel {

    private _library: Card[] = [];
    private _hand: Card[] = [];
    private _discard: Card[] = [];
    private _exhaust: Card[] = [];

    /** 抽牌堆内部顺序（[0]=堆底，末位=堆顶） */
    get library(): readonly Card[] {
        return this._library;
    }

    /** 手牌 */
    get hand(): readonly Card[] {
        return this._hand;
    }

    /** 弃牌堆内部顺序（[0]=堆底，末位=堆顶） */
    get discard(): readonly Card[] {
        return this._discard;
    }

    /** 消耗堆 */
    get exhaust(): readonly Card[] {
        return this._exhaust;
    }

    /** 抽牌堆堆顶（下一张会被摸到），空则 null */
    peekLibraryTop(): Card | null {
        const n = this._library.length;
        return n > 0 ? (this._library[n - 1] ?? null) : null;
    }

    /** 堆顶在前，供 UI 展示 */
    viewLibraryFromTop(): readonly Card[] {
        return this._library.length > 0 ? [...this._library].reverse() : [];
    }

    /** 堆顶在前，供 UI 展示 */
    viewDiscardFromTop(): readonly Card[] {
        return this._discard.length > 0 ? [...this._discard].reverse() : [];
    }

    get totalCount(): number {
        return this._library.length + this._hand.length + this._discard.length + this._exhaust.length;
    }

    /** 进战：接管 Card 引用（cards[0] 在堆顶，先被摸到） */
    initFromCards(cards: Card[], shuffle = false): void {
        this.resetToDefault();
        // 内部 [0]=堆底，cards[0] 需落在末位
        this._library = [...cards].reverse();
        if (shuffle) {
            this.shuffleLibrary();
        }
    }

    /** 出战：合并四堆，供 {@link AdventureCardModel.restoreFromBattle} */
    collectAllCards(): Card[] {
        return [...this._library, ...this._hand, ...this._discard, ...this._exhaust];
    }

    /** 显式洗牌（仅在有洗牌机制时调用；传入 rng 则确定性洗牌） */
    shuffleLibrary(rng?: { nextInt(max: number): number }): void {
        const arr = this._library;
        const pick = rng ?? { nextInt: (max: number) => Math.floor(Math.random() * max) };
        for (let i = arr.length - 1; i > 0; i--) {
            const j = pick.nextInt(i + 1);
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
    }

    /**
     * 抽牌堆空时：弃牌堆整堆按原顺序接到抽牌堆底（消耗堆不参与，不洗牌）。
     * 若抽牌堆仍有牌，弃牌整堆接到堆底，不影响当前堆顶（仍先摸完抽牌堆再摸弃牌）。
     */
    recycleDiscardToLibrary(): void {
        if (this._discard.length === 0) {
            return;
        }
        if (this._library.length === 0) {
            this._library.push(...this._discard);
        } else {
            this._library.unshift(...this._discard);
        }
        this._discard.length = 0;
    }

    /** 将牌放到抽牌堆顶 O(1) */
    putOnTopOfLibrary(card: Card): void {
        this._library.push(card);
    }

    /** 将牌放到抽牌堆底 O(n) */
    putOnBottomOfLibrary(card: Card): void {
        this._library.unshift(card);
    }

    /** 将牌插入抽牌堆：index 0 = 堆顶，越大越靠近堆底 */
    insertIntoLibrary(card: Card, index: number): void {
        const i = Math.max(0, Math.min(index, this._library.length));
        this._library.splice(this._library.length - i, 0, card);
    }

    /** 将牌放到弃牌堆顶 O(1) */
    putOnTopOfDiscard(card: Card): void {
        this._discard.push(card);
    }

    /** 将牌放到弃牌堆底 O(n) */
    putOnBottomOfDiscard(card: Card): void {
        this._discard.unshift(card);
    }

    /** 从手牌移除指定牌；成功返回该牌，否则 null */
    removeFromHand(card: Card): Card | null {
        const idx = this._hand.indexOf(card);
        if (idx < 0) {
            return null;
        }
        return this._hand.splice(idx, 1)[0] ?? null;
    }

    /** 手牌中的牌移到抽牌堆顶 */
    moveHandCardToLibraryTop(card: Card): boolean {
        const removed = this.removeFromHand(card);
        if (removed == null) {
            return false;
        }
        this.putOnTopOfLibrary(removed);
        return true;
    }

    /** 手牌中的牌移到抽牌堆底 */
    moveHandCardToLibraryBottom(card: Card): boolean {
        const removed = this.removeFromHand(card);
        if (removed == null) {
            return false;
        }
        this.putOnBottomOfLibrary(removed);
        return true;
    }

    /** 手牌中的牌弃到弃牌堆顶；牌不在手牌中则 false */
    discardFromHand(card: Card): boolean {
        const removed = this.removeFromHand(card);
        if (removed == null) {
            return false;
        }
        this.putOnTopOfDiscard(removed);
        return true;
    }

    /** 手牌全部弃到弃牌堆顶；返回弃牌张数 */
    discardAllHand(): number {
        const cards = this._hand.splice(0);
        for (const card of cards) {
            this.putOnTopOfDiscard(card);
        }
        return cards.length;
    }

    /** 手牌中的牌移入消耗堆（堆顶）；牌不在手牌中则 false */
    exhaustFromHand(card: Card): boolean {
        const removed = this.removeFromHand(card);
        if (removed == null) {
            return false;
        }
        this._exhaust.push(removed);
        return true;
    }

    /** 指定堆当前张数 */
    getPileCount(pile: EDeckPile): number {
        return this.pileArray(pile).length;
    }

    /**
     * 从指定堆随机选 count 张。
     * @param remove true 时从原堆移出；false 时仅预览（不改动牌堆）
     */
    pickRandomFromPile(pile: EDeckPile, count: number, remove = true): Card[] {
        if (count <= 0) {
            return [];
        }
        const arr = this.pileArray(pile);
        const pickCount = Math.min(count, arr.length);
        if (pickCount === 0) {
            return [];
        }
        const indices = arr.map((_, i) => i);
        for (let i = 0; i < pickCount; i++) {
            const j = i + Math.floor(Math.random() * (indices.length - i));
            const tmp = indices[i];
            indices[i] = indices[j];
            indices[j] = tmp;
        }
        const picked = indices.slice(0, pickCount);
        if (!remove) {
            return picked.map((i) => arr[i]!);
        }
        picked.sort((a, b) => b - a);
        const result: Card[] = [];
        for (const i of picked) {
            const card = arr.splice(i, 1)[0];
            if (card != null) {
                result.push(card);
            }
        }
        return result;
    }

    /**
     * 将牌从一堆移到另一堆；牌不在 from 堆则 false。
     * 手牌移入时仍受 {@link BattleUtil.maxCardNum} 限制（移入失败且牌留在原堆）。
     */
    moveCardBetweenPiles(
        from: EDeckPile,
        to: EDeckPile,
        card: Card,
        position: 'top' | 'bottom' = 'top',
    ): boolean {
        const fromArr = this.pileArray(from);
        const idx = fromArr.indexOf(card);
        if (idx < 0) {
            return false;
        }
        if (to === EDeckPile.Hand && from !== EDeckPile.Hand && this._hand.length >= BattleUtil.maxCardNum) {
            return false;
        }
        const [removed] = fromArr.splice(idx, 1);
        if (removed == null) {
            return false;
        }
        this.insertIntoPile(to, removed, position);
        return true;
    }

    /** 查找牌当前所在堆；找不到则 null */
    findPileOfCard(card: Card): EDeckPile | null {
        if (this._library.includes(card)) {
            return EDeckPile.Library;
        }
        if (this._hand.includes(card)) {
            return EDeckPile.Hand;
        }
        if (this._discard.includes(card)) {
            return EDeckPile.Discard;
        }
        if (this._exhaust.includes(card)) {
            return EDeckPile.Exhaust;
        }
        return null;
    }

    /**
     * 从抽牌堆顶摸 count 张到手牌（顺序固定，不随机）。
     * 手牌已达上限、或 library+discard 均无牌可摸时提前结束；返回实际摸到的张数。
     */
    drawToHand(count: number): number {
        if (count <= 0) {
            return 0;
        }
        const maxHand = BattleUtil.maxCardNum;
        let drawn = 0;
        for (let i = 0; i < count; i++) {
            if (this._hand.length >= maxHand) {
                break;
            }
            if (this._library.length === 0) {
                this.recycleDiscardToLibrary();
            }
            if (this._library.length === 0) {
                break;
            }
            const card = this._library.pop();
            if (card == null) {
                break;
            }
            this._hand.push(card);
            drawn++;
        }
        return drawn;
    }

    resetToDefault(): void {
        this._library.length = 0;
        this._hand.length = 0;
        this._discard.length = 0;
        this._exhaust.length = 0;
    }

    private pileArray(pile: EDeckPile): Card[] {
        switch (pile) {
            case EDeckPile.Library:
                return this._library;
            case EDeckPile.Hand:
                return this._hand;
            case EDeckPile.Discard:
                return this._discard;
            case EDeckPile.Exhaust:
                return this._exhaust;
        }
    }

    private insertIntoPile(pile: EDeckPile, card: Card, position: 'top' | 'bottom'): void {
        const top = position === 'top';
        switch (pile) {
            case EDeckPile.Library:
                if (top) {
                    this.putOnTopOfLibrary(card);
                } else {
                    this.putOnBottomOfLibrary(card);
                }
                break;
            case EDeckPile.Hand:
                if (top) {
                    this._hand.push(card);
                } else {
                    this._hand.unshift(card);
                }
                break;
            case EDeckPile.Discard:
                if (top) {
                    this.putOnTopOfDiscard(card);
                } else {
                    this.putOnBottomOfDiscard(card);
                }
                break;
            case EDeckPile.Exhaust:
                if (top) {
                    this._exhaust.push(card);
                } else {
                    this._exhaust.unshift(card);
                }
                break;
        }
    }
}
