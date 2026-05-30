/** 九元素类型（与 {@link EAttributeType} 元素抗性/伤害加成一一对应） */
export enum EElementType {
    /** 水 */
    water = 'water',
    /** 火 */
    fire = 'fire',
    /** 风 */
    wind = 'wind',
    /** 雷 */
    thunder = 'thunder',
    /** 岩 */
    rock = 'rock',
    /** 光 */
    light = 'light',
    /** 冰 */
    ice = 'ice',
    /** 暗 */
    dark = 'dark',
    /** 幻 */
    phantom = 'phantom',
}

/** 全部元素，固定顺序：水火风雷岩光冰暗幻 */
export const ALL_ELEMENT_TYPES: readonly EElementType[] = [
    EElementType.water,
    EElementType.fire,
    EElementType.wind,
    EElementType.thunder,
    EElementType.rock,
    EElementType.light,
    EElementType.ice,
    EElementType.dark,
    EElementType.phantom,
];
