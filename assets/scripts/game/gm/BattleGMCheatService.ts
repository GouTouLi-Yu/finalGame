import { BattleFacade } from '../core/mvc/facade/battle/BattleFacade';
import { CardUtil } from '../core/mvc/util/CardUtil';

/**
 * 战斗手牌秘籍（GMConfig 首词查表 + 空格参数）。
 *
 * - addHandCard {cardId} {n}
 * - addRandHandCard {n}
 * - delRandCardByPos {n}
 * - delAllRandCard
 * - delRndCardById {cardId}
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
