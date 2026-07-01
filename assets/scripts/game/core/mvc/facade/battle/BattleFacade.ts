import Facade from 'db://assets/scripts/frame/base/Facade';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { Injector } from 'db://assets/scripts/frame/Injector/Injector';
import { GameConfig } from 'db://assets/scripts/game/config/GameConfig';
import {
    BattleActionBarModel,
    IBattleUnitTurnEvent,
    IBattleUnitTurnSnapshot,
} from 'db://assets/scripts/game/core/mvc/model/battle/BattleActionBarModel';
import { BattleModel, IBeginBattleOptions } from 'db://assets/scripts/game/core/mvc/model/battle/BattleModel';
import { BattleUnitStatusModel } from 'db://assets/scripts/game/core/mvc/model/battle/BattleUnitStatusModel';
import { EBattleSide } from 'db://assets/scripts/game/core/mvc/model/battle/EBattleSide';
import { IBattleFieldContext } from 'db://assets/scripts/game/core/mvc/model/battle/IBattleFieldContext';
import { Player } from 'db://assets/scripts/game/core/mvc/model/Player/Player';
import { ArmyUtil } from 'db://assets/scripts/game/core/mvc/util/ArmyUtil';
import { BattleAutoPlayUtil } from 'db://assets/scripts/game/core/mvc/util/BattleAutoPlayUtil';

/** {@link BattleFacade.opAdvanceActionBar} 选项 */
export interface IAdvanceActionBarOptions {
    /** 友方单位回合摸牌后自动出牌（默认 GameConfig.test） */
    autoPlayAllyTurn?: boolean;
    /** @deprecated 用 {@link autoPlayAllyTurn} */
    playHandTopAfterAllyTurn?: boolean;
}

/**
 * 战斗用例入口：冒险交牌 ↔ 战斗初始化 ↔ 跑条推进 ↔（以后）开战斗界面。
 * 规则在 {@link BattleModel}；本类只编排调用顺序。
 */
export class BattleFacade extends Facade {
    private _battleModel: BattleModel;
    private _actionBarModel: BattleActionBarModel | null = null;
    private _fieldContext: IBattleFieldContext | null = null;
    private _unitStatus = new BattleUnitStatusModel();

    constructor() {
        super();
        this._battleModel = Injector.shared.getInstance(BattleModel);
    }

    get battleModel(): BattleModel {
        return this._battleModel;
    }

    get actionBarModel(): BattleActionBarModel | null {
        return this._actionBarModel;
    }

    /** 战斗内单位 buff（沉默、失控/混乱 n 张等） */
    get unitStatusModel(): BattleUnitStatusModel {
        return this._unitStatus;
    }

    get isInBattle(): boolean {
        return this._battleModel.isInBattle;
    }

    /**
     * 进战斗：冒险交牌 → 牌堆/手牌/魔力 → 初始化跑条。
     * @returns 是否成功进战（冒险无牌时 false）
     */
    opEnterBattle(options?: IBeginBattleOptions): boolean {
        const cardModel = Player.instance.adventureModel.cardModel;
        const cards = cardModel.takeAllCardsForBattle();
        if (cards.length === 0) {
            console.warn('[BattleFacade] 冒险无卡牌，无法进战');
            return false;
        }
        const armyId = options?.armyId ?? 'army_test';
        const deploy = Player.instance.adventureModel.deployModel;
        const enemyIds = ArmyUtil.getEnemyIds(armyId);
        if (enemyIds.length === 0) {
            console.warn(`[BattleFacade] 队伍 ${armyId} 无敌人配置`);
        }

        this._actionBarModel = new BattleActionBarModel();
        this._actionBarModel.initFromDeploy(deploy, enemyIds);

        const allyUnitIds = deploy.getActiveCombatants().map((c) => c.heroId);
        this._fieldContext = { allyUnitIds, enemyUnitIds: enemyIds };
        this._unitStatus.clearAll();
        this._battleModel.setUnitStatusProvider(this._unitStatus);

        this._battleModel.beginFromAdventureCards(cards, options);
        this._battleModel.onRoundStart();
        return true;
    }

    /**
     * 跑条推进一步：到点者依次回合；友方调 BattleModel，敌方仅 log。
     * 友方 4 槽本轮都动过后立即 onRoundEnd；同批后续友方事件不再结算（跑条位置已在 advance 中推进）。
     */
    opAdvanceActionBar(options?: IAdvanceActionBarOptions): IBattleUnitTurnEvent[] {
        if (this._actionBarModel == null) {
            return [];
        }
        const testAuto =
            options?.autoPlayAllyTurn ??
            options?.playHandTopAfterAllyTurn ??
            GameConfig.test;

        const events = this._actionBarModel.advance();
        if (events.length === 0) {
            return events;
        }
        const processed: IBattleUnitTurnEvent[] = [];
        let allyRoundClosed = false;
        for (const e of events) {
            if (e.side === EBattleSide.Ally) {
                if (allyRoundClosed) {
                    continue;
                }
                this._battleModel.onUnitTurnStart(e.unitId);
                this._actionBarModel.markAllyActed(e.slotIndex);
                e.snapshotAfterTurn = this.captureBattleSnapshot();
                if (testAuto && this._fieldContext != null) {
                    const decision = BattleAutoPlayUtil.resolveAutoPlay(
                        e.unitId,
                        this._unitStatus,
                        testAuto,
                    );
                    if (decision.shouldAuto) {
                        e.autoPlayResults = BattleAutoPlayUtil.runAutoPlay(
                            this._battleModel,
                            this._fieldContext,
                            e.unitId,
                            decision.playCount,
                            this._unitStatus,
                        );
                        e.snapshotAfterPlay = this.captureBattleSnapshot();
                        if (e.autoPlayResults.length === 1) {
                            e.playResult = e.autoPlayResults[0];
                        }
                    }
                }
                processed.push(e);
                if (this._actionBarModel.isAllyRoundComplete()) {
                    this._battleModel.onRoundEnd();
                    this._actionBarModel.resetAllyRoundActs();
                    allyRoundClosed = true;
                }
            } else {
                console.log(`[BattleFacade] 敌人回合 slot=${e.slotIndex} id=${e.unitId}`);
                processed.push(e);
            }
        }
        return processed;
    }

    private captureBattleSnapshot(): IBattleUnitTurnSnapshot {
        const d = this._battleModel.deckModel;
        return {
            roundNumber: this._battleModel.roundNumber,
            mana: this._battleModel.mana,
            hand: d.hand.length,
            library: d.library.length,
            discard: d.discard.length,
            total: d.totalCount,
        };
    }

    /**
     * 出战斗：收集全部卡牌并归还冒险牌组。
     */
    opLeaveBattle(): void {
        if (!this._battleModel.isInBattle) {
            return;
        }
        const cards = this._battleModel.endBattleAndCollectCards();
        Player.instance.adventureModel.cardModel.restoreFromBattle(cards);
        this._actionBarModel = null;
        this._fieldContext = null;
        this._unitStatus.clearAll();
    }
}

ClassConfig.addClass('BattleFacade', BattleFacade);
