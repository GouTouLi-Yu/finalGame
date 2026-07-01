import { Card } from '../model/card/Card';
import { BattleModel, IBattlePlayCardResult } from '../model/battle/BattleModel';
import { IBattleFieldContext } from '../model/battle/IBattleFieldContext';
import { IBattleUnitStatusProvider } from '../model/battle/IBattleUnitStatusProvider';

/** 测试无 UI：每回合自动出 1 张（走完整选目标/扣费流程） */
export const BATTLE_TEST_AUTO_PLAY_COUNT = 1;

/**
 * 失控/混乱等自动出牌：随机选牌，魔力不足跳过，成功打出计 1 张直至 n 或手牌空。
 */
export class BattleAutoPlayUtil {
    /**
     * 是否本回合应自动出牌，以及目标张数 n。
     * @param testAutoPlay 无 UI 测试时为 true
     */
    static resolveAutoPlay(
        actorUnitId: string,
        status: IBattleUnitStatusProvider,
        testAutoPlay: boolean,
    ): { shouldAuto: boolean; playCount: number } {
        const confusionN = status.getOutOfControlPlayCount(actorUnitId);
        if (confusionN != null) {
            return { shouldAuto: true, playCount: confusionN };
        }
        if (testAutoPlay) {
            return { shouldAuto: true, playCount: BATTLE_TEST_AUTO_PLAY_COUNT };
        }
        return { shouldAuto: false, playCount: 0 };
    }

    static runAutoPlay(
        battle: BattleModel,
        field: IBattleFieldContext,
        actorUnitId: string,
        playCount: number,
        status: IBattleUnitStatusProvider,
    ): IBattlePlayCardResult[] {
        const results: IBattlePlayCardResult[] = [];
        if (playCount <= 0 || !status.canPlayCards(actorUnitId)) {
            return results;
        }

        let played = 0;
        let attempts = 0;
        const maxAttempts = Math.max(32, playCount * 8);

        while (played < playCount && attempts < maxAttempts) {
            attempts++;
            const hand = battle.deckModel.hand;
            if (hand.length === 0) {
                break;
            }
            if (!status.canPlayCards(actorUnitId)) {
                break;
            }

            const card = this.pickRandomCard(hand);
            if (card == null) {
                break;
            }

            const cost = battle.getCardManaCost(card.id);
            if (battle.mana < cost) {
                results.push({
                    ok: false,
                    cardId: card.id,
                    manaCost: cost,
                    actorUnitId,
                    reason: BattleModel.PLAY_FAIL_NO_MANA,
                });
                continue;
            }

            const res = battle.playCard({
                card,
                actorUnitId,
                field,
            });
            results.push(res);
            if (res.ok) {
                played++;
            } else if (res.reason === BattleModel.PLAY_FAIL_NO_TARGET) {
                continue;
            }
        }

        return results;
    }

    private static pickRandomCard(hand: readonly Card[]): Card | null {
        if (hand.length === 0) {
            return null;
        }
        const idx = Math.floor(Math.random() * hand.length);
        return hand[idx] ?? null;
    }
}
