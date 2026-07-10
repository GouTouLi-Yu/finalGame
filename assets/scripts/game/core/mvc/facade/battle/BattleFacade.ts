import Facade from 'db://assets/scripts/frame/base/Facade';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { PCEventType } from 'db://assets/scripts/frame/event/PCEventType';
import { IBattleUnitTurnEvent } from 'db://assets/scripts/game/core/mvc/model/battle/BattleActionBarModel';
import { IBattleHandChangedPayload } from 'db://assets/scripts/game/core/mvc/model/battle/BattleHandEvents';
import { IBattlePlayerTurnChangedPayload } from 'db://assets/scripts/game/core/mvc/model/battle/BattlePlayerTurnEvents';
import { BattleSession } from 'db://assets/scripts/game/core/mvc/model/battle/BattleSession';
import { IBeginBattleOptions, IBattlePlayCardRequest, IBattlePlayCardResult } from 'db://assets/scripts/game/core/mvc/model/battle/BattleTypes';
import { Card } from 'db://assets/scripts/game/core/mvc/model/card/Card';
import { IAdventureBattlePort } from 'db://assets/scripts/game/core/mvc/port/IAdventureBattlePort';
import { DevAllCardUnlockProvider, ICardUnlockProvider } from 'db://assets/scripts/game/core/mvc/port/ICardUnlockProvider';
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
import { CardUtil } from 'db://assets/scripts/game/core/mvc/util/CardUtil';
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
    private _cardUnlock: ICardUnlockProvider = new DevAllCardUnlockProvider(() => CardUtil.getAllIds());

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

    /** 当前等待玩家出牌的友方 unitId；无可操作回合时为 null */
    get currentActorUnitId(): string | null {
        return this._session?.currentActorUnitId ?? null;
    }

    get isWaitingPlayerTurn(): boolean {
        return this._session?.pendingPlayerTurn != null;
    }

    setAdventurePort(port: IAdventureBattlePort): void {
        this._adventurePort = port;
    }

    setAutoPlayPolicy(policy: IAutoPlayPolicy): void {
        this._autoPlayPolicy = policy;
    }

    setCardUnlockProvider(provider: ICardUnlockProvider): void {
        this._cardUnlock = provider;
    }

    /**
     * 开发用手牌测试：无 Session 时创建一场测试战斗。
     * 若编队为空则临时塞 4 个友方，便于进玩家回合测拖拽出牌。
     */
    opEnsureDevHandTestBattle(): boolean {
        if (this._session?.isActive) {
            return true;
        }
        const deploy = this._adventurePort.getDeployModel();
        if (deploy.getActiveCombatants().length === 0) {
            const speeds = [200, 100, 150, 120];
            for (let i = 0; i < 4; i++) {
                deploy.assignHeroToActive(i, `hero_${i + 1}`, speeds[i], 1);
            }
        }
        const enemyIds = ArmyUtil.getEnemyIds('army_test');
        const session = new BattleSession();
        session.begin(
            [new Card('card_001', 1)],
            deploy,
            enemyIds,
            (id) => EnemyUtil.getSpeed(id),
            { armyId: 'army_test' },
        );
        session.onRoundStart();
        this._session = session;
        this.notifyPlayerTurnChanged();
        return true;
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
        this.notifyPlayerTurnChanged();
        return true;
    }

    /**
     * 跑条推进一步。
     * 若进入友方玩家回合，会停在等待状态，需玩家出牌后 {@link opEndPlayerTurn} 再继续。
     * 测试/自动战斗可传 `autoPlayPolicy` 跳过等待。
     */
    opAdvanceActionBar(options?: IAdvanceActionBarOptions): IBattleUnitTurnEvent[] {
        if (this._session == null) {
            return [];
        }
        const events = BattleTurnOrchestrator.advance(this._session, this._autoPlayPolicy, options);
        this.notifyPlayerTurnChanged();
        this.notifyHandChanged();
        return events;
    }

    /** 结束当前玩家单位回合，允许跑条继续推进 */
    opEndPlayerTurn(): boolean {
        if (this._session == null) {
            return false;
        }
        const ok = BattleTurnOrchestrator.finishPlayerTurn(this._session);
        if (ok) {
            this.notifyPlayerTurnChanged();
            this.notifyHandChanged();
        }
        return ok;
    }

    /** 手点出牌（UI 调此入口）；actorUnitId 可省略，默认当前玩家回合单位 */
    opPlayCard(req: IBattlePlayCardRequest): IBattlePlayCardResult {
        if (this._session == null) {
            return { ok: false, manaCost: 0, reason: 'not_in_battle' };
        }
        const actorUnitId = req.actorUnitId || this._session.currentActorUnitId;
        if (actorUnitId == null || actorUnitId === '') {
            return { ok: false, manaCost: 0, reason: 'not_player_turn', cardId: req.card.id };
        }
        const res = BattlePlayService.play(this._session, { ...req, actorUnitId });
        if (res.ok) {
            this.notifyHandChanged();
        }
        return res;
    }

    /** 秘籍：添加指定 id 手牌，返回实际添加张数 */
    cheatAddHandCard(cardId: string, count: number): number {
        if (!this.opEnsureDevHandTestBattle() || this._session == null) {
            return 0;
        }
        if (!CardUtil.isValidCardId(cardId) || count <= 0) {
            return 0;
        }
        const deck = this._session.deck;
        let added = 0;
        for (let i = 0; i < count; i++) {
            if (deck.handCapacityRemaining <= 0) {
                break;
            }
            if (!deck.addToHand(new Card(cardId, 1))) {
                break;
            }
            added++;
        }
        if (added > 0) {
            this.notifyHandChanged();
        }
        return added;
    }

    /** 秘籍：随机添加已解锁手牌 */
    cheatAddRandomHandCard(count: number): number {
        if (!this.opEnsureDevHandTestBattle() || this._session == null || count <= 0) {
            return 0;
        }
        const unlocked = this._cardUnlock.getUnlockedCardIds();
        if (unlocked.length === 0) {
            return 0;
        }
        const deck = this._session.deck;
        let added = 0;
        for (let i = 0; i < count; i++) {
            if (deck.handCapacityRemaining <= 0) {
                break;
            }
            const pick = unlocked[Math.floor(Math.random() * unlocked.length)];
            if (pick == null || !deck.addToHand(new Card(pick, 1))) {
                break;
            }
            added++;
        }
        if (added > 0) {
            this.notifyHandChanged();
        }
        return added;
    }

    /** 秘籍：删除从左到右第 n 张（1~10） */
    cheatRemoveHandAtPosition(oneBased: number): boolean {
        if (!this.opEnsureDevHandTestBattle() || this._session == null) {
            return false;
        }
        const card = this._session.deck.removeHandAtPosition(oneBased);
        if (card == null) {
            return false;
        }
        this._session.deck.putOnTopOfDiscard(card);
        this.notifyHandChanged();
        return true;
    }

    /** 秘籍：清空手牌（弃入弃牌堆） */
    cheatClearHand(): number {
        if (!this.opEnsureDevHandTestBattle() || this._session == null) {
            return 0;
        }
        const cards = this._session.deck.clearHand();
        for (const c of cards) {
            this._session.deck.putOnTopOfDiscard(c);
        }
        if (cards.length > 0) {
            this.notifyHandChanged();
        }
        return cards.length;
    }

    /** 秘籍：按 id 删除手牌中全部同名牌 */
    cheatRemoveHandByCardId(cardId: string): number {
        if (!this.opEnsureDevHandTestBattle() || this._session == null || !CardUtil.isValidCardId(cardId)) {
            return 0;
        }
        const removed = this._session.deck.removeAllFromHandById(cardId);
        for (const c of removed) {
            this._session.deck.putOnTopOfDiscard(c);
        }
        if (removed.length > 0) {
            this.notifyHandChanged();
        }
        return removed.length;
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
        this.notifyPlayerTurnChanged();
        this.notifyHandChanged();
    }

    private notifyHandChanged(): void {
        const payload: IBattleHandChangedPayload = {
            handCount: this._session?.deck.hand.length ?? 0,
        };
        this.dispatch(PCEventType.EVT_BATTLE_HAND_CHANGED, payload);
    }

    private notifyPlayerTurnChanged(): void {
        const pending = this._session?.pendingPlayerTurn ?? null;
        const payload: IBattlePlayerTurnChangedPayload = {
            unitId: pending?.unitId ?? null,
            slotIndex: pending?.slotIndex ?? null,
        };
        this.dispatch(PCEventType.EVT_BATTLE_PLAYER_TURN_CHANGED, payload);
    }
}

ClassConfig.addClass('BattleFacade', BattleFacade);
