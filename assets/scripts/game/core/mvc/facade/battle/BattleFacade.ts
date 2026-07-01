import Facade from 'db://assets/scripts/frame/base/Facade';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { IBattleUnitTurnEvent } from 'db://assets/scripts/game/core/mvc/model/battle/BattleActionBarModel';
import { BattleSession } from 'db://assets/scripts/game/core/mvc/model/battle/BattleSession';
import { IBeginBattleOptions, IBattlePlayCardRequest, IBattlePlayCardResult } from 'db://assets/scripts/game/core/mvc/model/battle/BattleTypes';
import { IAdventureBattlePort } from 'db://assets/scripts/game/core/mvc/port/IAdventureBattlePort';
import { PlayerAdventureBattlePort } from 'db://assets/scripts/game/core/mvc/port/PlayerAdventureBattlePort';
import {
    IAutoPlayPolicy,
    OutOfControlAutoPlayPolicy,
} from 'db://assets/scripts/game/core/mvc/policy/battle/IAutoPlayPolicy';
import {
    BattleTurnOrchestrator,
    IAdvanceActionBarOptions,
} from 'db://assets/scripts/game/core/mvc/service/battle/BattleTurnOrchestrator';
import { BattlePlayService } from 'db://assets/scripts/game/core/mvc/service/battle/BattlePlayService';
import { ArmyUtil } from 'db://assets/scripts/game/core/mvc/util/ArmyUtil';
import { EnemyUtil } from 'db://assets/scripts/game/core/mvc/util/EnemyUtil';

export type { IAdvanceActionBarOptions };

/**
 * 战斗用例入口：冒险交牌 ↔ Session 生命周期 ↔ 跑条推进 ↔（以后）开战斗界面。
 * 无战斗状态单例；每场 `BattleSession` 由本 Facade 持有。
 */
export class BattleFacade extends Facade {
    private _session: BattleSession | null = null;
    private _adventurePort: IAdventureBattlePort = new PlayerAdventureBattlePort();
    private _autoPlayPolicy: IAutoPlayPolicy = new OutOfControlAutoPlayPolicy();

    /** 当前战斗 Session；未进战时为 null */
    get session(): BattleSession | null {
        return this._session;
    }

    get isInBattle(): boolean {
        return this._session?.isActive ?? false;
    }

    /** 战场单位与 buff（沉默、失控等） */
    get fieldModel() {
        return this._session?.field ?? null;
    }

    setAdventurePort(port: IAdventureBattlePort): void {
        this._adventurePort = port;
    }

    setAutoPlayPolicy(policy: IAutoPlayPolicy): void {
        this._autoPlayPolicy = policy;
    }

    /**
     * 进战斗：冒险交牌 → 新建 Session → 首轮魔力。
     * @returns 是否成功进战
     */
    opEnterBattle(options?: IBeginBattleOptions): boolean {
        if (this._session?.isActive) {
            console.warn('[BattleFacade] 已在战斗中，请先 opLeaveBattle');
            return false;
        }
        const cards = this._adventurePort.takeCardsForBattle();
        if (cards.length === 0) {
            console.warn('[BattleFacade] 冒险无卡牌，无法进战');
            return false;
        }

        const armyId = options?.armyId ?? 'army_test';
        const deploy = this._adventurePort.getDeployModel();
        const enemyIds = ArmyUtil.getEnemyIds(armyId);
        if (enemyIds.length === 0) {
            console.warn(`[BattleFacade] 队伍 ${armyId} 无敌人配置`);
        }

        const session = new BattleSession();
        session.begin(cards, deploy, enemyIds, (id) => EnemyUtil.getSpeed(id), { ...options, armyId });
        session.onRoundStart();
        this._session = session;
        return true;
    }

    /** 跑条推进一步 */
    opAdvanceActionBar(options?: IAdvanceActionBarOptions): IBattleUnitTurnEvent[] {
        if (this._session == null) {
            return [];
        }
        return BattleTurnOrchestrator.advance(this._session, this._autoPlayPolicy, options);
    }

    /** 手点出牌（UI 调此入口） */
    opPlayCard(req: IBattlePlayCardRequest): IBattlePlayCardResult {
        if (this._session == null) {
            return { ok: false, manaCost: 0, reason: 'not_in_battle' };
        }
        return BattlePlayService.play(this._session, req);
    }

    /** 失控/混乱：单位回合内自动随机打 n 张 */
    setUnitOutOfControl(unitId: string, playCount: number | null): void {
        this._session?.field.setOutOfControl(unitId, playCount);
    }

    setUnitSilenced(unitId: string, on: boolean): void {
        this._session?.field.setSilenced(unitId, on);
    }

    /** 出战斗：收集卡牌归还冒险 */
    opLeaveBattle(): void {
        if (this._session == null || !this._session.isActive) {
            this._session = null;
            return;
        }
        const cards = this._session.endAndCollectCards();
        this._adventurePort.restoreCardsFromBattle(cards);
        this._session = null;
    }
}

ClassConfig.addClass('BattleFacade', BattleFacade);
