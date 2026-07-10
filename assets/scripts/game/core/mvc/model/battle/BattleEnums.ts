/** ActionConfig.chooseTarget：玩家（或失控 AI）需选择的对象类型 */
export enum EChooseTarget {
    None = 'none',
    Enemy = 'enemy',
    Self = 'self',
}

/** 战斗跑条单位阵营 */
export enum EBattleSide {
    Ally = 'ally',
    Enemy = 'enemy',
}

/**
 * ActionConfig.effects[].type：技能/卡牌效果类型。
 * 与配置表字符串一一对应，后续可扩展 shield、draw 等。
 */
export enum ESkillEffectType {
    /** 伤害 */
    damage = 'damage',
    /** 恢复血量 */
    heal_hp = 'heal_hp',
}

/**
 * ActionConfig.effects[].target：施法作用目标。
 * other 的阵营由 chosen 决定：选中敌方 → 其余敌人；选中己方 → 其余友方。
 */
export enum EEffectTarget {
    /** 选择目标 */
    chosen = 'chosen',
    /** 除选择目标外的同阵营全体（敌或友由 chosen 决定） */
    other = 'other',
}

/** ActionConfig.effects[].scaleFrom：技能倍率来源 */
export enum EScaleFrom {
    /** 施法者 */
    caster = 'caster',
}

/** Card/Skill params 与 effects[].rateKey：倍率值 key */
export enum ERateKey {
    /** 伤害倍率 */
    dmgRate = 'dmgRate',
    /** 分裂伤害倍率 */
    splashDmgRate = 'splashDmgRate',
    /** 恢复血量倍率 */
    healHpRate = 'healHpRate',
}
