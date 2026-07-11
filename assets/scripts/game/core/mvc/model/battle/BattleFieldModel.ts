import { AdventureDeployModel } from '../adventure/AdventureDeployModel';
import { ArmyUtil } from '../../util/ArmyUtil';
import { EnemyUtil } from '../../util/EnemyUtil';
import { EElementType } from '../element/ElementType';
import { EBattleSide } from './BattleEnums';

/** 场上单位运行时 */
export interface IBattleUnitRuntime {
    unitId: string;
    side: EBattleSide;
    slotIndex: number;
    speed: number;
    silenced: boolean;
    /** 失控/混乱：本回合自动出牌张数 n */
    outOfControlPlayCount: number;
    /** 当前生命 */
    currentHp: number;
    /** 最大生命 */
    maxHp: number;
    /** 当前脆弱值（满=maxWeak，条 progress=1） */
    currentWeak: number;
    /** 最大脆弱值（EnemyConfig.weak） */
    maxWeak: number;
    /** Buff 种类 id 列表（有序，种类数=length） */
    buffIds: string[];
    /** 元素印记种类列表（有序，种类数=length） */
    elementMarks: EElementType[];
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
            this._units.set(c.heroId, this.createUnit({
                unitId: c.heroId,
                side: EBattleSide.Ally,
                slotIndex: c.slotIndex,
                speed: c.speed,
                maxHp: 0,
                maxWeak: 0,
            }));
        }
        for (let i = 0; i < enemyIds.length; i++) {
            const configId = enemyIds[i];
            if (!configId) {
                continue;
            }
            const unitId = ArmyUtil.makeEnemyInstanceId(configId, i);
            const maxHp = EnemyUtil.getHp(configId);
            const maxWeak = EnemyUtil.getWeak(configId);
            this._units.set(unitId, this.createUnit({
                unitId,
                side: EBattleSide.Enemy,
                slotIndex: i,
                speed: enemySpeedOf(configId),
                maxHp,
                maxWeak,
            }));
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

    /** 设置当前生命（夹到 0~maxHp） */
    setCurrentHp(unitId: string, hp: number): void {
        const u = this._units.get(unitId);
        if (u == null) {
            return;
        }
        const v = Number.isFinite(hp) ? hp : 0;
        u.currentHp = Math.max(0, Math.min(u.maxHp, v));
    }

    /** 扣血；返回实际扣除量 */
    damageHp(unitId: string, amount: number): number {
        const u = this._units.get(unitId);
        if (u == null || amount <= 0) {
            return 0;
        }
        const before = u.currentHp;
        u.currentHp = Math.max(0, u.currentHp - amount);
        return before - u.currentHp;
    }

    /** 设置当前脆弱（夹到 0~maxWeak） */
    setCurrentWeak(unitId: string, weak: number): void {
        const u = this._units.get(unitId);
        if (u == null) {
            return;
        }
        const v = Number.isFinite(weak) ? weak : 0;
        u.currentWeak = Math.max(0, Math.min(u.maxWeak, v));
    }

    /**
     * 用卡牌元素整体替换目标身上的元素印记（去重保序）。
     * 以后可扩展保留旧印记 / 附加施法者印记等机制。
     */
    replaceElementMarks(unitId: string, elements: readonly EElementType[]): void {
        const u = this._units.get(unitId);
        if (u == null) {
            return;
        }
        const seen = new Set<EElementType>();
        const next: EElementType[] = [];
        for (const e of elements) {
            if (seen.has(e)) {
                continue;
            }
            seen.add(e);
            next.push(e);
        }
        u.elementMarks = next;
    }

    /** 追加 buff 种类（已存在则不重复） */
    addBuff(unitId: string, buffId: string): boolean {
        const u = this._units.get(unitId);
        const id = buffId?.trim() ?? '';
        if (u == null || id === '' || u.buffIds.includes(id)) {
            return false;
        }
        u.buffIds.push(id);
        return true;
    }

    removeBuff(unitId: string, buffId: string): boolean {
        const u = this._units.get(unitId);
        if (u == null) {
            return false;
        }
        const i = u.buffIds.indexOf(buffId);
        if (i < 0) {
            return false;
        }
        u.buffIds.splice(i, 1);
        return true;
    }

    clearBuffs(): void {
        for (const u of this._units.values()) {
            u.silenced = false;
            u.outOfControlPlayCount = 0;
            u.buffIds = [];
        }
    }

    reset(): void {
        this._units.clear();
    }

    private createUnit(p: {
        unitId: string;
        side: EBattleSide;
        slotIndex: number;
        speed: number;
        maxHp: number;
        maxWeak: number;
    }): IBattleUnitRuntime {
        return {
            unitId: p.unitId,
            side: p.side,
            slotIndex: p.slotIndex,
            speed: p.speed,
            silenced: false,
            outOfControlPlayCount: 0,
            maxHp: p.maxHp,
            currentHp: p.maxHp,
            maxWeak: p.maxWeak,
            currentWeak: p.maxWeak,
            buffIds: [],
            elementMarks: [],
        };
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
