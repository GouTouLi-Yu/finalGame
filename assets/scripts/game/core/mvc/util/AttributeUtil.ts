import { EAttributeType } from '../model/entity/AttributeType';
import { ALL_ELEMENT_TYPES, EElementType } from '../model/element/ElementType';

/** 元素 → 抗性属性 */
const ELEMENT_RES_ATTR_MAP: Record<EElementType, EAttributeType> = {
    [EElementType.water]: EAttributeType.waterRes,
    [EElementType.fire]: EAttributeType.fireRes,
    [EElementType.wind]: EAttributeType.windRes,
    [EElementType.thunder]: EAttributeType.thunderRes,
    [EElementType.rock]: EAttributeType.rockRes,
    [EElementType.light]: EAttributeType.lightRes,
    [EElementType.ice]: EAttributeType.iceRes,
    [EElementType.dark]: EAttributeType.darkRes,
    [EElementType.poison]: EAttributeType.poisonRes,
};

/** 元素 → 伤害加成属性 */
const ELEMENT_DAMAGE_BONUS_ATTR_MAP: Record<EElementType, EAttributeType> = {
    [EElementType.water]: EAttributeType.waterDamageBonus,
    [EElementType.fire]: EAttributeType.fireDamageBonus,
    [EElementType.wind]: EAttributeType.windDamageBonus,
    [EElementType.thunder]: EAttributeType.thunderDamageBonus,
    [EElementType.rock]: EAttributeType.rockDamageBonus,
    [EElementType.light]: EAttributeType.lightDamageBonus,
    [EElementType.ice]: EAttributeType.iceDamageBonus,
    [EElementType.dark]: EAttributeType.darkDamageBonus,
    [EElementType.poison]: EAttributeType.poisonDamageBonus,
};

export class AttributeUtil {
    /** 获取元素对应的抗性属性 */
    static getElementResAttr(element: EElementType): EAttributeType {
        return ELEMENT_RES_ATTR_MAP[element];
    }

    /** 获取元素对应的伤害加成属性 */
    static getElementDamageBonusAttr(element: EElementType): EAttributeType {
        return ELEMENT_DAMAGE_BONUS_ATTR_MAP[element];
    }

    /** 全部元素对应的抗性属性（顺序：水火风雷岩光冰暗毒） */
    static getAllElementResAttrs(): EAttributeType[] {
        return ALL_ELEMENT_TYPES.map(e => ELEMENT_RES_ATTR_MAP[e]);
    }

    /** 全部元素对应的伤害加成属性（顺序：水火风雷岩光冰暗毒） */
    static getAllElementDamageBonusAttrs(): EAttributeType[] {
        return ALL_ELEMENT_TYPES.map(e => ELEMENT_DAMAGE_BONUS_ATTR_MAP[e]);
    }
}
