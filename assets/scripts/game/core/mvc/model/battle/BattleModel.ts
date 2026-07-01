import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { ActionUtil } from '../../util/ActionUtil';
import { BattleTargetUtil } from '../../util/BattleTargetUtil';
import { BattleUtil } from '../../util/BattleUtil';
import { CardUtil } from '../../util/CardUtil';
import {
    BattleTurnUtil,
    IBattleTurnOverride,
    IBattleTurnRuleProvider,
} from '../../util/BattleTurnUtil';
import { Card } from '../card/Card';
import { Model } from '../Model';
import { BattleDeckModel } from './BattleDeckModel';
import { EChooseTarget } from './EChooseTarget';
import { IBattleFieldContext } from './IBattleFieldContext';
import {
    EmptyBattleUnitStatusProvider,
    IBattleUnitStatusProvider,
} from './IBattleUnitStatusProvider';

export interface IBattlePlayCardRequest {
    card: Card;
    actorUnitId: string;
    field: IBattleFieldContext;
    /** 未传且 chooseTarget≠none 时由 Model 随机合法目标 */
    chosenTargetId?: string | null;
}

export interface IBattlePlayCardResult {
    ok: boolean;
    cardId?: string;
    manaCost: number;
    reason?: string;
    actorUnitId?: string;
    chosenTargetId?: string | null;
}

export interface IBeginBattleOptions {
    /** 战斗随机种子；同一 seed + 同一操作序列 → 敌人行为一致（AI/replay 未实现，先占位） */
    battleSeed?: number;
    /** 进战初始手牌覆盖（叠在 ruleProvider 之后） */
    override?: IBattleTurnOverride;
    /** 敌军队伍 ArmyConfig.id，默认 army_test */
    armyId?: string;
}

/**
 * 单场战斗运行时数据（牌堆、回合、魔力等；一般不写入冒险存档）。
 * 卡牌效果以后在此编排：读 ActionConfig → 调 deckModel 的通用 API → 需要时由 Facade 打开选牌 UI。
 *
 * TODO 确定性重进：战斗不进存档；重打同一战需保存/还原 battleSeed + 玩家操作序列，敌人用 seed 驱动 RNG replay。
 */
export class BattleModel extends Model {
    private _deckModel = new BattleDeckModel();
    private _mana = 0;
    /** 当前轮次：进战为 1，友方全员至少行动一次后 {@link onRoundEnd} +1 */
    private _roundNumber = 1;
    private _battleSeed = 0;
    private _turnRuleProvider: IBattleTurnRuleProvider | null = null;
    private _unitStatus: IBattleUnitStatusProvider = new EmptyBattleUnitStatusProvider();

    get deckModel(): BattleDeckModel {
        return this._deckModel;
    }

    /** 当前魔力（全队共享） */
    get mana(): number {
        return this._mana;
    }

    /** 当前轮次（从 1 起；友方 4 槽都动过后 +1） */
    get roundNumber(): number {
        return this._roundNumber;
    }

    /**
     * 本场战斗 RNG 种子（敌人 AI、随机效果应读此 seed，勿直接用 Math.random）。
     * 重进战斗 replay 时须与战前一致。
     */
    get battleSeed(): number {
        return this._battleSeed;
    }

    get isInBattle(): boolean {
        return this._deckModel.totalCount > 0;
    }

    /** 注册整场战斗的规则来源（遗物/被动等）；传 null 清除 */
    setTurnRuleProvider(provider: IBattleTurnRuleProvider | null): void {
        this._turnRuleProvider = provider;
    }

    /** 单位 buff（沉默、失控等）；Facade 在进战时注入 */
    setUnitStatusProvider(provider: IBattleUnitStatusProvider): void {
        this._unitStatus = provider;
    }

    /**
     * 进战斗：接管 Card 引用、初始化牌堆并发放初始手牌。
     * 进战后调 {@link onRoundStart} 发放首轮魔力。
     */
    beginFromAdventureCards(cards: Card[], options?: IBeginBattleOptions): void {
        this._battleSeed = options?.battleSeed ?? Date.now();
        this._roundNumber = 1;
        this._deckModel.initFromCards(cards);
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getInitialHandOverride?.(),
            options?.override,
        );
        const handSize = BattleTurnUtil.resolveDrawCount(
            ovr.initialHandCount ?? BattleUtil.battleInitialHandSize,
            ovr,
        );
        this._deckModel.drawToHand(handSize);
    }

    /** 轮次开始：按 ConfigValue 基础值 + 覆盖发放魔力 */
    onRoundStart(extraOverride?: IBattleTurnOverride): void {
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getRoundStartOverride?.(this._roundNumber - 1),
            extraOverride,
        );
        this._mana = BattleTurnUtil.resolveManaGain(BattleUtil.battleManaPerRound, ovr);
    }

    /**
     * 单位回合开始：摸牌（单位回合结束不丢手牌）。
     * @param unitId 角色 id，供 ruleProvider 按人加摸牌等
     */
    onUnitTurnStart(unitId?: string, extraOverride?: IBattleTurnOverride): void {
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getUnitTurnStartOverride?.(unitId, this._roundNumber - 1),
            extraOverride,
        );
        const count = BattleTurnUtil.resolveDrawCount(BattleUtil.battleDrawPerUnitTurn, ovr);
        this._deckModel.drawToHand(count);
    }

    /**
     * 轮次结束：默认弃手牌 → 重发魔力 → 补牌；可通过 override 保留手牌/魔力或 x2、/2。
     */
    onRoundEnd(extraOverride?: IBattleTurnOverride): void {
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getRoundEndOverride?.(this._roundNumber - 1),
            extraOverride,
        );

        if (!ovr.retainHand) {
            this._deckModel.discardAllHand();
        }
        if (!ovr.retainMana) {
            this._mana = BattleTurnUtil.resolveManaGain(BattleUtil.battleManaPerRound, ovr);
        }

        const drawBase = ovr.roundEndDrawCount ?? BattleUtil.battleRoundStartHandSize;
        this._deckModel.drawToHand(BattleTurnUtil.resolveDrawCount(drawBase, ovr));

        this._roundNumber++;
    }

    /** 打牌、效果中增减魔力（结果不小于 0） */
    addMana(delta: number): void {
        this._mana = Math.max(0, this._mana + delta);
    }

    /** 消耗魔力；不足返回 false */
    spendMana(cost: number): boolean {
        if (cost < 0 || this._mana < cost) {
            return false;
        }
        this._mana -= cost;
        return true;
    }

    /** 直接设定魔力（机制用；一般优先 addMana / spendMana） */
    setMana(value: number): void {
        this._mana = Math.max(0, value);
    }

    static readonly PLAY_FAIL_NO_HAND = 'no_hand';
    static readonly PLAY_FAIL_NO_MANA = 'no_mana';
    static readonly PLAY_FAIL_SILENCED = 'silenced';
    static readonly PLAY_FAIL_NO_TARGET = 'no_target';
    static readonly PLAY_FAIL_NOT_IN_HAND = 'not_in_hand';

    getCardManaCost(cardId: string): number {
        return CardUtil.getManaPoint(cardId);
    }

    /**
     * 打出一张手牌：沉默/缴械检查 → 扣费 → 弃牌堆 →（TODO）ActionConfig 效果。
     * chooseTarget 为 enemy/self 时随机合法选择目标；none 时不选目标。
     */
    playCard(req: IBattlePlayCardRequest): IBattlePlayCardResult {
        const { card, actorUnitId, field } = req;
        const cost = this.getCardManaCost(card.id);
        const base: IBattlePlayCardResult = { ok: false, cardId: card.id, manaCost: cost, actorUnitId };

        if (!this._unitStatus.canPlayCards(actorUnitId)) {
            return { ...base, reason: BattleModel.PLAY_FAIL_SILENCED };
        }
        if (!this._deckModel.hand.includes(card)) {
            return { ...base, reason: BattleModel.PLAY_FAIL_NOT_IN_HAND };
        }
        if (this._mana < cost) {
            return { ...base, reason: BattleModel.PLAY_FAIL_NO_MANA };
        }

        const actionId = CardUtil.getActionId(card.id);
        const chooseTarget = ActionUtil.getChooseTargetForCard(card.id, actionId);
        let chosenTargetId = req.chosenTargetId ?? null;
        if (chooseTarget !== EChooseTarget.None && chosenTargetId == null) {
            chosenTargetId = BattleTargetUtil.pickRandomChooseTarget(
                chooseTarget,
                field.allyUnitIds,
                field.enemyUnitIds,
            );
        }
        if (chooseTarget !== EChooseTarget.None && chosenTargetId == null) {
            return { ...base, reason: BattleModel.PLAY_FAIL_NO_TARGET };
        }

        if (!this.spendMana(cost)) {
            return { ...base, reason: BattleModel.PLAY_FAIL_NO_MANA };
        }
        if (!this._deckModel.discardFromHand(card)) {
            this.addMana(cost);
            return { ...base, reason: 'discard_fail' };
        }

        return {
            ok: true,
            cardId: card.id,
            manaCost: cost,
            actorUnitId,
            chosenTargetId,
        };
    }

    /** @deprecated 请用 {@link playCard}；测试兼容 hand 顶 */
    tryPlayHandTopCard(): IBattlePlayCardResult {
        const hand = this._deckModel.hand;
        if (hand.length === 0) {
            return { ok: false, manaCost: 0, reason: BattleModel.PLAY_FAIL_NO_HAND };
        }
        const card = hand[hand.length - 1];
        const cost = this.getCardManaCost(card.id);
        if (this._mana < cost) {
            return { ok: false, cardId: card.id, manaCost: cost, reason: BattleModel.PLAY_FAIL_NO_MANA };
        }
        if (!this.spendMana(cost)) {
            return { ok: false, cardId: card.id, manaCost: cost, reason: BattleModel.PLAY_FAIL_NO_MANA };
        }
        if (!this._deckModel.discardFromHand(card)) {
            this.addMana(cost);
            return { ok: false, cardId: card.id, manaCost: cost, reason: 'discard_fail' };
        }
        return { ok: true, cardId: card.id, manaCost: cost };
    }

    /**
     * 出战斗：收集全部 Card 并清空战斗牌堆。
     * 典型用法：`adventureCardModel.restoreFromBattle(battleModel.endBattleAndCollectCards())`
     */
    endBattleAndCollectCards(): Card[] {
        const cards = this._deckModel.collectAllCards();
        this.resetToDefault();
        return cards;
    }

    synchronize(_data?: unknown): void {
        this.resetToDefault();
    }

    getSaveData(): null {
        return null;
    }

    resetToDefault(): void {
        this._deckModel.resetToDefault();
        this._mana = 0;
        this._roundNumber = 1;
        this._battleSeed = 0;
        this._turnRuleProvider = null;
        this._unitStatus = new EmptyBattleUnitStatusProvider();
    }

    private mergeOverride(...parts: (IBattleTurnOverride | null | undefined)[]): IBattleTurnOverride {
        return BattleTurnUtil.mergeOverride(...parts);
    }
}

ClassConfig.addClass('BattleModel', BattleModel);
