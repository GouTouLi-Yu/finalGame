import { Card } from '../../model/card/Card';
import { BattleSession } from '../../model/battle/BattleSession';

export interface IActionExecuteContext {
    session: BattleSession;
    actorUnitId: string;
    chosenTargetId: string | null;
    card: Card;
    actionId: string;
}

/**
 * ActionConfig 效果执行（damage、draw、弃其他手牌等以后在此扩展）。
 * 当前为占位：效果表接入前不影响扣费弃牌主流程。
 */
export class ActionExecutor {
    static execute(_ctx: IActionExecuteContext): void {
        // TODO: 读 ActionConfig.effects 并调度
    }
}
