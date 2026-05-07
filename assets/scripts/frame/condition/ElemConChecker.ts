import { ElementUtil } from "../../game/core/mvc/util/ElementUtil";
import { pairs } from "../luaCompat/pairs";
import { CompareUtil } from "../util/CompareUtil";
import { TargetUtil } from "../util/TargetUtil";
import { IConditionContext } from "./ConditionChecker";

export class ElemPointConChecker {
    private static readonly ALL = ElementUtil.getAllElements();

    static check(params: any, context: IConditionContext): boolean {
        const values = context.elemPointMap;
        for (const [target, raw] of pairs(params)) {
            const keys = TargetUtil.resolve(target, this.ALL);
            const targetValues = keys.map(k => values.get(k) ?? 0);
            const actual = CompareUtil.parseMulti(targetValues, raw as string);
            if (!actual) return false;
        }
        return true;
    }
}


