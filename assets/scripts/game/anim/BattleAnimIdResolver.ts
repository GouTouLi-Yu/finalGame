import { EnemyUtil } from '../core/mvc/util/EnemyUtil';
import { HeroUtil } from '../core/mvc/util/HeroUtil';
import { IBattleAnimUnitRef, TBattleAnimRootType } from './BattleAnimCatalog';

/**
 * 战斗 unitId → animPath（battle 直接上级目录名）。
 * 友方读 HeroBase.animPath，敌方读 EnemyConfig.animPath。
 * 最终资源：character|enemy/{animPath}/battle/{action}/anim
 */
export class BattleAnimIdResolver {
    static resolveAnimPath(rootType: TBattleAnimRootType, unitId: string): string {
        if (rootType === 'character') {
            return HeroUtil.getAnimPath(unitId);
        }
        return EnemyUtil.getAnimPath(unitId);
    }

    static toUnitRef(rootType: TBattleAnimRootType, unitId: string): IBattleAnimUnitRef {
        return {
            rootType,
            animPath: this.resolveAnimPath(rootType, unitId),
        };
    }
}
