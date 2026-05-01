
import { JsonAsset } from 'cc';
import { EBundleType, ResManager } from '../../game/manager/ResManager';

type AnyObj = Record<string, any>;
type TableData = Readonly<Record<string, Readonly<AnyObj>>>; // id -> row（深度冻结后）

function deepFreeze<T>(obj: T, seen = new WeakSet<object>()): T {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    const o = obj as unknown as object;
    if (seen.has(o)) return obj;
    seen.add(o);

    // 先递归，再 freeze，避免中途被改
    if (Array.isArray(obj)) {
        for (const item of obj) deepFreeze(item as any, seen);
    } else {
        for (const k of Object.keys(obj as AnyObj)) {
            deepFreeze((obj as AnyObj)[k], seen);
        }
    }

    try {
        Object.freeze(obj as any);
    } catch { }
    return obj;
}

export class ConfigReader {
    private static _tables: Map<string, TableData> = new Map();
    private static _assets: JsonAsset[] = [];

    /**
     * 游戏开始前预加载所有表到内存
     * @param onProgress (finished,total) => void
     */
    static async init(onProgress?: (finished: number, total: number) => void) {
        await this.loadAll(onProgress);
        console.log(`[ConfigReader] 配置表加载完毕，表数量: ${this._tables.size}`);
    }

    static async loadAll(onProgress?: (finished: number, total: number) => void) {
        this.clear();

        const assets = await ResManager.loadDir<JsonAsset>(
            EBundleType.CONFIG,
            '',
            JsonAsset,
            onProgress
        );

        this._assets = assets;

        if (!assets || assets.length === 0) {
            console.warn('[ConfigReader] config bundle 下未加载到任何 JsonAsset（assets/config/）');
        }

        for (const a of assets) {
            const fileKey = (a && a.name) ? a.name : '';
            const json = (a && a.json) ? (a.json as AnyObj) : null;
            if (!json || typeof json !== 'object') continue;

            // 插件输出格式：{ [tableName]: { [id]: row } }
            const tableName = Object.keys(json)[0] || fileKey;
            const table = (tableName && (json as AnyObj)[tableName]) ? (json as AnyObj)[tableName] : null;
            if (!table || typeof table !== 'object') continue;

            deepFreeze(table);
            this._tables.set(tableName, table as TableData);
        }
    }

    /** 获取整张表的数据（只读） */
    static getDataTable(name: string): TableData | null {
        return this._tables.get(name) || null;
    }

    /** 根据id获取对应行数据（只读） */
    static getDataById(name: string, id: string): Readonly<AnyObj> | null {
        const table = this._tables.get(name);
        if (!table) return null;
        return (table as any)[id] || null;
    }

    /** 根据id和key获取对应行数据中的对应字段值（只读） */
    static getDataByIdAndKey(name: string, id: string, key: string): any {
        const row = this.getDataById(name, id);
        if (!row) return null;
        return (row as any)[key];
    }

    static clear() {
        // 释放旧资源（防止重复 init 时内存涨）
        ResManager.releaseLoadedAssets(this._assets);
        this._assets = [];
        this._tables.clear();
    }
}

