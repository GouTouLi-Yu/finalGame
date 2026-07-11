import { Prefab } from 'cc';
import { EBundleType, ResManager } from '../manager/ResManager';
import {
    BattleAnimCatalog,
    EBattleAnimAction,
    EBattleAnimHeat,
    IBattleAnimUnitRef,
    TBattleAnimRootType,
} from './BattleAnimCatalog';

export interface IBattleAnimLoadTask {
    rootType: TBattleAnimRootType;
    animPath: string;
    action: EBattleAnimAction;
    heat: EBattleAnimHeat;
    /** 越大越先加载 */
    priority: number;
}

interface ICacheEntry {
    prefab: Prefab;
    key: string;
    heat: EBattleAnimHeat;
    lastUsedAt: number;
    rootType: TBattleAnimRootType;
    animPath: string;
    action: EBattleAnimAction;
}

/**
 * 战斗动画加载调度（Phase 1）：
 * - 限流并发
 * - 热动作优先
 * - 失败不抛死，返回 false
 *
 * Phase 2 再接跑条前瞻 / 忙闲门闩 / LRU。
 */
export class BattleAnimLoadScheduler {
    static readonly MAX_CONCURRENT = 2;

    private static _queue: IBattleAnimLoadTask[] = [];
    private static _inflight = 0;
    private static _busy = false;
    private static _cache = new Map<string, ICacheEntry>();
    private static _loadingKeys = new Set<string>();

    static cacheKey(rootType: TBattleAnimRootType, animPath: string, action: EBattleAnimAction): string {
        return `${rootType}/${animPath}/${action}`;
    }

    static has(rootType: TBattleAnimRootType, animPath: string, action: EBattleAnimAction): boolean {
        return this._cache.has(this.cacheKey(rootType, animPath, action));
    }

    static getPrefab(
        rootType: TBattleAnimRootType,
        animPath: string,
        action: EBattleAnimAction,
    ): Prefab | null {
        const entry = this._cache.get(this.cacheKey(rootType, animPath, action));
        if (entry == null) {
            return null;
        }
        entry.lastUsedAt = Date.now();
        return entry.prefab;
    }

    /** 战斗忙（施法中等）时暂停新开加载 */
    static setBusy(busy: boolean): void {
        this._busy = busy;
        if (!busy) {
            this.pump();
        }
    }

    static isBusy(): boolean {
        return this._busy;
    }

    /**
     * 入队；已缓存或正在加载则跳过。
     * @returns 是否新入队
     */
    static enqueue(task: IBattleAnimLoadTask): boolean {
        const key = this.cacheKey(task.rootType, task.animPath, task.action);
        if (this._cache.has(key) || this._loadingKeys.has(key)) {
            return false;
        }
        if (this._queue.some((t) => this.cacheKey(t.rootType, t.animPath, t.action) === key)) {
            for (const t of this._queue) {
                if (this.cacheKey(t.rootType, t.animPath, t.action) === key) {
                    t.priority = Math.max(t.priority, task.priority);
                }
            }
            this._queue.sort((a, b) => b.priority - a.priority);
            return false;
        }
        this._queue.push(task);
        this._queue.sort((a, b) => b.priority - a.priority);
        this.pump();
        return true;
    }

    /** 为若干单位排队热动作（开战预载） */
    static enqueueHotForUnits(units: readonly IBattleAnimUnitRef[], basePriority = 100): void {
        for (const u of units) {
            for (const action of BattleAnimCatalog.HOT_ACTIONS) {
                this.enqueue({
                    rootType: u.rootType,
                    animPath: u.animPath,
                    action,
                    heat: EBattleAnimHeat.Hot,
                    priority: basePriority,
                });
            }
        }
    }

    /**
     * 为友方排队半热动作：prepStart/Idle/Back + usingMagic。
     * 冒险遇战事件时与 hot 一并预载；敌方不排队。
     */
    static enqueueWarmForAllyUnits(units: readonly IBattleAnimUnitRef[], basePriority = 80): void {
        for (const u of units) {
            if (u.rootType !== 'character') {
                continue;
            }
            for (const action of BattleAnimCatalog.WARM_ACTIONS) {
                this.enqueue({
                    rootType: u.rootType,
                    animPath: u.animPath,
                    action,
                    heat: EBattleAnimHeat.Warm,
                    priority: basePriority,
                });
            }
        }
    }

    /** 热 + 友方预备/出牌一并入队 */
    static enqueueBattleAnimsForUnits(units: readonly IBattleAnimUnitRef[], basePriority = 100): void {
        this.enqueueHotForUnits(units, basePriority);
        this.enqueueWarmForAllyUnits(units, basePriority - 20);
    }

    /** 等待队列清空（含进行中）；超时不抛错 */
    static async waitIdle(timeoutMs = 15000): Promise<void> {
        const start = Date.now();
        while (this._queue.length > 0 || this._inflight > 0) {
            if (Date.now() - start > timeoutMs) {
                console.warn(
                    `[战斗动画加载] waitIdle 超时 queue=${this._queue.length} inflight=${this._inflight}`,
                );
                return;
            }
            await new Promise<void>((r) => setTimeout(r, 50));
        }
    }

    /** 预载热动作 + 友方预备/出牌并等待 */
    static async preloadBattleAnims(units: readonly IBattleAnimUnitRef[]): Promise<void> {
        if (units.length === 0) {
            return;
        }
        this.enqueueBattleAnimsForUnits(units, 200);
        await this.waitIdle();
    }

    /** @deprecated 请用 {@link preloadBattleAnims} */
    static async preloadHot(units: readonly IBattleAnimUnitRef[]): Promise<void> {
        await this.preloadBattleAnims(units);
    }

    static clearQueue(): void {
        this._queue.length = 0;
    }

    /** 释放缓存中的冷/半热（热动作默认保留）；出战斗时可调 */
    static releaseNonHot(): void {
        for (const [key, entry] of [...this._cache.entries()]) {
            if (entry.heat === EBattleAnimHeat.Hot) {
                continue;
            }
            this._cache.delete(key);
            ResManager.releaseLoadedAsset(
                EBundleType.ANIM,
                BattleAnimCatalog.prefabPath(entry.rootType, entry.animPath, entry.action),
                Prefab,
            );
        }
    }

    private static pump(): void {
        while (!this._busy && this._inflight < this.MAX_CONCURRENT && this._queue.length > 0) {
            const task = this._queue.shift();
            if (task == null) {
                break;
            }
            const key = this.cacheKey(task.rootType, task.animPath, task.action);
            if (this._cache.has(key) || this._loadingKeys.has(key)) {
                continue;
            }
            this._loadingKeys.add(key);
            this._inflight += 1;
            void this.runTask(task, key);
        }
    }

    private static async runTask(task: IBattleAnimLoadTask, key: string): Promise<void> {
        const path = BattleAnimCatalog.prefabPath(task.rootType, task.animPath, task.action);
        try {
            const prefab = await ResManager.loadAsset(EBundleType.ANIM, path, Prefab);
            this._cache.set(key, {
                prefab,
                key,
                heat: task.heat,
                lastUsedAt: Date.now(),
                rootType: task.rootType,
                animPath: task.animPath,
                action: task.action,
            });
            console.log(`[战斗动画加载] ✓ ${path}`);
        } catch (e) {
            console.warn(`[战斗动画加载] ✗ ${path}`, e);
        } finally {
            this._loadingKeys.delete(key);
            this._inflight = Math.max(0, this._inflight - 1);
            this.pump();
        }
    }
}
