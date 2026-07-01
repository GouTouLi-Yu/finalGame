import { BattleFieldModel } from '../../model/battle/BattleFieldModel';

export interface IAutoPlayDecision {
    playCount: number;
}

/** 友方单位回合结束后是否自动出牌（测试 / 失控 buff） */
export interface IAutoPlayPolicy {
    resolve(actorUnitId: string, field: BattleFieldModel): IAutoPlayDecision | null;
}

/** 正常游戏：仅失控 buff 触发自动 */
export class OutOfControlAutoPlayPolicy implements IAutoPlayPolicy {
    resolve(actorUnitId: string, field: BattleFieldModel): IAutoPlayDecision | null {
        const n = field.getOutOfControlPlayCount(actorUnitId);
        return n != null ? { playCount: n } : null;
    }
}

/** 无 UI 测试：每回合自动出 1 张（失控 n 优先） */
export class TestAutoPlayPolicy implements IAutoPlayPolicy {
    static readonly DEFAULT_PLAY_COUNT = 1;

    resolve(actorUnitId: string, field: BattleFieldModel): IAutoPlayDecision | null {
        const n = field.getOutOfControlPlayCount(actorUnitId);
        if (n != null) {
            return { playCount: n };
        }
        return { playCount: TestAutoPlayPolicy.DEFAULT_PLAY_COUNT };
    }
}

/** 组合：先查子策略，均无则 null */
export class CompositeAutoPlayPolicy implements IAutoPlayPolicy {
    constructor(private readonly policies: readonly IAutoPlayPolicy[]) {}

    resolve(actorUnitId: string, field: BattleFieldModel): IAutoPlayDecision | null {
        for (const p of this.policies) {
            const d = p.resolve(actorUnitId, field);
            if (d != null) {
                return d;
            }
        }
        return null;
    }
}
