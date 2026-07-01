/** 单位回合上的 buff 状态（沉默、失控/混乱等） */
export interface IBattleUnitStatusProvider {
    /** 是否可打出卡牌（未被沉默/缴械等） */
    canPlayCards(unitId: string): boolean;
    /**
     * 失控/混乱：需自动出牌的张数 n（n ≤ 行动开始时手牌数；实际打牌时随 hand 变化截断）。
     * 无失控返回 null。
     */
    getOutOfControlPlayCount(unitId: string): number | null;
}

/** 默认：无 buff，仅正常手点 */
export class EmptyBattleUnitStatusProvider implements IBattleUnitStatusProvider {
    canPlayCards(_unitId: string): boolean {
        return true;
    }

    getOutOfControlPlayCount(_unitId: string): number | null {
        return null;
    }
}
