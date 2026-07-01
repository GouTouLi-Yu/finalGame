/**
 * 单次回合流程上的规则覆盖（卡牌效果、临时 buff 等传入）。
 * 与 ConfigValue 基础值叠加，计算见 {@link BattleTurnUtil}。
 */
export interface IBattleTurnOverride {
    /** 魔力：floor((base + manaDelta) * manaMultiplier) */
    manaDelta?: number;
    manaMultiplier?: number;
    /** 摸牌：floor((base + drawDelta) * drawMultiplier) */
    drawDelta?: number;
    drawMultiplier?: number;
    /** 轮次结束保留手牌（默认 false = 全弃） */
    retainHand?: boolean;
    /** 轮次结束保留当前魔力（默认 false = 按 base 重发） */
    retainMana?: boolean;
    /** 轮次结束补牌数；不设则用 ConfigValue.battleRoundStartHandSize */
    roundEndDrawCount?: number;
    /** 进战初始手牌数；不设则用 ConfigValue.battleInitialHandSize */
    initialHandCount?: number;
}

/**
 * 整场战斗持续生效的规则来源（角色被动、遗物、场地等）。
 * 注册到 BattleSession 后，与单次传入的 {@link IBattleTurnOverride} 自动合并。
 */
export interface IBattleTurnRuleProvider {
    getInitialHandOverride?(): IBattleTurnOverride | undefined;
    getRoundStartOverride?(roundIndex: number): IBattleTurnOverride | undefined;
    getUnitTurnStartOverride?(
        unitId: string | undefined,
        roundIndex: number,
    ): IBattleTurnOverride | undefined;
    getRoundEndOverride?(roundIndex: number): IBattleTurnOverride | undefined;
}

/** 回合摸牌/魔力等数值结算（与 {@link BattleUtil} 读表职责分离） */
export class BattleTurnUtil {
    /** 合并多个覆盖（delta 相加，multiplier 相乘，retain 为 OR） */
    static mergeOverride(...parts: (IBattleTurnOverride | null | undefined)[]): IBattleTurnOverride {
        const merged: IBattleTurnOverride = {};
        for (const part of parts) {
            if (part == null) {
                continue;
            }
            if (part.manaDelta != null) {
                merged.manaDelta = (merged.manaDelta ?? 0) + part.manaDelta;
            }
            if (part.manaMultiplier != null) {
                merged.manaMultiplier = (merged.manaMultiplier ?? 1) * part.manaMultiplier;
            }
            if (part.drawDelta != null) {
                merged.drawDelta = (merged.drawDelta ?? 0) + part.drawDelta;
            }
            if (part.drawMultiplier != null) {
                merged.drawMultiplier = (merged.drawMultiplier ?? 1) * part.drawMultiplier;
            }
            if (part.retainHand) {
                merged.retainHand = true;
            }
            if (part.retainMana) {
                merged.retainMana = true;
            }
            if (part.roundEndDrawCount != null) {
                merged.roundEndDrawCount = part.roundEndDrawCount;
            }
            if (part.initialHandCount != null) {
                merged.initialHandCount = part.initialHandCount;
            }
        }
        return merged;
    }

    static resolveManaGain(base: number, override?: IBattleTurnOverride): number {
        const delta = override?.manaDelta ?? 0;
        const mult = override?.manaMultiplier ?? 1;
        return Math.max(0, Math.floor((base + delta) * mult));
    }

    static resolveDrawCount(base: number, override?: IBattleTurnOverride): number {
        const delta = override?.drawDelta ?? 0;
        const mult = override?.drawMultiplier ?? 1;
        return Math.max(0, Math.floor((base + delta) * mult));
    }
}
