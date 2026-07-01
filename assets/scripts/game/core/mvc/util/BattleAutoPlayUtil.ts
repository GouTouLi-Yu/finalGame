import { Card } from '../model/card/Card';
import { BattleSession } from '../model/battle/BattleSession';
import { EBattlePlayFail, IBattlePlayCardResult } from '../model/battle/BattleTypes';
import { IAutoPlayDecision } from '../policy/battle/IAutoPlayPolicy';
import { BattlePlayService } from '../service/battle/BattlePlayService';
import { CardUtil } from './CardUtil';

/**
 * 失控/混乱等自动出牌：随机选牌，魔力不足跳过，成功打出计 1 张直至 n 或手牌空。
 */
export class BattleAutoPlayUtil {
    static run(session: BattleSession, actorUnitId: string, decision: IAutoPlayDecision): IBattlePlayCardResult[] {
        const results: IBattlePlayCardResult[] = [];
        const playCount = decision.playCount;
        if (playCount <= 0 || !session.field.canPlayCards(actorUnitId)) {
            return results;
        }

        let played = 0;
        let attempts = 0;

        while (played < playCount) {
            const hand = session.deck.hand;
            if (hand.length === 0) {
                break;
            }
            if (!session.field.canPlayCards(actorUnitId)) {
                break;
            }
            if (session.mana <= 0 || !this.hasAffordableCard(hand, session.mana)) {
                break;
            }

            const maxAttempts = Math.max(4, hand.length * 2);
            if (attempts >= maxAttempts) {
                break;
            }
            attempts++;

            const card = session.rng.pickOne(hand as Card[]);
            if (card == null) {
                break;
            }

            const cost = CardUtil.getManaPoint(card.id);
            if (session.mana < cost) {
                continue;
            }

            const res = BattlePlayService.play(session, { card, actorUnitId });
            results.push(res);
            if (res.ok) {
                played++;
            } else if (res.reason === EBattlePlayFail.NO_TARGET) {
                continue;
            } else {
                break;
            }
        }

        return results;
    }

    private static hasAffordableCard(hand: readonly Card[], mana: number): boolean {
        for (const c of hand) {
            if (CardUtil.getManaPoint(c.id) <= mana) {
                return true;
            }
        }
        return false;
    }
}
