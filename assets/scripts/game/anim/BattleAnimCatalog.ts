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
    PrepRaise1 = 'prepRaise1',
    PrepIdle1 = 'prepIdle1',
    PrepCancel1 = 'prepCancel1',
    PrepRaise2 = 'prepRaise2',
    PrepIdle2 = 'prepIdle2',
    PrepCancel2 = 'prepCancel2',
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
        EBattleAnimAction.PrepRaise1,
        EBattleAnimAction.PrepIdle1,
        EBattleAnimAction.PrepCancel1,
        EBattleAnimAction.PrepRaise2,
        EBattleAnimAction.PrepIdle2,
        EBattleAnimAction.PrepCancel2,
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

    /** 预备施法链：半热 */
    static readonly WARM_ACTIONS: readonly EBattleAnimAction[] = [
        EBattleAnimAction.PrepRaise1,
        EBattleAnimAction.PrepIdle1,
        EBattleAnimAction.PrepCancel1,
        EBattleAnimAction.PrepRaise2,
        EBattleAnimAction.PrepIdle2,
        EBattleAnimAction.PrepCancel2,
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

    /** 对敌预备三连 */
    static prepActionsForEnemy(): readonly EBattleAnimAction[] {
        return [
            EBattleAnimAction.PrepRaise1,
            EBattleAnimAction.PrepIdle1,
            EBattleAnimAction.PrepCancel1,
        ];
    }

    /** 对己预备三连 */
    static prepActionsForAlly(): readonly EBattleAnimAction[] {
        return [
            EBattleAnimAction.PrepRaise2,
            EBattleAnimAction.PrepIdle2,
            EBattleAnimAction.PrepCancel2,
        ];
    }
}
