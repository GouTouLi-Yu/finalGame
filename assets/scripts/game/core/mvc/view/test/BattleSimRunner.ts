import { BattleFacade } from '../../facade/battle/BattleFacade';
import { IBattleUnitTurnEvent, IBattleUnitTurnSnapshot } from '../../model/battle/BattleActionBarModel';
import { BattleSession } from '../../model/battle/BattleSession';
import { EBattleSide } from '../../model/battle/EBattleSide';
import { TestAutoPlayPolicy } from '../../policy/battle/IAutoPlayPolicy';
import { Card } from '../../model/card/Card';
import { Player } from '../../model/Player/Player';
import { ArmyUtil } from '../../util/ArmyUtil';
import { BattleSnapshotUtil } from '../../util/BattleSnapshotUtil';
import { BattleUtil } from '../../util/BattleUtil';
import { CardUtil } from '../../util/CardUtil';
import { EnemyUtil } from '../../util/EnemyUtil';
import { BattleSimValidator } from './BattleSimValidator';

export interface IBattleSimRunOptions {
    deckSize?: number;
    targetRound?: number;
    armyId?: string;
}

export interface IBattleSimRunResult {
    pass: boolean;
    allyTurns: number;
    cardsPlayed: number;
    playSkippedNoMana: number;
    finalRound: number;
    auditChecks: number;
    auditFailures: number;
}

/**
 * 无 UI 战斗模拟（从 TestMediator 抽出，Mediator 只负责触发）。
 */
export class BattleSimRunner {
    static run(options: IBattleSimRunOptions = {}): IBattleSimRunResult {
        const DECK_SIZE = options.deckSize ?? 23;
        const SIM_TARGET_ROUND = options.targetRound ?? 4;
        const armyId = options.armyId ?? 'army_test';

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

        const enemyIds = ArmyUtil.getEnemyIds(armyId);
        this.logUnitSpeeds('BattleSim', [
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
        ]);

        const facade = BattleFacade.getInstance();
        facade.setAutoPlayPolicy(new TestAutoPlayPolicy());

        if (!facade.opEnterBattle({ armyId })) {
            console.log('[BattleSim] ❌ 进战失败');
            return {
                pass: false,
                allyTurns: 0,
                cardsPlayed: 0,
                playSkippedNoMana: 0,
                finalRound: 0,
                auditChecks: 0,
                auditFailures: 1,
            };
        }

        const session = facade.session!;
        const activeSlots = deploy.getActiveCombatants().map((c) => c.slotIndex);
        const audit = new BattleSimValidator(DECK_SIZE, activeSlots);
        let allyTurns = 0;
        let cardsPlayed = 0;
        let playSkippedNoMana = 0;

        const logSnapshot = (step: string, s: IBattleUnitTurnSnapshot) => {
            console.log(
                `[BattleSim] ${step} | 轮次=${s.roundNumber} 魔力=${s.mana} 手牌=${s.hand} ` +
                `抽牌堆=${s.library} 弃牌堆=${s.discard} 消耗=${session.deck.exhaust.length} 合计=${s.total}`,
            );
        };
        const capture = () => BattleSnapshotUtil.capture(session);
        const logBattle = (step: string) => logSnapshot(step, capture());

        console.log('[BattleSim] ========== 多轮出牌模拟 ==========');
        logBattle('opEnterBattle');
        audit.observe('opEnterBattle', capture(), session.deck.exhaust.length);
        this.logRuleHints();

        let guard = 0;
        while (session.roundNumber < SIM_TARGET_ROUND && guard++ < 200) {
            const roundBefore = session.roundNumber;
            const events = facade.opAdvanceActionBar({ autoPlayPolicy: new TestAutoPlayPolicy() });
            if (events.length === 0) {
                console.log('[BattleSim] ⚠ 跑条无推进，提前结束');
                break;
            }
            this.logEvents(session, events, () => {
                allyTurns++;
                return allyTurns;
            }, (n) => { cardsPlayed += n; }, () => { playSkippedNoMana++; });
            audit.observeAdvanceBatch(
                guard,
                roundBefore,
                session.roundNumber,
                events,
                capture(),
                session.deck.exhaust.length,
            );
            if (session.roundNumber > roundBefore) {
                logBattle(`>>> 第 ${roundBefore} 轮结束，进入轮次 ${session.roundNumber}`);
            }
        }

        logBattle('模拟结束');
        console.log(
            `[BattleSim] 统计: 友方行动=${allyTurns} 出牌=${cardsPlayed} 魔力不足跳过=${playSkippedNoMana} ` +
            `最终轮次=${session.roundNumber}`,
        );
        audit.printReport('BattleSimAudit');
        const finalRound = session.roundNumber;
        const pass =
            finalRound >= SIM_TARGET_ROUND &&
            session.deck.totalCount === DECK_SIZE &&
            audit.pass;
        console.log(pass ? '[BattleSim] ✅ 多轮模拟通过' : '[BattleSim] ❌ 多轮模拟失败');

        facade.opLeaveBattle();
        console.log('[BattleSim] ========== 结束 ==========');

        return {
            pass,
            allyTurns,
            cardsPlayed,
            playSkippedNoMana,
            finalRound,
            auditChecks: audit.checkCount,
            auditFailures: audit.failureCount,
        };
    }

    private static logEvents(
        session: BattleSession,
        events: IBattleUnitTurnEvent[],
        nextAllyTurn: () => number,
        onCardPlayed: (n: number) => void,
        onSkipNoMana: () => void,
    ): void {
        for (const e of events) {
            if (e.side !== EBattleSide.Ally) {
                console.log(`[BattleSim] [敌] ${e.unitId} 行动`);
                continue;
            }
            const turn = nextAllyTurn();
            if (e.snapshotAfterTurn != null) {
                BattleSimRunner.logSnap(session, `[${turn}] ${e.unitId} 摸牌后`, e.snapshotAfterTurn);
            }
            const plays = e.autoPlayResults ?? (e.playResult != null ? [e.playResult] : []);
            const successes = plays.filter((p) => p.ok);

            for (const play of successes) {
                onCardPlayed(1);
                if (e.snapshotAfterPlay != null) {
                    const targetHint = play.chosenTargetId != null ? ` →${play.chosenTargetId}` : '';
                    BattleSimRunner.logSnap(
                        session,
                        `[${turn}] ${e.unitId} 出牌 ${play.cardId} 费${play.manaCost}${targetHint}`,
                        e.snapshotAfterPlay,
                    );
                }
            }

            if (successes.length === 0 && e.snapshotAfterPlay != null) {
                const afterDraw = e.snapshotAfterTurn;
                const noPlay =
                    afterDraw != null &&
                    afterDraw.mana === e.snapshotAfterPlay.mana &&
                    afterDraw.hand === e.snapshotAfterPlay.hand &&
                    afterDraw.discard === e.snapshotAfterPlay.discard;
                if (noPlay) {
                    onSkipNoMana();
                    BattleSimRunner.logSnap(
                        session,
                        `[${turn}] ${e.unitId} 本回合未出牌(魔力不足或无可用牌)`,
                        e.snapshotAfterPlay,
                    );
                }
            }
        }
    }

    private static logSnap(_session: BattleSession, step: string, s: IBattleUnitTurnSnapshot): void {
        console.log(
            `[BattleSim] ${step} | 轮次=${s.roundNumber} 魔力=${s.mana} 手牌=${s.hand} ` +
            `抽牌堆=${s.library} 弃牌堆=${s.discard} 合计=${s.total}`,
        );
    }

    private static logRuleHints(): void {
        console.log(
            '[BattleSim] 审计规则: 合计牌数不变 | 摸牌手+1库-1 | 出牌扣费弃+1 | ' +
            `轮次结束魔=${BattleUtil.battleManaPerRound} 手=${BattleUtil.battleRoundStartHandSize} | ` +
            '4槽齐→立即结束本轮',
        );
    }

    private static logUnitSpeeds(
        tag: string,
        units: { side: 'ally' | 'enemy'; slotIndex: number; unitId: string; speed: number }[],
    ): void {
        console.log(`[${tag}] ---------- 角色速度 ----------`);
        for (const u of units) {
            const sideLabel = u.side === 'ally' ? '友方' : '敌方';
            console.log(`[${tag}] ${sideLabel} 槽${u.slotIndex} ${u.unitId} 速度=${u.speed}`);
        }
    }

    private static createTestDeck(count: number): Card[] {
        const ids = CardUtil.getAllIds();
        const cards: Card[] = [];
        for (let i = 0; i < count; i++) {
            const id = ids.length > 0 ? ids[i % ids.length] : `test_card_${i + 1}`;
            cards.push(new Card(id, 1));
        }
        return cards;
    }
}
