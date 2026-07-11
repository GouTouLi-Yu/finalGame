import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { BattleAnimIdResolver } from '../../../../anim/BattleAnimIdResolver';
import { BattleAnimLoadScheduler } from '../../../../anim/BattleAnimLoadScheduler';
import { IBattleAnimUnitRef } from '../../../../anim/BattleAnimCatalog';
import { UIManager } from '../../../../ui/UIManager';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { BattleFacade } from '../../facade/battle/BattleFacade';
import { Player } from '../../model/Player/Player';
import { ArmyUtil } from '../../util/ArmyUtil';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

/** 冒险当前事件类型（正式事件系统接入前先用此枚举） */
export enum EAdventureEventType {
    None = 'none',
    Battle = 'battle',
    // Shop / Rest / Elite ... 以后扩展
}

/**
 * 冒险全屏界面。
 * 约定：界面 id `AdventureView` → `prefab/adventure/AdventureLayer`（ui bundle）。
 * 预制体含 Button（节点名 Button / btn / btn_battle 之一）。
 */
export class AdventureMediator extends AreaViewMediator {
    public static fullPath = 'prefab/adventure';

    BtnHandles: Record<string, string> = {
        Button: 'onClickEnterBattle',
        btn: 'onClickEnterBattle',
        btn_battle: 'onClickEnterBattle',
    };

    private _entering = false;
    private static readonly DEFAULT_ARMY_ID = 'army_test';
    private static readonly BATTLE_VIEW_ID = 'BattleView';

    public initialize(..._any: unknown[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.mapEventListeners();
    }

    public onRemove(): void {
        // 仅当预热节点仍未打开时回收；已 gotoView 消费的不要在这里 destroy
        // （Adventure 被 clearAreaLayer dismiss 时会走到 onRemove）
        // discard 内部会检查 map，已 delete 则无操作
        UIManager.discardPrewarmedView(AdventureMediator.BATTLE_VIEW_ID);
        super.onRemove();
    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
    }

    public enterWithData(_data?: unknown): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: unknown): void {
        this._entering = false;
        this.ensureDevDeploy();
        this.tryPreloadForCurrentEvent();
    }

    async onClickEnterBattle(): Promise<void> {
        if (this._entering) {
            return;
        }
        this._entering = true;
        try {
            await this.enterBattle();
        } finally {
            this._entering = false;
        }
    }

    /**
     * 仅当当前事件是战斗时：后台预载 idle/hurt + 友方 prep/other + 预实例化 BattleView。
     * 测试阶段 {@link resolveCurrentEventType} 固定返回 Battle。
     */
    private tryPreloadForCurrentEvent(): void {
        const eventType = this.resolveCurrentEventType();
        if (eventType !== EAdventureEventType.Battle) {
            console.log(`[Adventure] 当前事件=${eventType}，跳过战斗预载`);
            return;
        }
        const armyId = this.resolveBattleArmyId();
        const units = this.collectBattleAnimUnits(armyId);
        BattleAnimLoadScheduler.enqueueBattleAnimsForUnits(units, 200);
        void UIManager.prewarmView(AdventureMediator.BATTLE_VIEW_ID);
        const allyCount = units.filter((u) => u.rootType === 'character').length;
        console.log(
            `[Adventure] 战斗事件：预载热动作 ${units.length} 人`
            + ` + 友方预备/出牌 ${allyCount} 人 + 预实例化 BattleView`,
        );
    }

    /**
     * 解析当前冒险事件。
     * TODO: 接正式事件/地图节点后改为读真实数据；测试暂假定为战斗。
     */
    private resolveCurrentEventType(): EAdventureEventType {
        return EAdventureEventType.Battle;
    }

    private resolveBattleArmyId(): string {
        return AdventureMediator.DEFAULT_ARMY_ID;
    }

    private async enterBattle(): Promise<void> {
        if (this.resolveCurrentEventType() !== EAdventureEventType.Battle) {
            console.warn('[Adventure] 当前不是战斗事件，无法进战');
            return;
        }

        this.ensureDevDeploy();
        const armyId = this.resolveBattleArmyId();
        const units = this.collectBattleAnimUnits(armyId);
        // 进战前尽量等 idle/hurt + prep/other 入缓存，避免拖牌时异步加载被 cancel
        BattleAnimLoadScheduler.enqueueBattleAnimsForUnits(units, 300);
        await BattleAnimLoadScheduler.waitIdle(8000);

        // 若预热尚未完成，这里会等到实例就绪（通常进冒险后已好）
        await UIManager.prewarmView(AdventureMediator.BATTLE_VIEW_ID);

        const facade = BattleFacade.getInstance();
        if (facade.isInBattle) {
            facade.opLeaveBattle();
        }
        const ok = facade.opEnterBattle({ armyId })
            || facade.opEnsureDevHandTestBattle();
        if (!ok) {
            console.warn('[Adventure] 进战失败');
            return;
        }
        await UIManager.gotoView(AdventureMediator.BATTLE_VIEW_ID);
    }

    /** 编队为空时塞测试阵容，便于本地点进战 */
    private ensureDevDeploy(): void {
        const deploy = Player.instance.adventureModel.deployModel;
        if (deploy.getActiveCombatants().length > 0) {
            return;
        }
        const speeds = [200, 100, 150, 120];
        for (let i = 0; i < 4; i++) {
            deploy.assignHeroToActive(i, `hero_${i + 1}`, speeds[i], 1);
        }
    }

    private collectBattleAnimUnits(armyId: string): IBattleAnimUnitRef[] {
        const units: IBattleAnimUnitRef[] = [];
        const deploy = Player.instance.adventureModel.deployModel;
        for (const c of deploy.getActiveCombatants()) {
            units.push(BattleAnimIdResolver.toUnitRef('character', c.heroId));
        }
        for (const enemyId of ArmyUtil.getEnemyIds(armyId)) {
            if (enemyId) {
                units.push(BattleAnimIdResolver.toUnitRef('enemy', enemyId));
            }
        }
        return units;
    }
}

ClassConfig.addClass('AdventureMediator', AdventureMediator);
