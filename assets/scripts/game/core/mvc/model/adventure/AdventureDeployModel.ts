import { IAdventureDeploySaveData, IDeploySlotSaveData } from '../../../../save/PlayerSaveData';

export const ADVENTURE_ACTIVE_SLOT_COUNT = 4;
export const ADVENTURE_BENCH_SLOT_COUNT = 6;

/** 上阵槽状态（等级属于槽位，不属于角色） */
export interface IDeploySlotState {
    level: number;
    heroId: string | null;
    /** 进冒险选角时 roll 的速度；空槽为 0 */
    speed: number;
}

/** 进入战斗时友方跑条单位 */
export interface IDeployCombatant {
    slotIndex: number;
    heroId: string;
    level: number;
    speed: number;
}

/**
 * 冒险编队：4 上阵 + 6 场下。
 * 等级在槽位上；角色换槽后使用目标槽等级。
 */
export class AdventureDeployModel {
    private _active: IDeploySlotState[] = [];
    private _bench: IDeploySlotState[] = [];

    constructor() {
        this.resetToDefault();
    }

    get activeSlots(): readonly IDeploySlotState[] {
        return this._active;
    }

    get benchSlots(): readonly IDeploySlotState[] {
        return this._bench;
    }

    /** 放置到上阵槽（覆盖该槽英雄；速度为选角时 roll 值） */
    assignHeroToActive(slotIndex: number, heroId: string, speed: number, level?: number): void {
        if (slotIndex < 0 || slotIndex >= ADVENTURE_ACTIVE_SLOT_COUNT) {
            return;
        }
        const slot = this._active[slotIndex];
        if (level != null) {
            slot.level = level;
        }
        slot.heroId = heroId;
        slot.speed = speed;
    }

    /** 英雄从上阵/场下换到另一槽，继承目标槽等级 */
    moveHeroToSlot(heroId: string, toActive: boolean, toIndex: number): boolean {
        const from = this.findSlotOfHero(heroId);
        if (from == null) {
            return false;
        }
        const targetList = toActive ? this._active : this._bench;
        if (toIndex < 0 || toIndex >= targetList.length) {
            return false;
        }
        const srcList = from.isActive ? this._active : this._bench;
        const src = srcList[from.index];
        const dst = targetList[toIndex];
        if (dst.heroId != null && dst.heroId !== heroId) {
            return false;
        }
        dst.heroId = heroId;
        dst.speed = src.speed;
        src.heroId = null;
        src.speed = 0;
        return true;
    }

    findSlotOfHero(heroId: string): { isActive: boolean; index: number } | null {
        for (let i = 0; i < this._active.length; i++) {
            if (this._active[i].heroId === heroId) {
                return { isActive: true, index: i };
            }
        }
        for (let i = 0; i < this._bench.length; i++) {
            if (this._bench[i].heroId === heroId) {
                return { isActive: false, index: i };
            }
        }
        return null;
    }

    /** 已上阵且有效的友方（战斗跑条用） */
    getActiveCombatants(): IDeployCombatant[] {
        const list: IDeployCombatant[] = [];
        for (let i = 0; i < this._active.length; i++) {
            const s = this._active[i];
            if (s.heroId == null || s.speed <= 0) {
                continue;
            }
            list.push({
                slotIndex: i,
                heroId: s.heroId,
                level: s.level,
                speed: s.speed,
            });
        }
        return list;
    }

    resetToDefault(): void {
        this._active = [];
        this._bench = [];
        for (let i = 0; i < ADVENTURE_ACTIVE_SLOT_COUNT; i++) {
            this._active.push({ level: 1, heroId: null, speed: 0 });
        }
        for (let i = 0; i < ADVENTURE_BENCH_SLOT_COUNT; i++) {
            this._bench.push({ level: 1, heroId: null, speed: 0 });
        }
    }

    synchronize(data: IAdventureDeploySaveData | null | undefined): void {
        if (data == null) {
            this.resetToDefault();
            return;
        }
        this._active = this.hydrateSlots(data.active, ADVENTURE_ACTIVE_SLOT_COUNT);
        this._bench = this.hydrateSlots(data.bench, ADVENTURE_BENCH_SLOT_COUNT);
    }

    getSaveData(): IAdventureDeploySaveData {
        return {
            active: this._active.map((s) => ({ ...s })),
            bench: this._bench.map((s) => ({ ...s })),
        };
    }

    private hydrateSlots(raw: IDeploySlotSaveData[] | undefined, count: number): IDeploySlotState[] {
        const out: IDeploySlotState[] = [];
        for (let i = 0; i < count; i++) {
            const s = raw?.[i];
            out.push({
                level: s?.level ?? 1,
                heroId: s?.heroId ?? null,
                speed: s?.speed ?? 0,
            });
        }
        return out;
    }
}
