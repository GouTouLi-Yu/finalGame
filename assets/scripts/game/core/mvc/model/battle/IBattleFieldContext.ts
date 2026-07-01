/** 当前战场上的友方/敌方单位 id（选目标用） */
export interface IBattleFieldContext {
    allyUnitIds: readonly string[];
    enemyUnitIds: readonly string[];
}
