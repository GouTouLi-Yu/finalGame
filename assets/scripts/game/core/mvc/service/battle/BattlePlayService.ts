import { ActionUtil } from '../../util/ActionUtil';
import { BattleTargetUtil } from '../../util/BattleTargetUtil';
import { CardUtil } from '../../util/CardUtil';
import { BattleSession } from '../../model/battle/BattleSession';
import { EChooseTarget } from '../../model/battle/EChooseTarget';
import {
    EBattlePlayFail,
    IBattlePlayCardRequest,
    IBattlePlayCardResult,
} from '../../model/battle/BattleTypes';
import { ActionExecutor, IActionExecuteContext } from './ActionExecutor';

/** 出牌流水线：校验 → 选目标 → 扣费 → 弃牌 → 效果 */
export class BattlePlayService {
    static play(session: BattleSession, req: IBattlePlayCardRequest): IBattlePlayCardResult {
        const { card, actorUnitId } = req;
        const cost = CardUtil.getManaPoint(card.id);
        const base: IBattlePlayCardResult = { ok: false, cardId: card.id, manaCost: cost, actorUnitId };

        if (!session.field.canPlayCards(actorUnitId)) {
            return { ...base, reason: EBattlePlayFail.SILENCED };
        }
        if (!session.deck.hand.includes(card)) {
            return { ...base, reason: EBattlePlayFail.NOT_IN_HAND };
        }
        if (session.mana < cost) {
            return { ...base, reason: EBattlePlayFail.NO_MANA };
        }

        const actionId = CardUtil.getActionId(card.id);
        const chooseTarget = ActionUtil.getChooseTargetForCard(card.id, actionId);
        const pools = session.field.getTargetPools();
        let chosenTargetId = req.chosenTargetId ?? null;
        if (chooseTarget !== EChooseTarget.None && chosenTargetId == null) {
            chosenTargetId = BattleTargetUtil.pickRandomChooseTarget(
                chooseTarget,
                pools.allyUnitIds,
                pools.enemyUnitIds,
                session.rng,
            );
        }
        if (chooseTarget !== EChooseTarget.None && chosenTargetId == null) {
            return { ...base, reason: EBattlePlayFail.NO_TARGET };
        }

        if (!session.spendMana(cost)) {
            return { ...base, reason: EBattlePlayFail.NO_MANA };
        }
        if (!session.deck.discardFromHand(card)) {
            session.addMana(cost);
            return { ...base, reason: EBattlePlayFail.DISCARD_FAIL };
        }

        const ctx: IActionExecuteContext = {
            session,
            actorUnitId,
            chosenTargetId,
            card,
            actionId,
        };
        ActionExecutor.execute(ctx);

        return {
            ok: true,
            cardId: card.id,
            manaCost: cost,
            actorUnitId,
            chosenTargetId,
        };
    }
}
