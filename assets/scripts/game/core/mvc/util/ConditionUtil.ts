import { ConfigReader } from "db://assets/scripts/frame/Data/ConfigReader";
import { EElementType } from "../model/element/ElementType";

export enum EConditionCompareType {
    element = "element",
    other = "other",
    attributePoint = "attributePoint",
}

export enum EConditionOperator {
    /** = */
    eq = "eq",
    /** > */
    gt = "gt",
    /** >= */
    gte = "gte",
    /** < */
    lt = "lt",
    /** <= */
    lte = "lte",
    /** != */
    neq = "neq",
    /** <= a && >= b */
    between = "between",
}

export class ConditionUtil {

    private static getConditionCfgById(conditionId: string): any {
        return ConfigReader.getDataById("ConditionConfig", conditionId);
    }

    static checkConditionOK(conditionId: string): boolean {
        let cfg = this.getConditionCfgById(conditionId);
        if (!cfg) {
            console.error(`ConditionConfig not found: ${conditionId}`);
            return true;
        }
        let target = cfg.target;
        let compareId = cfg.compareId;
        let compareType = cfg.compareType;
        switch (compareType) {
            case EConditionCompareType.element:
                return this.checkElementConditionOK(target, compareId);
            default:
                return false;
        }
    }

    static checkElementConditionOK(target: string, compareId: string): boolean {
        let compareCfg = ConfigReader.getDataById("ConditionCompareConfig", compareId);
        switch (target) {
            case EElementType.fire:

            case EElementType.water:

            case EElementType.wind:

            case EElementType.light:

            case EElementType.ice:

            case EElementType.thunder:

            case EElementType.rock:
                return false;
            case "all":
            case "other":
            default:
                return false;
        }
    }
}


