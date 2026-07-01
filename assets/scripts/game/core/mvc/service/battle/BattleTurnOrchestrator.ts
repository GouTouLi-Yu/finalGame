import {
    IBattleUnitTurnEvent,
} from '../../model/battle/BattleActionBarModel';
import { BattleSession } from '../../model/battle/BattleSession';
import { EBattleSide } from '../../model/battle/EBattleSide';
import { IAutoPlayPolicy } from '../../policy/battle/IAutoPlayPolicy';
import { BattleAutoPlayUtil } from '../../util/BattleAutoPlayUtil';
import { BattleSnapshotUtil } from '../../util/BattleSnapshotUtil';

export interface IAdvanceActionBarOptions {
    /** 注入的自动出牌策略；null 时不自动出牌 */
    autoPlayPolicy?: IAutoPlayPolicy | null;
}

/**
 * 跑条推进后的回合结算（友方摸牌/出牌/轮次结束、敌方占位）。
 * Facade 只调此类，不写业务细节。
 */
export class BattleTurnOrchestrator {
    static advance(
        session: BattleSession,
        autoPlayPolicy: IAutoPlayPolicy | null,
        options?: IAdvanceActionBarOptions,
    ): IBattleUnitTurnEvent[] {
        const policy = options?.autoPlayPolicy ?? autoPlayPolicy;
        const events = session.actionBar.advance();
        if (events.length === 0) {
            return events;
        }

        const processed: IBattleUnitTurnEvent[] = [];
        let allyRoundClosed = false;

        for (const e of events) {
            if (e.side === EBattleSide.Ally) {
                if (allyRoundClosed) {
                    continue;
                }
                this.resolveAllyTurn(session, e, policy);
                processed.push(e);
                if (session.actionBar.isAllyRoundComplete()) {
                    session.onRoundEnd();
                    session.actionBar.resetAllyRoundActs();
                    allyRoundClosed = true;
                }
            } else {
                this.resolveEnemyTurn(e);
                processed.push(e);
            }
        }
        return processed;
    }

    private static resolveAllyTurn(
        session: BattleSession,
        e: IBattleUnitTurnEvent,
        policy: IAutoPlayPolicy | null,
    ): void {
        session.onUnitTurnStart(e.unitId);
        session.actionBar.markAllyActed(e.slotIndex);
        e.snapshotAfterTurn = BattleSnapshotUtil.capture(session);

        if (policy == null) {
            return;
        }
        const decision = policy.resolve(e.unitId, session.field);
        if (decision == null) {
            return;
        }
        e.autoPlayResults = BattleAutoPlayUtil.run(session, e.unitId, decision);
        e.snapshotAfterPlay = BattleSnapshotUtil.capture(session);
        if (e.autoPlayResults.length === 1) {
            e.playResult = e.autoPlayResults[0];
        }
    }

    private static resolveEnemyTurn(e: IBattleUnitTurnEvent): void {
        console.log(`[BattleTurn] 敌人回合 slot=${e.slotIndex} id=${e.unitId}`);
    }
}
