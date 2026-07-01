import { AdventureDeployModel } from 'db://assets/scripts/game/core/mvc/model/adventure/AdventureDeployModel';
import { BattleUtil } from 'db://assets/scripts/game/core/mvc/util/BattleUtil';
import { EnemyUtil } from 'db://assets/scripts/game/core/mvc/util/EnemyUtil';
import { EBattleSide } from 'db://assets/scripts/game/core/mvc/model/battle/EBattleSide';

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
            const id = enemyIds[i];
            if (!id) {
                continue;
            }
            this._units.push({
                side: EBattleSide.Enemy,
                slotIndex: i,
                unitId: id,
                speed: EnemyUtil.getSpeed(id),
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

    reset(): void {
        this._units.length = 0;
        this._allyActedSlots.clear();
    }
}
