import { AdventureDeployModel } from '../adventure/AdventureDeployModel';
import { EBattleSide } from './EBattleSide';

/** 场上单位运行时（hp/属性以后在此扩展） */
export interface IBattleUnitRuntime {
    unitId: string;
    side: EBattleSide;
    slotIndex: number;
    speed: number;
    silenced: boolean;
    /** 失控/混乱：本回合自动出牌张数 n */
    outOfControlPlayCount: number;
}

/** 选目标用语义（chooseTarget 用） */
export interface IBattleTargetPools {
    allyUnitIds: readonly string[];
    enemyUnitIds: readonly string[];
}

/**
 * 战场单位与 buff 的唯一真相源。
 * 跑条、选目标、出牌检查均读此 Model。
 */
export class BattleFieldModel {
    private _units = new Map<string, IBattleUnitRuntime>();

    get units(): ReadonlyMap<string, IBattleUnitRuntime> {
        return this._units;
    }

    get allyUnitIds(): readonly string[] {
        return this.idsBySide(EBattleSide.Ally);
    }

    get enemyUnitIds(): readonly string[] {
        return this.idsBySide(EBattleSide.Enemy);
    }

    getTargetPools(): IBattleTargetPools {
        return { allyUnitIds: this.allyUnitIds, enemyUnitIds: this.enemyUnitIds };
    }

    initFromDeploy(deploy: AdventureDeployModel, enemyIds: string[], enemySpeedOf: (id: string) => number): void {
        this._units.clear();
        for (const c of deploy.getActiveCombatants()) {
            this._units.set(c.heroId, {
                unitId: c.heroId,
                side: EBattleSide.Ally,
                slotIndex: c.slotIndex,
                speed: c.speed,
                silenced: false,
                outOfControlPlayCount: 0,
            });
        }
        for (let i = 0; i < enemyIds.length; i++) {
            const id = enemyIds[i];
            if (!id) {
                continue;
            }
            this._units.set(id, {
                unitId: id,
                side: EBattleSide.Enemy,
                slotIndex: i,
                speed: enemySpeedOf(id),
                silenced: false,
                outOfControlPlayCount: 0,
            });
        }
    }

    getUnit(unitId: string): IBattleUnitRuntime | undefined {
        return this._units.get(unitId);
    }

    canPlayCards(unitId: string): boolean {
        const u = this._units.get(unitId);
        return u != null && !u.silenced;
    }

    getOutOfControlPlayCount(unitId: string): number | null {
        const n = this._units.get(unitId)?.outOfControlPlayCount ?? 0;
        return n > 0 ? n : null;
    }

    setSilenced(unitId: string, on: boolean): void {
        const u = this._units.get(unitId);
        if (u != null) {
            u.silenced = on;
        }
    }

    setOutOfControl(unitId: string, playCount: number | null): void {
        const u = this._units.get(unitId);
        if (u == null) {
            return;
        }
        u.outOfControlPlayCount = playCount != null && playCount > 0 ? playCount : 0;
    }

    clearBuffs(): void {
        for (const u of this._units.values()) {
            u.silenced = false;
            u.outOfControlPlayCount = 0;
        }
    }

    reset(): void {
        this._units.clear();
    }

    private idsBySide(side: EBattleSide): string[] {
        const ids: string[] = [];
        for (const u of this._units.values()) {
            if (u.side === side) {
                ids.push(u.unitId);
            }
        }
        return ids;
    }
}
