export type GMCheatActionHandler = (params?: unknown) => void;

/**
 * action 列 → 函数。表里填 action 名字，在 initGMCheatActions 里 register 同名函数。
 */
export class GMCheatActionRegistry {
    private static _handlers = new Map<string, GMCheatActionHandler>();

    static register(action: string, handler: GMCheatActionHandler): void {
        const key = action?.trim();
        if (!key) return;
        this._handlers.set(key, handler);
    }

    static get(action: string): GMCheatActionHandler | undefined {
        return this._handlers.get(action?.trim());
    }
}
