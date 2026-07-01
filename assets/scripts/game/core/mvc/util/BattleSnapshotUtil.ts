import { IBattleUnitTurnSnapshot } from '../model/battle/BattleActionBarModel';
import { BattleSession } from '../model/battle/BattleSession';

export class BattleSnapshotUtil {
    static capture(session: BattleSession): IBattleUnitTurnSnapshot {
        const d = session.deck;
        return {
            roundNumber: session.roundNumber,
            mana: session.mana,
            hand: d.hand.length,
            library: d.library.length,
            discard: d.discard.length,
            total: d.totalCount,
        };
    }
}
