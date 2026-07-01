import { Card } from '../card/Card';
import { AdventureDeployModel } from '../adventure/AdventureDeployModel';
import { BattleUtil } from '../../util/BattleUtil';
import {
    BattleTurnUtil,
    IBattleTurnOverride,
    IBattleTurnRuleProvider,
} from '../../util/BattleTurnUtil';
import { BattleActionBarModel } from './BattleActionBarModel';
import { BattleDeckModel } from './BattleDeckModel';
import { BattleFieldModel } from './BattleFieldModel';
import { BattleRng } from './BattleRng';
import { IBeginBattleOptions } from './BattleTypes';

/**
 * 单场战斗的全部运行时状态（每场 new，不进 Injector 单例）。
 * Facade 持有 `BattleSession | null`。
 */
export class BattleSession {
    readonly deck = new BattleDeckModel();
    readonly actionBar = new BattleActionBarModel();
    readonly field = new BattleFieldModel();

    private _mana = 0;
    private _roundNumber = 1;
    private _battleSeed = 0;
    private _rng = new BattleRng(1);
    private _turnRuleProvider: IBattleTurnRuleProvider | null = null;
    private _armyId = '';

    get mana(): number {
        return this._mana;
    }

    get roundNumber(): number {
        return this._roundNumber;
    }

    get battleSeed(): number {
        return this._battleSeed;
    }

    get rng(): BattleRng {
        return this._rng;
    }

    get armyId(): string {
        return this._armyId;
    }

    get isActive(): boolean {
        return this.deck.totalCount > 0;
    }

    setTurnRuleProvider(provider: IBattleTurnRuleProvider | null): void {
        this._turnRuleProvider = provider;
    }

    /**
     * 进战初始化：牌堆、跑条、战场单位、RNG。
     * 调用方在之后应调 {@link onRoundStart}。
     */
    begin(
        cards: Card[],
        deploy: AdventureDeployModel,
        enemyIds: string[],
        enemySpeedOf: (id: string) => number,
        options?: IBeginBattleOptions,
    ): void {
        this._armyId = options?.armyId ?? 'army_test';
        this._battleSeed = options?.battleSeed ?? Date.now();
        this._rng = new BattleRng(this._battleSeed);
        this._roundNumber = 1;

        this.field.initFromDeploy(deploy, enemyIds, enemySpeedOf);
        this.actionBar.initFromDeploy(deploy, enemyIds);
        this.deck.initFromCards(cards);

        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getInitialHandOverride?.(),
            options?.override,
        );
        const handSize = BattleTurnUtil.resolveDrawCount(
            ovr.initialHandCount ?? BattleUtil.battleInitialHandSize,
            ovr,
        );
        this.deck.drawToHand(handSize);
    }

    onRoundStart(extraOverride?: IBattleTurnOverride): void {
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getRoundStartOverride?.(this._roundNumber - 1),
            extraOverride,
        );
        this._mana = BattleTurnUtil.resolveManaGain(BattleUtil.battleManaPerRound, ovr);
    }

    onUnitTurnStart(unitId?: string, extraOverride?: IBattleTurnOverride): void {
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getUnitTurnStartOverride?.(unitId, this._roundNumber - 1),
            extraOverride,
        );
        const count = BattleTurnUtil.resolveDrawCount(BattleUtil.battleDrawPerUnitTurn, ovr);
        this.deck.drawToHand(count);
    }

    onRoundEnd(extraOverride?: IBattleTurnOverride): void {
        const ovr = this.mergeOverride(
            this._turnRuleProvider?.getRoundEndOverride?.(this._roundNumber - 1),
            extraOverride,
        );

        if (!ovr.retainHand) {
            this.deck.discardAllHand();
        }
        if (!ovr.retainMana) {
            this._mana = BattleTurnUtil.resolveManaGain(BattleUtil.battleManaPerRound, ovr);
        }

        const drawBase = ovr.roundEndDrawCount ?? BattleUtil.battleRoundStartHandSize;
        this.deck.drawToHand(BattleTurnUtil.resolveDrawCount(drawBase, ovr));
        this._roundNumber++;
    }

    addMana(delta: number): void {
        this._mana = Math.max(0, this._mana + delta);
    }

    spendMana(cost: number): boolean {
        if (cost < 0 || this._mana < cost) {
            return false;
        }
        this._mana -= cost;
        return true;
    }

    setMana(value: number): void {
        this._mana = Math.max(0, value);
    }

    /** 结束战斗：收集全部 Card，清空 session 状态 */
    endAndCollectCards(): Card[] {
        const cards = this.deck.collectAllCards();
        this.reset();
        return cards;
    }

    reset(): void {
        this.deck.resetToDefault();
        this.actionBar.reset();
        this.field.reset();
        this._mana = 0;
        this._roundNumber = 1;
        this._battleSeed = 0;
        this._rng = new BattleRng(1);
        this._turnRuleProvider = null;
        this._armyId = '';
    }

    private mergeOverride(...parts: (IBattleTurnOverride | null | undefined)[]): IBattleTurnOverride {
        return BattleTurnUtil.mergeOverride(...parts);
    }
}
