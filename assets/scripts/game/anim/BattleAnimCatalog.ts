/**
 * 战斗单位动作名与冷热分级、资源路径约定。
 *
 * 路径：anim bundle 内
 *   character|enemy/{animPath}/battle/{action}/anim
 * 例：
 *   character/liYin/battle/hurt/anim
 *   enemy/shiLaiMu_ice/battle/hurt/anim
 *
 * animPath 来自 HeroBase / EnemyConfig，是 battle 的直接上级目录名。
 */
export enum EBattleAnimAction {
    Idle = 'idle',
    Hurt = 'hurt',
    Die = 'die',
    /** 拖牌起手 */
    PrepStart = 'prepStart',
    /** 拖牌循环 */
    PrepIdle = 'prepIdle',
    /** 收回手牌 */
    PrepBack = 'prepBack',
    /** 出牌成功施法演出（原 other） */
    UsingMagic = 'usingMagic',
}

/** 资源冷热：常驻 / 半热预取 / 冷按需 */
export enum EBattleAnimHeat {
    /** 开战前装好，尽量常驻 */
    Hot = 'hot',
    /** 当前行动者 + 跑条前瞻补 */
    Warm = 'warm',
    /** 后台补，可 LRU 卸 */
    Cold = 'cold',
}

export type TBattleAnimRootType = 'character' | 'enemy';

export interface IBattleAnimUnitRef {
    rootType: TBattleAnimRootType;
    /** HeroBase / EnemyConfig.animPath，battle 的直接上级目录名（如 liYin） */
    animPath: string;
}

export class BattleAnimCatalog {
    static readonly ALL_ACTIONS: readonly EBattleAnimAction[] = [
        EBattleAnimAction.Idle,
        EBattleAnimAction.Hurt,
        EBattleAnimAction.Die,
        EBattleAnimAction.PrepStart,
        EBattleAnimAction.PrepIdle,
        EBattleAnimAction.PrepBack,
        EBattleAnimAction.UsingMagic,
    ];

    /** 开战必载、常驻 */
    static readonly HOT_ACTIONS: readonly EBattleAnimAction[] = [
        EBattleAnimAction.Idle,
        EBattleAnimAction.Hurt,
    ];

    /** 死亡：冷 */
    static readonly COLD_ACTIONS: readonly EBattleAnimAction[] = [
        EBattleAnimAction.Die,
    ];

    /** 预备施法链 + 出牌演出：半热 */
    static readonly WARM_ACTIONS: readonly EBattleAnimAction[] = [
        EBattleAnimAction.PrepStart,
        EBattleAnimAction.PrepIdle,
        EBattleAnimAction.PrepBack,
        EBattleAnimAction.UsingMagic,
    ];

    /** 友方开战预载的半热动作 */
    static readonly ALLY_WARM_PRELOAD_ACTIONS: readonly EBattleAnimAction[] = [
        EBattleAnimAction.PrepStart,
        EBattleAnimAction.PrepIdle,
        EBattleAnimAction.PrepBack,
        EBattleAnimAction.UsingMagic,
    ];

    static heatOf(action: EBattleAnimAction): EBattleAnimHeat {
        if ((this.HOT_ACTIONS as readonly string[]).includes(action)) {
            return EBattleAnimHeat.Hot;
        }
        if ((this.COLD_ACTIONS as readonly string[]).includes(action)) {
            return EBattleAnimHeat.Cold;
        }
        return EBattleAnimHeat.Warm;
    }

    /**
     * anim bundle 内 prefab 路径（无扩展名）。
     * 例：character/liYin/battle/idle/anim
     */
    static prefabPath(
        rootType: TBattleAnimRootType,
        animPath: string,
        action: EBattleAnimAction,
    ): string {
        return `${rootType}/${animPath}/battle/${action}/anim`;
    }

    /** 预备链：起手 → 循环 → 收回 */
    static prepActions(): readonly EBattleAnimAction[] {
        return [
            EBattleAnimAction.PrepStart,
            EBattleAnimAction.PrepIdle,
            EBattleAnimAction.PrepBack,
        ];
    }
}
