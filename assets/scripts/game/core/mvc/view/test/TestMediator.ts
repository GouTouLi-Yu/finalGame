import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { LanguageService } from '../../../../i18n/LanguageService';
import { ELanguage } from '../../../../i18n/LanguageType';
import { UIManager } from '../../../../ui/UIManager';
import Strings from '../../../../utils/Strings';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { BattleFacade } from 'db://assets/scripts/game/core/mvc/facade/battle/BattleFacade';
import { BattleActionBarModel, IBattleUnitTurnSnapshot } from 'db://assets/scripts/game/core/mvc/model/battle/BattleActionBarModel';
import { BattleModel } from 'db://assets/scripts/game/core/mvc/model/battle/BattleModel';
import { EBattleSide } from 'db://assets/scripts/game/core/mvc/model/battle/EBattleSide';
import { Card } from 'db://assets/scripts/game/core/mvc/model/card/Card';
import { Player } from 'db://assets/scripts/game/core/mvc/model/Player/Player';
import { ArmyUtil } from 'db://assets/scripts/game/core/mvc/util/ArmyUtil';
import { BattleUtil } from 'db://assets/scripts/game/core/mvc/util/BattleUtil';
import { CardUtil } from 'db://assets/scripts/game/core/mvc/util/CardUtil';
import { EnemyUtil } from 'db://assets/scripts/game/core/mvc/util/EnemyUtil';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';
import { BattleSimValidator } from './BattleSimValidator';

/**
 * 测试用区域界面 Mediator。
 * 约定：界面 id `TestView` → `prefab/test/TestLayer`（ui bundle，由 fullPath + TestLayer）。
 */
export class TestMediator extends AreaViewMediator {
    public static fullPath = 'prefab/';

    BtnHandles = {
        ["btn"]: "memoryTest",
    }

    public initialize(..._any: any[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
        this.mapEventListeners();
    }

    registerUI(): void { }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {
        LanguageService.setLanguage(ELanguage.CN);
        console.log(Strings.get("TRANS_HERO_NAME_001"));

        this.testActionBarCanonical();
        this.testBattleMultiRoundWithPlay();
    }

    /** 验算你举的 A200/B100/C150/D120/敌90 行动顺序 */
    private testActionBarCanonical(): void {
        const bar = new BattleActionBarModel();
        bar.initForTest(
            [
                { slotIndex: 0, unitId: 'hero_1', speed: 200 },
                { slotIndex: 1, unitId: 'hero_2', speed: 100 },
                { slotIndex: 2, unitId: 'hero_3', speed: 150 },
                { slotIndex: 3, unitId: 'hero_4', speed: 120 },
            ],
            [{ slotIndex: 0, unitId: 'enemy_1', speed: 90 }],
        );

        const allyOrder: string[] = [];
        let guard = 0;
        console.log('[ActionBarTest] ========== 经典顺序验算 ==========');
        this.logUnitSpeeds('ActionBarTest', [
            { side: 'ally', slotIndex: 0, unitId: 'hero_1', speed: 200 },
            { side: 'ally', slotIndex: 1, unitId: 'hero_2', speed: 100 },
            { side: 'ally', slotIndex: 2, unitId: 'hero_3', speed: 150 },
            { side: 'ally', slotIndex: 3, unitId: 'hero_4', speed: 120 },
            { side: 'enemy', slotIndex: 0, unitId: 'enemy_1', speed: 90 },
        ]);
        while (!bar.isAllyRoundComplete() && guard++ < 30) {
            const events = bar.advance();
            if (events.length === 0) {
                break;
            }
            for (const e of events) {
                console.log(`[ActionBarTest] 回合 ${e.side} ${e.unitId} | 剩余 ${bar.debugRemainings()}`);
                if (e.side === EBattleSide.Ally) {
                    if (bar.isAllyRoundComplete()) {
                        break;
                    }
                    bar.markAllyActed(e.slotIndex);
                    allyOrder.push(e.unitId);
                }
            }
        }
        const expected = 'hero_1,hero_3,hero_4,hero_1,hero_2';
        const ok = allyOrder.join(',') === expected;
        console.log(ok ? '[ActionBarTest] ✅ 行动顺序通过' : `[ActionBarTest] ❌ 期望 ${expected} 实际 ${allyOrder.join(',')}`);
    }

    /** Facade + 上阵 + 每人行动后打 1 张牌，模拟多轮（含自动规则审计） */
    private testBattleMultiRoundWithPlay(): void {
        const DECK_SIZE = 23;
        const SIM_TARGET_ROUND = 4;
        const adventure = Player.instance.adventureModel;
        adventure.cardModel.resetToDefault();
        for (const card of this.createTestDeck(DECK_SIZE)) {
            adventure.cardModel.addCardById(card.id, card.level);
        }
        console.log(`[BattleSim] 牌组 ${adventure.cardModel.cards.length} 张，目标完成至轮次 ${SIM_TARGET_ROUND}`);

        const deploy = adventure.deployModel;
        deploy.resetToDefault();
        const speeds = [200, 100, 150, 120];
        for (let i = 0; i < 4; i++) {
            deploy.assignHeroToActive(i, `hero_${i + 1}`, speeds[i], 1);
        }

        const enemyIds = ArmyUtil.getEnemyIds('army_test');
        const speedUnits: { side: 'ally' | 'enemy'; slotIndex: number; unitId: string; speed: number }[] = [
            ...deploy.getActiveCombatants().map((c) => ({
                side: 'ally' as const,
                slotIndex: c.slotIndex,
                unitId: c.heroId,
                speed: c.speed,
            })),
            ...enemyIds.map((id, i) => ({
                side: 'enemy' as const,
                slotIndex: i,
                unitId: id,
                speed: EnemyUtil.getSpeed(id),
            })),
        ];
        this.logUnitSpeeds('BattleSim', speedUnits);

        const facade = BattleFacade.getInstance();
        if (!facade.opEnterBattle({ armyId: 'army_test' })) {
            console.log('[BattleSim] ❌ 进战失败');
            return;
        }

        const battle = facade.battleModel;
        const activeSlots = deploy.getActiveCombatants().map((c) => c.slotIndex);
        const audit = new BattleSimValidator(DECK_SIZE, activeSlots);
        let allyTurns = 0;
        let cardsPlayed = 0;
        let playSkippedNoMana = 0;

        const logSnapshot = (step: string, s: IBattleUnitTurnSnapshot) => {
            console.log(
                `[BattleSim] ${step} | 轮次=${s.roundNumber} 魔力=${s.mana} 手牌=${s.hand} ` +
                `抽牌堆=${s.library} 弃牌堆=${s.discard} 消耗=${battle.deckModel.exhaust.length} 合计=${s.total}`,
            );
        };
        const captureSnapshot = (): IBattleUnitTurnSnapshot => {
            const d = battle.deckModel;
            return {
                roundNumber: battle.roundNumber,
                mana: battle.mana,
                hand: d.hand.length,
                library: d.library.length,
                discard: d.discard.length,
                total: d.totalCount,
            };
        };
        const logBattle = (step: string) => logSnapshot(step, captureSnapshot());

        console.log('[BattleSim] ========== 多轮出牌模拟 ==========');
        logBattle('opEnterBattle');
        audit.observe('opEnterBattle', captureSnapshot(), battle.deckModel.exhaust.length);
        this.logRuleHints();

        let guard = 0;
        while (battle.roundNumber < SIM_TARGET_ROUND && guard++ < 200) {
            const roundBefore = battle.roundNumber;
            const events = facade.opAdvanceActionBar({ autoPlayAllyTurn: true });
            if (events.length === 0) {
                console.log('[BattleSim] ⚠ 跑条无推进，提前结束');
                break;
            }
            for (const e of events) {
                if (e.side === EBattleSide.Ally) {
                    allyTurns++;
                    if (e.snapshotAfterTurn != null) {
                        logSnapshot(`[${allyTurns}] ${e.unitId} 摸牌后`, e.snapshotAfterTurn);
                    }
                    const plays = e.autoPlayResults ?? (e.playResult != null ? [e.playResult] : []);
                    for (const play of plays) {
                        if (play.ok) {
                            cardsPlayed++;
                            if (e.snapshotAfterPlay != null) {
                                const targetHint =
                                    play.chosenTargetId != null ? ` →${play.chosenTargetId}` : '';
                                logSnapshot(
                                    `[${allyTurns}] ${e.unitId} 出牌 ${play.cardId} 费${play.manaCost}${targetHint}`,
                                    e.snapshotAfterPlay,
                                );
                            }
                        } else {
                            if (play.reason === BattleModel.PLAY_FAIL_NO_MANA) {
                                playSkippedNoMana++;
                            }
                            if (e.snapshotAfterPlay != null) {
                                logSnapshot(
                                    `[${allyTurns}] ${e.unitId} 跳过(${play.reason ?? '?'}${play.cardId ? ` ${play.cardId}需${play.manaCost}` : ''})`,
                                    e.snapshotAfterPlay,
                                );
                            }
                        }
                    }
                } else {
                    console.log(`[BattleSim] [敌] ${e.unitId} 行动`);
                }
            }
            audit.observeAdvanceBatch(
                guard,
                roundBefore,
                battle.roundNumber,
                events,
                captureSnapshot(),
                battle.deckModel.exhaust.length,
            );
            if (battle.roundNumber > roundBefore) {
                logBattle(`>>> 第 ${roundBefore} 轮结束，进入轮次 ${battle.roundNumber}`);
            }
        }

        logBattle('模拟结束');
        console.log(
            `[BattleSim] 统计: 友方行动=${allyTurns} 出牌=${cardsPlayed} 魔力不足跳过=${playSkippedNoMana} ` +
            `最终轮次=${battle.roundNumber}`,
        );
        audit.printReport('BattleSimAudit');
        const ok =
            battle.roundNumber >= SIM_TARGET_ROUND &&
            battle.deckModel.totalCount === DECK_SIZE &&
            audit.pass;
        console.log(ok ? '[BattleSim] ✅ 多轮模拟通过' : '[BattleSim] ❌ 多轮模拟失败');

        facade.opLeaveBattle();
        console.log('[BattleSim] ========== 结束 ==========');
    }

    private logRuleHints(): void {
        console.log(
            '[BattleSim] 审计规则: 合计牌数不变 | 摸牌手+1库-1 | 出牌扣费弃+1 | ' +
            `轮次结束魔=${BattleUtil.battleManaPerRound} 手=${BattleUtil.battleRoundStartHandSize} | ` +
            '4槽齐→立即结束本轮',
        );
    }

    private logUnitSpeeds(
        tag: string,
        units: { side: 'ally' | 'enemy'; slotIndex: number; unitId: string; speed: number }[],
    ): void {
        console.log(`[${tag}] ---------- 角色速度 ----------`);
        for (const u of units) {
            const sideLabel = u.side === 'ally' ? '友方' : '敌方';
            console.log(`[${tag}] ${sideLabel} 槽${u.slotIndex} ${u.unitId} 速度=${u.speed}`);
        }
    }

    private createTestDeck(count: number): Card[] {
        const ids = CardUtil.getAllIds();
        const cards: Card[] = [];
        for (let i = 0; i < count; i++) {
            const id = ids.length > 0 ? ids[i % ids.length] : `test_card_${i + 1}`;
            cards.push(new Card(id, 1));
        }
        return cards;
    }

    memoryTest() {
        UIManager.gotoView("MainMenuView");
    }
}

ClassConfig.addClass('TestMediator', TestMediator);
