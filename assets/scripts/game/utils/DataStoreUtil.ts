import { sys } from 'cc';

/**
 * 本地键值存储封装（Web/桌面等使用 sys.localStorage）。
 * 与具体业务无关；存档 key、数据结构由上层（如 SaveGameService）约定。
 */
export class DataStoreUtil {
    static saveData(key: string, data: unknown): void {
        try {
            sys.localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('[DataStoreUtil] saveData failed', key, e);
        }
    }

    static loadData<T = unknown>(key: string): T | null {
        try {
            const raw = sys.localStorage.getItem(key);
            if (raw == null || raw === '') {
                return null;
            }
            return JSON.parse(raw) as T;
        } catch (e) {
            console.warn('[DataStoreUtil] loadData failed', key, e);
            return null;
        }
    }

    static removeData(key: string): void {
        sys.localStorage.removeItem(key);
    }

    static hasData(key: string): boolean {
        const raw = sys.localStorage.getItem(key);
        return raw != null && raw !== '';
    }
}
