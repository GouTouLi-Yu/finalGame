import { EChooseTarget } from '../model/battle/EChooseTarget';
import { BattleRng } from '../model/battle/BattleRng';

export class BattleTargetUtil {
    /**
     * 按 ActionConfig.chooseTarget 随机一个「选择目标」。
     * @returns 目标单位 id；none 时 null；池为空时 null
     */
    static pickRandomChooseTarget(
        chooseTarget: EChooseTarget,
        allyUnitIds: readonly string[],
        enemyUnitIds: readonly string[],
        rng: BattleRng,
    ): string | null {
        switch (chooseTarget) {
            case EChooseTarget.None:
                return null;
            case EChooseTarget.Enemy:
                return rng.pickOne(enemyUnitIds);
            case EChooseTarget.Self:
                return rng.pickOne(allyUnitIds);
            default:
                return null;
        }
    }
}
