import { Card } from '../card/Card';
import { IBattleTurnOverride } from '../../util/BattleTurnUtil';

/** 打牌失败原因 */
export const EBattlePlayFail = {
    NO_HAND: 'no_hand',
    NO_MANA: 'no_mana',
    SILENCED: 'silenced',
    NO_TARGET: 'no_target',
    NOT_IN_HAND: 'not_in_hand',
    DISCARD_FAIL: 'discard_fail',
} as const;

export type TBattlePlayFailReason = (typeof EBattlePlayFail)[keyof typeof EBattlePlayFail];

export interface IBeginBattleOptions {
    battleSeed?: number;
    override?: IBattleTurnOverride;
    armyId?: string;
}

export interface IBattlePlayCardRequest {
    card: Card;
    actorUnitId: string;
    /** 未传且 chooseTarget≠none 时由 play 服务随机合法目标 */
    chosenTargetId?: string | null;
}

export interface IBattlePlayCardResult {
    ok: boolean;
    cardId?: string;
    manaCost: number;
    reason?: TBattlePlayFailReason | string;
    actorUnitId?: string;
    chosenTargetId?: string | null;
}
