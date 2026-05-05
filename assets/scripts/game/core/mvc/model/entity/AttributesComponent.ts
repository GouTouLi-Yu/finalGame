import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { EComponentType, IComponent } from './ComponentType';

export enum HeroEAttributesType {
    /** 力量 */
    strength = 1,
    /** 敏捷 */
    agility,
    /** 魔力 */
    magic,
    /** 耐力 */
    endurance,
    /** 魅力 */
    charm,
    /** 幸运 */
    luck,
    /** 暴击率 */
    criticalChance,
    /** 暴击伤害 */
    criticalDamage,
    /** 速度 */
    criticalResistance,
    /** 闪避率 */
    dodgeChance,
    /** 命中率 */
    hitChance,
    /** 防御力 */
    defense,
    /** 魔法防御力 */
    magicDefense,
    /** 物理防御力 */
    physicalDefense,
    /** 魔法抗性 */
    magicResistance,
    /** 物理抗性 */
    physicalAbsorption,
    /** 魔法穿透 */
    magicPenetration,
    /** 物理穿透 */
}

export class AttributesComponent implements IComponent {
    readonly type: EComponentType.attributes = EComponentType.attributes;

    serialize(): any {
        return null;
    }

    deserialize(): any {
        return null;
    }
}
ClassConfig.addClass("AttributesComponent", AttributesComponent);

