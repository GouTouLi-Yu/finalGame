import { IBattleUnitTurnEvent, IBattleUnitTurnSnapshot } from 'db://assets/scripts/game/core/mvc/model/battle/BattleActionBarModel';
import { EBattlePlayFail } from 'db://assets/scripts/game/core/mvc/model/battle/BattleTypes';
import { EBattleSide } from 'db://assets/scripts/game/core/mvc/model/battle/BattleEnums';
import { BattleUtil } from 'db://assets/scripts/game/core/mvc/util/BattleUtil';
import { CardUtil } from 'db://assets/scripts/game/core/mvc/util/CardUtil';

/**
 * 无 UI 时的战斗模拟审计：每步检查不变量，最后汇总。
 * 全部通过才可认为「与规则一致」。
 */
export class BattleSimValidator {
    private _checks = 0;
    private _failures: string[] = [];
    private _lastSnapshot: IBattleUnitTurnSnapshot | null = null;
    /** 当前友方轮次内已行动的槽位 */
    private _actedSlots = new Set<number>();
    private readonly _deckSize: number;
    private readonly _activeSlots: readonly number[];

    constructor(deckSize: number, activeSlotIndices: readonly number[]) {
        this._deckSize = deckSize;
        this._activeSlots = activeSlotIndices;
    }

    get pass(): boolean {
        return this._failures.length === 0;
    }

    get failureCount(): number {
        return this._failures.length;
    }

    get checkCount(): number {
        return this._checks;
    }

    /** 进战 / 轮次结束后的基准快照 */
    observe(label: string, s: IBattleUnitTurnSnapshot, exhaustCount: number): void {
        this.assertDeckTotal(label, s, exhaustCount);
        this.assertNonNegative(label, s, exhaustCount);
        this._lastSnapshot = s;
    }

    /** 单次 opAdvanceActionBar 返回的事件 */
    observeAdvanceBatch(
        stepIndex: number,
        roundBefore: number,
        roundAfter: number,
        events: IBattleUnitTurnEvent[],
        postBatchSnapshot: IBattleUnitTurnSnapshot,
        exhaustCount: number,
    ): void {
        const tag = `推进#${stepIndex}`;
        let allyInBatch = 0;
        for (const e of events) {
            if (e.side !== EBattleSide.Ally) {
                continue;
            }
            allyInBatch++;
            this.observeAllyTurn(`${tag} ${e.unitId}`, e, exhaustCount);
            this._actedSlots.add(e.slotIndex);
        }
        if (roundAfter > roundBefore) {
            this.assertRoundEnd(`${tag} 轮次 ${roundBefore}→${roundAfter}`, roundBefore, roundAfter, postBatchSnapshot, exhaustCount);
            if (allyInBatch > 0) {
                this.check(
                    `${tag} 轮次结束时应刚凑齐 ${this._activeSlots.length} 槽`,
                    this._actedSlots.size === this._activeSlots.length,
                    `已动槽=${[...this._actedSlots].sort().join(',')}`,
                );
            }
            this._actedSlots.clear();
            this._lastSnapshot = postBatchSnapshot;
        } else if (allyInBatch > 0) {
            this.check(
                `${tag} 本轮未满员不应结束轮次`,
                this._actedSlots.size < this._activeSlots.length,
                `已动=${this._actedSlots.size}`,
            );
        }
    }

    private observeAllyTurn(label: string, e: IBattleUnitTurnEvent, exhaustCount: number): void {
        const prev = this._lastSnapshot;
        if (e.snapshotAfterTurn != null) {
            if (prev != null) {
                this.check(
                    `${label} 摸牌后合计不变`,
                    e.snapshotAfterTurn.total === this._deckSize,
                    `合计=${e.snapshotAfterTurn.total}`,
                );
                this.check(
                    `${label} 摸牌后手牌+1`,
                    e.snapshotAfterTurn.hand === prev.hand + 1,
                    `前=${prev.hand} 后=${e.snapshotAfterTurn.hand}`,
                );
                if (prev.library > 0) {
                    this.check(
                        `${label} 摸牌后抽牌堆-1`,
                        e.snapshotAfterTurn.library === prev.library - 1,
                        `前=${prev.library} 后=${e.snapshotAfterTurn.library}`,
                    );
                } else {
                    this.check(
                        `${label} 空库摸牌（洗入弃牌）后合计仍对`,
                        e.snapshotAfterTurn.total === this._deckSize,
                        `合计=${e.snapshotAfterTurn.total}`,
                    );
                }
                this.check(
                    `${label} 摸牌后轮次不变`,
                    e.snapshotAfterTurn.roundNumber === prev.roundNumber,
                    `前=${prev.roundNumber} 后=${e.snapshotAfterTurn.roundNumber}`,
                );
            }
            this.assertDeckTotal(`${label} 摸牌后`, e.snapshotAfterTurn, exhaustCount);
            this._lastSnapshot = e.snapshotAfterTurn;
        }

        const plays = e.autoPlayResults ?? (e.playResult != null ? [e.playResult] : []);
        const afterPlay = e.snapshotAfterPlay;
        if (plays.length === 0 || afterPlay == null) {
            return;
        }
        const afterDraw = e.snapshotAfterTurn ?? this._lastSnapshot;
        if (afterDraw == null) {
            return;
        }

        let simMana = afterDraw.mana;
        let simHand = afterDraw.hand;
        let simDiscard = afterDraw.discard;

        for (let i = 0; i < plays.length; i++) {
            const play = plays[i];
            const stepLabel = `${label} 出牌#${i + 1}`;

            if (play.ok) {
                this.check(
                    `${stepLabel} 魔力`,
                    simMana >= play.manaCost,
                    `魔=${simMana} 费=${play.manaCost}`,
                );
                simMana -= play.manaCost;
                simHand -= 1;
                simDiscard += 1;
                const cfgCost = play.cardId != null ? CardUtil.getManaPoint(play.cardId) : play.manaCost;
                this.check(
                    `${stepLabel} 费用与配表一致`,
                    play.manaCost === cfgCost,
                    `play=${play.manaCost} cfg=${cfgCost}`,
                );
            } else if (play.reason === EBattlePlayFail.NO_MANA) {
                this.check(
                    `${stepLabel} 魔力不足时状态不变`,
                    true,
                    '',
                );
            }
        }

        this.check(
            `${label} 出牌后魔力`,
            afterPlay.mana === simMana,
            `期望=${simMana} 实际=${afterPlay.mana}`,
        );
        this.check(
            `${label} 出牌后手牌`,
            afterPlay.hand === simHand,
            `期望=${simHand} 实际=${afterPlay.hand}`,
        );
        this.check(
            `${label} 出牌后弃牌`,
            afterPlay.discard === simDiscard,
            `期望=${simDiscard} 实际=${afterPlay.discard}`,
        );
        this.assertDeckTotal(`${label} 出牌后`, afterPlay, exhaustCount);
        this._lastSnapshot = afterPlay;
    }

    private assertRoundEnd(
        label: string,
        roundBefore: number,
        roundAfter: number,
        s: IBattleUnitTurnSnapshot,
        exhaustCount: number,
    ): void {
        this.check(`${label} 轮次+1`, roundAfter === roundBefore + 1, `${roundBefore}→${roundAfter}`);
        this.check(
            `${label} 重发魔力`,
            s.mana === BattleUtil.battleManaPerRound,
            `魔力=${s.mana} 期望=${BattleUtil.battleManaPerRound}`,
        );
        this.check(
            `${label} 补牌到手牌`,
            s.hand === BattleUtil.battleRoundStartHandSize,
            `手牌=${s.hand} 期望=${BattleUtil.battleRoundStartHandSize}`,
        );
        this.assertDeckTotal(label, s, exhaustCount);
    }

    private assertDeckTotal(label: string, s: IBattleUnitTurnSnapshot, exhaustCount: number): void {
        const piles = s.hand + s.library + s.discard + exhaustCount;
        this.check(
            `${label} 牌总数=${this._deckSize}`,
            s.total === this._deckSize && piles === this._deckSize,
            `合计=${s.total} 四堆=${piles} (消=${exhaustCount})`,
        );
    }

    private assertNonNegative(label: string, s: IBattleUnitTurnSnapshot, exhaustCount: number): void {
        this.check(`${label} 魔力≥0`, s.mana >= 0, `${s.mana}`);
        this.check(`${label} 各堆≥0`, s.hand >= 0 && s.library >= 0 && s.discard >= 0 && exhaustCount >= 0, '');
    }

    private check(label: string, ok: boolean, detail: string): void {
        this._checks++;
        if (!ok) {
            this._failures.push(`${label}${detail ? ` (${detail})` : ''}`);
        }
    }

    printReport(tag: string): void {
        console.log(`[${tag}] ---------- 规则审计 ----------`);
        console.log(`[${tag}] 检查项 ${this._checks}，失败 ${this._failures.length}`);
        for (const f of this._failures) {
            console.warn(`[${tag}] ❌ ${f}`);
        }
        if (this.pass) {
            console.log(`[${tag}] ✅ 全部不变量通过（${this._checks} 项）`);
        } else {
            console.error(`[${tag}] ❌ 审计未通过，请对照上面 ❌ 项排查`);
        }
    }
}
