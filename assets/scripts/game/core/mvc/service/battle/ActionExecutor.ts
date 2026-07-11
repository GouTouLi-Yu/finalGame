import { Card } from '../../model/card/Card';
import { EBattleSide } from '../../model/battle/BattleEnums';
import { BattleSession } from '../../model/battle/BattleSession';
import { CardUtil } from '../../util/CardUtil';

export interface IActionExecuteContext {
    session: BattleSession;
    actorUnitId: string;
    chosenTargetId: string | null;
    card: Card;
    actionId: string;
}

/**
 * ActionConfig 效果执行（damage、draw、弃其他手牌等以后在此扩展）。
 * 当前：打到敌人身上时，用卡牌元素整体替换目标印记。
 */
export class ActionExecutor {
    static execute(ctx: IActionExecuteContext): void {
        this.applyCardElementMarks(ctx);
        // TODO: 读 ActionConfig.effects 并调度
    }

    /** 牌打到敌人：用本次牌的 1~2 个元素替换其全部印记 */
    private static applyCardElementMarks(ctx: IActionExecuteContext): void {
        const targetId = ctx.chosenTargetId;
        if (targetId == null || targetId === '') {
            return;
        }
        const unit = ctx.session.field.getUnit(targetId);
        if (unit == null || unit.side !== EBattleSide.Enemy) {
            return;
        }
        const elems = CardUtil.getElements(ctx.card.id);
        ctx.session.field.replaceElementMarks(targetId, elems);
    }
}
