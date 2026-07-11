import { BattleFacade } from '../core/mvc/facade/battle/BattleFacade';
import { CardUtil } from '../core/mvc/util/CardUtil';

/**
 * 战斗秘籍（GMConfig 首词查表 + 空格参数）。
 *
 * 手牌：
 * - addHandCard {cardId} {n}
 * - addRandHandCard {n}
 * - delRandCardByPos {n}
 * - delAllRandCard
 * - delRndCardById {cardId}
 *
 * 抽牌堆 / 摸牌 / 弃牌 / 魔力：
 * - addDrawCard {cardId} {n}
 * - addRandDrawCard {n}
 * - clearDrawPile
 * - drawCards {n}
 * - addDiscardCard {cardId} {n}
 * - recycleDiscard
 * - shuffleDraw
 * - setMana {n}
 * - addMana {n}
 * - printDeck
 */
export class BattleGMCheatService {
    /** addHandCard card_001 3 */
    static addHandCard(args: unknown): void {
        const [cardId, nStr] = BattleGMCheatService.parseArgs(args, 2);
        if (cardId == null || nStr == null) {
            BattleGMCheatService.logUsage('addHandCard', 'addHandCard card_001 3');
            return;
        }
        const n = parseInt(nStr, 10);
        const added = BattleFacade.getInstance().cheatAddHandCard(cardId, n);
        console.log(
            `[GM] addHandCard ${cardId} ${n} → 实际添加 ${added} 张，当前手牌 ${BattleGMCheatService.handCount()}`,
        );
    }

    /** addRandHandCard 2 */
    static addRandHandCard(args: unknown): void {
        const [nStr] = BattleGMCheatService.parseArgs(args, 1);
        if (nStr == null) {
            BattleGMCheatService.logUsage('addRandHandCard', 'addRandHandCard 2');
            return;
        }
        const n = parseInt(nStr, 10);
        const added = BattleFacade.getInstance().cheatAddRandomHandCard(n);
        console.log(
            `[GM] addRandHandCard ${n} → 实际添加 ${added} 张，当前手牌 ${BattleGMCheatService.handCount()}`,
        );
    }

    /** delRandCardByPos 1 */
    static delRandCardByPos(args: unknown): void {
        const [posStr] = BattleGMCheatService.parseArgs(args, 1);
        if (posStr == null) {
            BattleGMCheatService.logUsage('delRandCardByPos', 'delRandCardByPos 1');
            return;
        }
        const pos = parseInt(posStr, 10);
        const ok = BattleFacade.getInstance().cheatRemoveHandAtPosition(pos);
        console.log(
            `[GM] delRandCardByPos ${pos} → ${ok ? '已删除' : '无效'}，当前手牌 ${BattleGMCheatService.handCount()}`,
        );
    }

    /** delAllRandCard */
    static delAllRandCard(_args?: unknown): void {
        const n = BattleFacade.getInstance().cheatClearHand();
        console.log(`[GM] delAllRandCard → 删除 ${n} 张，当前手牌 ${BattleGMCheatService.handCount()}`);
    }

    /** delRndCardById card_001 */
    static delRndCardById(args: unknown): void {
        const [cardId] = BattleGMCheatService.parseArgs(args, 1);
        if (cardId == null) {
            BattleGMCheatService.logUsage('delRndCardById', 'delRndCardById card_001');
            return;
        }
        if (!CardUtil.isValidCardId(cardId)) {
            console.warn(`[GM] delRndCardById 无效卡牌 id: ${cardId}`);
            return;
        }
        const n = BattleFacade.getInstance().cheatRemoveHandByCardId(cardId);
        console.log(
            `[GM] delRndCardById ${cardId} → 删除 ${n} 张，当前手牌 ${BattleGMCheatService.handCount()}`,
        );
    }

    /** addDrawCard card_001 5 */
    static addDrawCard(args: unknown): void {
        const [cardId, nStr] = BattleGMCheatService.parseArgs(args, 2);
        if (cardId == null || nStr == null) {
            BattleGMCheatService.logUsage('addDrawCard', 'addDrawCard card_001 5');
            return;
        }
        const n = parseInt(nStr, 10);
        const added = BattleFacade.getInstance().cheatAddDrawCard(cardId, n);
        console.log(`[GM] addDrawCard ${cardId} ${n} → 实际添加 ${added} 张`);
        BattleFacade.getInstance().cheatPrintDeck();
    }

    /** addRandDrawCard 5 */
    static addRandDrawCard(args: unknown): void {
        const [nStr] = BattleGMCheatService.parseArgs(args, 1);
        if (nStr == null) {
            BattleGMCheatService.logUsage('addRandDrawCard', 'addRandDrawCard 5');
            return;
        }
        const n = parseInt(nStr, 10);
        const added = BattleFacade.getInstance().cheatAddRandomDrawCard(n);
        console.log(`[GM] addRandDrawCard ${n} → 实际添加 ${added} 张`);
        BattleFacade.getInstance().cheatPrintDeck();
    }

    /** clearDrawPile */
    static clearDrawPile(_args?: unknown): void {
        const n = BattleFacade.getInstance().cheatClearDrawPile();
        console.log(`[GM] clearDrawPile → 抽牌堆弃入弃牌堆 ${n} 张`);
        BattleFacade.getInstance().cheatPrintDeck();
    }

    /** drawCards 3 */
    static drawCards(args: unknown): void {
        const [nStr] = BattleGMCheatService.parseArgs(args, 1);
        if (nStr == null) {
            BattleGMCheatService.logUsage('drawCards', 'drawCards 3');
            return;
        }
        const n = parseInt(nStr, 10);
        const drawn = BattleFacade.getInstance().cheatDrawCards(n);
        console.log(`[GM] drawCards ${n} → 实际摸到 ${drawn} 张，手牌 ${BattleGMCheatService.handCount()}`);
        BattleFacade.getInstance().cheatPrintDeck();
    }

    /** addDiscardCard card_001 3 */
    static addDiscardCard(args: unknown): void {
        const [cardId, nStr] = BattleGMCheatService.parseArgs(args, 2);
        if (cardId == null || nStr == null) {
            BattleGMCheatService.logUsage('addDiscardCard', 'addDiscardCard card_001 3');
            return;
        }
        const n = parseInt(nStr, 10);
        const added = BattleFacade.getInstance().cheatAddDiscardCard(cardId, n);
        console.log(`[GM] addDiscardCard ${cardId} ${n} → 实际添加 ${added} 张`);
        BattleFacade.getInstance().cheatPrintDeck();
    }

    /** recycleDiscard */
    static recycleDiscard(_args?: unknown): void {
        const n = BattleFacade.getInstance().cheatRecycleDiscard();
        console.log(`[GM] recycleDiscard → 回收弃牌 ${n} 张进抽牌堆`);
        BattleFacade.getInstance().cheatPrintDeck();
    }

    /** shuffleDraw */
    static shuffleDraw(_args?: unknown): void {
        const n = BattleFacade.getInstance().cheatShuffleDrawPile();
        console.log(`[GM] shuffleDraw → 已洗抽牌堆（${n} 张）`);
    }

    /** setMana 99 */
    static setMana(args: unknown): void {
        const [nStr] = BattleGMCheatService.parseArgs(args, 1);
        if (nStr == null) {
            BattleGMCheatService.logUsage('setMana', 'setMana 99');
            return;
        }
        const mana = BattleFacade.getInstance().cheatSetMana(parseInt(nStr, 10));
        console.log(`[GM] setMana → 当前魔力 ${mana}`);
    }

    /** addMana 5 */
    static addMana(args: unknown): void {
        const [nStr] = BattleGMCheatService.parseArgs(args, 1);
        if (nStr == null) {
            BattleGMCheatService.logUsage('addMana', 'addMana 5');
            return;
        }
        const mana = BattleFacade.getInstance().cheatAddMana(parseInt(nStr, 10));
        console.log(`[GM] addMana → 当前魔力 ${mana}`);
    }

    /** printDeck */
    static printDeck(_args?: unknown): void {
        BattleFacade.getInstance().cheatPrintDeck();
    }

    private static parseArgs(args: unknown, minLen: number): string[] {
        let list: string[] = [];
        if (Array.isArray(args)) {
            list = args.map((v) => String(v ?? '').trim()).filter(Boolean);
        } else if (typeof args === 'string' && args.trim()) {
            list = args.trim().split(/\s+/);
        }
        if (list.length < minLen) {
            return [];
        }
        return list;
    }

    private static logUsage(name: string, example: string): void {
        console.warn(`[GM] 用法: ${example}`);
    }

    private static handCount(): number {
        return BattleFacade.getInstance().session?.deck.hand.length ?? 0;
    }
}
