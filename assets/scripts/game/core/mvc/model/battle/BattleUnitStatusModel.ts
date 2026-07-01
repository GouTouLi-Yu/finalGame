import { IBattleUnitStatusProvider } from './IBattleUnitStatusProvider';

/** 战斗内单位 buff 运行时（可先挂 Facade，以后并入 Entity） */
export class BattleUnitStatusModel implements IBattleUnitStatusProvider {
    private _silenced = new Set<string>();
    private _outOfControlPlayCount = new Map<string, number>();

    canPlayCards(unitId: string): boolean {
        return !this._silenced.has(unitId);
    }

    getOutOfControlPlayCount(unitId: string): number | null {
        const n = this._outOfControlPlayCount.get(unitId);
        return n != null && n > 0 ? n : null;
    }

    setSilenced(unitId: string, on: boolean): void {
        if (on) {
            this._silenced.add(unitId);
        } else {
            this._silenced.delete(unitId);
        }
    }

    /** 失控/混乱：该单位回合内自动随机打出最多 n 张 */
    setOutOfControl(unitId: string, playCount: number | null): void {
        if (playCount == null || playCount <= 0) {
            this._outOfControlPlayCount.delete(unitId);
            return;
        }
        this._outOfControlPlayCount.set(unitId, playCount);
    }

    clearAll(): void {
        this._silenced.clear();
        this._outOfControlPlayCount.clear();
    }
}
