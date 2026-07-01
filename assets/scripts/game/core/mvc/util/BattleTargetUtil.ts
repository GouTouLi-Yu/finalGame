import { EChooseTarget } from '../model/battle/EChooseTarget';

export class BattleTargetUtil {
    /**
     * 按 ActionConfig.chooseTarget 随机一个「选择目标」（非 effects 里的作用目标）。
     * @returns 目标单位 id；none 时 null；池为空时 null
     */
    static pickRandomChooseTarget(
        chooseTarget: EChooseTarget,
        allyUnitIds: readonly string[],
        enemyUnitIds: readonly string[],
    ): string | null {
        switch (chooseTarget) {
            case EChooseTarget.None:
                return null;
            case EChooseTarget.Enemy:
                return this.pickRandomId(enemyUnitIds);
            case EChooseTarget.Self:
                return this.pickRandomId(allyUnitIds);
            default:
                return null;
        }
    }

    private static pickRandomId(ids: readonly string[]): string | null {
        if (ids.length === 0) {
            return null;
        }
        return ids[Math.floor(Math.random() * ids.length)] ?? null;
    }
}
