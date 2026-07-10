import {
    IBattleUnitTurnEvent,
} from '../../model/battle/BattleActionBarModel';
import { BattleSession } from '../../model/battle/BattleSession';
import { EBattleSide } from '../../model/battle/BattleEnums';
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
 *
 * 友方若无自动出牌决策：进入「等待玩家」状态并暂停后续推进，直到 {@link finishPlayerTurn}。
 */
export class BattleTurnOrchestrator {
    static advance(
        session: BattleSession,
        autoPlayPolicy: IAutoPlayPolicy | null,
        options?: IAdvanceActionBarOptions,
    ): IBattleUnitTurnEvent[] {
        if (session.pendingPlayerTurn != null) {
            console.warn('[BattleTurn] 仍在等待玩家出牌，请先结束当前单位回合');
            return [];
        }

        const policy = options != null && 'autoPlayPolicy' in options
            ? (options.autoPlayPolicy ?? null)
            : autoPlayPolicy;
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
                const waitingPlayer = this.resolveAllyTurn(session, e, policy);
                processed.push(e);
                if (waitingPlayer) {
                    break;
                }
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

    /**
     * 玩家结束当前单位回合：标记已行动，必要时结算轮次。
     * @returns 是否成功结束
     */
    static finishPlayerTurn(session: BattleSession): boolean {
        const pending = session.pendingPlayerTurn;
        if (pending == null) {
            return false;
        }
        session.clearPendingPlayerTurn();
        session.actionBar.markAllyActed(pending.slotIndex);
        if (session.actionBar.isAllyRoundComplete()) {
            session.onRoundEnd();
            session.actionBar.resetAllyRoundActs();
        }
        return true;
    }

    /**
     * @returns true = 进入等待玩家，调用方应暂停后续事件
     */
    private static resolveAllyTurn(
        session: BattleSession,
        e: IBattleUnitTurnEvent,
        policy: IAutoPlayPolicy | null,
    ): boolean {
        session.onUnitTurnStart(e.unitId);
        e.snapshotAfterTurn = BattleSnapshotUtil.capture(session);

        if (policy != null) {
            const decision = policy.resolve(e.unitId, session.field);
            if (decision != null) {
                session.actionBar.markAllyActed(e.slotIndex);
                e.autoPlayResults = BattleAutoPlayUtil.run(session, e.unitId, decision);
                e.snapshotAfterPlay = BattleSnapshotUtil.capture(session);
                if (e.autoPlayResults.length === 1) {
                    e.playResult = e.autoPlayResults[0];
                }
                return false;
            }
        }

        // 无自动出牌 → 等玩家手操
        session.setPendingPlayerTurn(e.unitId, e.slotIndex);
        return true;
    }

    private static resolveEnemyTurn(e: IBattleUnitTurnEvent): void {
        console.log(`[BattleTurn] 敌人回合 slot=${e.slotIndex} id=${e.unitId}`);
    }
}
