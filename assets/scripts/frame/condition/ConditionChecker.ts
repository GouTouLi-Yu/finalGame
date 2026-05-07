import { pairs } from "../../frame/luaCompat/pairs";
import { ElemPointConChecker } from "./ElemConChecker";

export interface IConditionContext {
    /** 元素点数值 --> key: 元素id, value: 元素点数 */
    elemPointMap: Map<string, number>;
}

/** 条件类型 --> 要和表中的conditionType字段一致 */
export enum EConditionType {
    /** 元素点数 */
    elem_point = "elem_point",
    kill = "kill",

}

export class ConditionChecker {
    static check(rulesJson: string, context: IConditionContext): boolean {
        for (let [type, param] of pairs(rulesJson)) {
            switch (type) {
                case EConditionType.elem_point:
                    return ElemPointConChecker.check(param, context);
                case EConditionType.kill:
                    return true;
                default:
                    return false;
            }
        }
    }
}