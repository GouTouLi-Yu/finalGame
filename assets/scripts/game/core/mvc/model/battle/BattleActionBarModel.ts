import { AdventureDeployModel } from 'db://assets/scripts/game/core/mvc/model/adventure/AdventureDeployModel';
import { ArmyUtil } from 'db://assets/scripts/game/core/mvc/util/ArmyUtil';
import { BattleUtil } from 'db://assets/scripts/game/core/mvc/util/BattleUtil';
import { EnemyUtil } from 'db://assets/scripts/game/core/mvc/util/EnemyUtil';
import { EBattleSide } from 'db://assets/scripts/game/core/mvc/model/battle/BattleEnums';

/** 单位回合结束瞬间的战斗快照（友方 onUnitTurnStart 后、轮次结束前） */
export interface IBattleUnitTurnSnapshot {
    roundNumber: number;
    mana: number;
    hand: number;
    library: number;
    discard: number;
    total: number;
}

/** 跑条上一次推进产生的单位回合 */
export interface IBattleUnitTurnEvent {
    side: EBattleSide;
    /** 友方 0~3 上阵槽；敌人为 enemyIds 下标 */
    slotIndex: number;
    unitId: string;
    /** 仅友方：摸牌后（onUnitTurnStart 后、出牌/轮次结束前） */
    snapshotAfterTurn?: IBattleUnitTurnSnapshot;
    /** 仅友方且请求自动出牌时：打牌后的快照 */
    snapshotAfterPlay?: IBattleUnitTurnSnapshot;
    /** 仅友方且自动出牌时：本次单位回合内全部打牌尝试（含魔力不足跳过） */
    autoPlayResults?: IBattleUnitTurnPlayResult[];
    /** @deprecated 用 {@link autoPlayResults} */
    playResult?: IBattleUnitTurnPlayResult;
}

export interface IBattleUnitTurnPlayResult {
    ok: boolean;
    cardId?: string;
    manaCost: number;
    reason?: string;
    actorUnitId?: string;
    chosenTargetId?: string | null;
}

interface IActionBarUnit {
    side: EBattleSide;
    slotIndex: number;
    unitId: string;
    speed: number;
    remaining: number;
}

/** 跑条 UI 前瞻条目：单位行动 或 新轮次标记 */
export type IBattleSeqBarEntry =
    | { kind: 'unit'; side: EBattleSide; slotIndex: number; unitId: string }
    | { kind: 'round'; roundNumber: number };

export interface IBattleSeqBarForecastOptions {
    /** 当前轮次号（新轮次标记显示为 +1 后的值） */
    currentRound: number;
    /** 已到点、等待玩家操作的单位（尚未 markAllyActed） */
    pendingActor?: { side: EBattleSide; slotIndex: number; unitId: string } | null;
}

const REMAIN_EPS = 1e-4;

/**
 * 战斗跑条：按剩余距离/速度推进，到点获得单位回合。
 * 友方同时到 0 按上阵槽位；敌方按 ArmyConfig.enemyIds 顺序；友方优先于敌方。
 */
export class BattleActionBarModel {
    private _units: IActionBarUnit[] = [];
    /** 当前轮次内已行动过的友方槽位 */
    private _allyActedSlots = new Set<number>();

    get trackLength(): number {
        return BattleUtil.battleTrackLength;
    }

    /** 从冒险上阵槽与敌军 id 列表初始化（敌军速度读 EnemyConfig） */
    initFromDeploy(deploy: AdventureDeployModel, enemyIds: string[]): void {
        this.reset();
        const track = this.trackLength;
        for (const ally of deploy.getActiveCombatants()) {
            this._units.push({
                side: EBattleSide.Ally,
                slotIndex: ally.slotIndex,
                unitId: ally.heroId,
                speed: ally.speed,
                remaining: track,
            });
        }
        for (let i = 0; i < enemyIds.length; i++) {
            const configId = enemyIds[i];
            if (!configId) {
                continue;
            }
            this._units.push({
                side: EBattleSide.Enemy,
                slotIndex: i,
                unitId: ArmyUtil.makeEnemyInstanceId(configId, i),
                speed: EnemyUtil.getSpeed(configId),
                remaining: track,
            });
        }
    }

    /** 测试/验算用：直接指定友方与敌军速度 */
    initForTest(
        allies: { slotIndex: number; unitId: string; speed: number }[],
        enemies: { slotIndex: number; unitId: string; speed: number }[],
    ): void {
        this.reset();
        const track = this.trackLength;
        for (const a of allies) {
            this._units.push({
                side: EBattleSide.Ally,
                slotIndex: a.slotIndex,
                unitId: a.unitId,
                speed: a.speed,
                remaining: track,
            });
        }
        for (const e of enemies) {
            this._units.push({
                side: EBattleSide.Enemy,
                slotIndex: e.slotIndex,
                unitId: e.unitId,
                speed: e.speed,
                remaining: track,
            });
        }
    }

    /** 推进一次：计算 dt，到 0 者依次获得回合（同 dt 不二次推进） */
    advance(): IBattleUnitTurnEvent[] {
        if (this._units.length === 0) {
            return [];
        }
        const track = this.trackLength;
        let minDt = Infinity;
        for (const u of this._units) {
            if (u.speed <= 0 || u.remaining <= REMAIN_EPS) {
                if (u.remaining <= REMAIN_EPS) {
                    minDt = 0;
                }
                continue;
            }
            minDt = Math.min(minDt, u.remaining / u.speed);
        }
        if (!Number.isFinite(minDt)) {
            return [];
        }

        if (minDt > REMAIN_EPS) {
            for (const u of this._units) {
                u.remaining -= u.speed * minDt;
                if (u.remaining < REMAIN_EPS) {
                    u.remaining = 0;
                }
            }
        }

        const atZero = this._units.filter((u) => u.remaining <= REMAIN_EPS);
        if (atZero.length === 0) {
            return [];
        }

        atZero.sort((a, b) => {
            if (a.side !== b.side) {
                return a.side === EBattleSide.Ally ? -1 : 1;
            }
            return a.slotIndex - b.slotIndex;
        });

        const events: IBattleUnitTurnEvent[] = [];
        for (const u of atZero) {
            u.remaining = track;
            events.push({
                side: u.side,
                slotIndex: u.slotIndex,
                unitId: u.unitId,
            });
        }
        return events;
    }

    /** 友方单位回合结算后调用（须在 {@link isAllyRoundComplete} 之前逐人标记） */
    markAllyActed(slotIndex: number): void {
        this._allyActedSlots.add(slotIndex);
    }

    /** 跑条上所有友方槽位本轮是否都已至少行动一次 */
    isAllyRoundComplete(): boolean {
        let allyCount = 0;
        for (const u of this._units) {
            if (u.side !== EBattleSide.Ally) {
                continue;
            }
            allyCount++;
            if (!this._allyActedSlots.has(u.slotIndex)) {
                return false;
            }
        }
        return allyCount > 0;
    }

    /** 轮次结束后清空友方「本轮已动」标记（距离不重置） */
    resetAllyRoundActs(): void {
        this._allyActedSlots.clear();
    }

    /** 调试用：各单元剩余距离 */
    debugRemainings(): string {
        return this._units
            .map((u) => `${u.unitId}(${u.side}):${u.remaining.toFixed(2)}`)
            .join(' | ');
    }

    /**
     * 前瞻跑条 UI 序列（不修改当前状态）。
     * 含当前等待中的行动者，并在友方轮次结束处置入 round 标记。
     */
    forecastSeqBar(count: number, options: IBattleSeqBarForecastOptions): IBattleSeqBarEntry[] {
        const result: IBattleSeqBarEntry[] = [];
        if (count <= 0 || this._units.length === 0) {
            return result;
        }

        const units: IActionBarUnit[] = this._units.map((u) => ({ ...u }));
        const acted = new Set(this._allyActedSlots);
        let round = options.currentRound;

        const isAllyRoundComplete = (): boolean => {
            let allyCount = 0;
            for (const u of units) {
                if (u.side !== EBattleSide.Ally) {
                    continue;
                }
                allyCount++;
                if (!acted.has(u.slotIndex)) {
                    return false;
                }
            }
            return allyCount > 0;
        };

        const pushAfterAllyActed = (slotIndex: number): boolean => {
            acted.add(slotIndex);
            if (!isAllyRoundComplete()) {
                return false;
            }
            round += 1;
            if (result.length < count) {
                result.push({ kind: 'round', roundNumber: round });
            }
            acted.clear();
            return true;
        };

        const pending = options.pendingActor;
        if (pending != null && result.length < count) {
            result.push({
                kind: 'unit',
                side: pending.side,
                slotIndex: pending.slotIndex,
                unitId: pending.unitId,
            });
            if (pending.side === EBattleSide.Ally) {
                pushAfterAllyActed(pending.slotIndex);
            }
        }

        const track = this.trackLength;
        let guard = 0;
        while (result.length < count && guard++ < 256) {
            const events = this.simulateAdvanceOnce(units, track);
            if (events.length === 0) {
                break;
            }
            let allyRoundClosed = false;
            for (const e of events) {
                if (result.length >= count) {
                    break;
                }
                if (e.side === EBattleSide.Ally && allyRoundClosed) {
                    continue;
                }
                result.push({
                    kind: 'unit',
                    side: e.side,
                    slotIndex: e.slotIndex,
                    unitId: e.unitId,
                });
                if (e.side === EBattleSide.Ally && pushAfterAllyActed(e.slotIndex)) {
                    allyRoundClosed = true;
                }
            }
        }
        return result;
    }

    /** 对克隆单位列表执行一次与 {@link advance} 相同的推进（写克隆，不碰实况） */
    private simulateAdvanceOnce(
        units: IActionBarUnit[],
        track: number,
    ): { side: EBattleSide; slotIndex: number; unitId: string }[] {
        let minDt = Infinity;
        for (const u of units) {
            if (u.speed <= 0 || u.remaining <= REMAIN_EPS) {
                if (u.remaining <= REMAIN_EPS) {
                    minDt = 0;
                }
                continue;
            }
            minDt = Math.min(minDt, u.remaining / u.speed);
        }
        if (!Number.isFinite(minDt)) {
            return [];
        }

        if (minDt > REMAIN_EPS) {
            for (const u of units) {
                u.remaining -= u.speed * minDt;
                if (u.remaining < REMAIN_EPS) {
                    u.remaining = 0;
                }
            }
        }

        const atZero = units.filter((u) => u.remaining <= REMAIN_EPS);
        if (atZero.length === 0) {
            return [];
        }

        atZero.sort((a, b) => {
            if (a.side !== b.side) {
                return a.side === EBattleSide.Ally ? -1 : 1;
            }
            return a.slotIndex - b.slotIndex;
        });

        const events: { side: EBattleSide; slotIndex: number; unitId: string }[] = [];
        for (const u of atZero) {
            u.remaining = track;
            events.push({
                side: u.side,
                slotIndex: u.slotIndex,
                unitId: u.unitId,
            });
        }
        return events;
    }

    reset(): void {
        this._units.length = 0;
        this._allyActedSlots.clear();
    }
}
