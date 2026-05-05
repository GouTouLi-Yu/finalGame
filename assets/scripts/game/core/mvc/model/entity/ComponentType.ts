export enum EComponentType {
    hp = "hp",
    attributes = "attributes",
    skills = "skills",
    equipment = "equipment",
    /** 元素 */
    elements = "elements",
    /** 天赋 */
    talents = "talents",
    /** 组织 */
    organization = "organization",
    /** 魔纹 */
    magicPattern = "magicPattern",
}

export interface IComponent {
    type: EComponentType;

}


