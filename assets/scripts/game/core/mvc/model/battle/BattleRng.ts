/**
 * 确定性 RNG（mulberry32）。战斗内随机应读此实例，勿直接用 Math.random。
 * 同一 seed + 同一操作序列 → 洗牌/选目标/自动出牌一致。
 */
export class BattleRng {
    private _state: number;

    constructor(seed: number) {
        this._state = seed >>> 0;
    }

    get seed(): number {
        return this._state;
    }

    /** [0, 1) */
    next(): number {
        this._state = (this._state + 0x6d2b79f5) >>> 0;
        let t = this._state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** [0, maxExclusive) */
    nextInt(maxExclusive: number): number {
        if (maxExclusive <= 0) {
            return 0;
        }
        return Math.floor(this.next() * maxExclusive);
    }

    pickOne<T>(items: readonly T[]): T | null {
        if (items.length === 0) {
            return null;
        }
        return items[this.nextInt(items.length)] ?? null;
    }
}
