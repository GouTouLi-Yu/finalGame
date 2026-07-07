import { _decorator, Component, EventKeyboard, input, Input, KeyCode, profiler } from 'cc';
import { DEV } from 'cc/env';
import './engine/Extension/NodeExt';
import { ConfigReader } from './frame/Data/ConfigReader';
import { DevConfig } from './game/config/DevConfig';
import { GameConfig } from './game/config/GameConfig';
import './game/core/mvc/facade/battle/BattleFacade';
import './game/core/mvc/facade/mainMenu/MainMenuFacade';
import './game/core/mvc/model/adventure/AdventureDeployModel';
import './game/core/mvc/model/adventure/AdventureModel';
import './game/core/mvc/model/battle/BattleActionBarModel';
import './game/core/mvc/model/battle/BattleFieldModel';
import './game/core/mvc/model/battle/BattleSession';
import './game/core/mvc/model/item/ItemModel';
import './game/core/mvc/policy/battle/IAutoPlayPolicy';
import './game/core/mvc/port/PlayerAdventureBattlePort';
import './game/core/mvc/service/battle/BattlePlayService';
import './game/core/mvc/service/battle/BattleTurnOrchestrator';
import './game/core/mvc/util/ActionUtil';
import './game/core/mvc/util/ArmyUtil';
import './game/core/mvc/util/BattleAutoPlayUtil';
import './game/core/mvc/util/EnemyUtil';
import './game/core/mvc/view/GM/GMMediator';
import './game/core/mvc/view/battle/BattleMediator';
import './game/core/mvc/view/mainMenu/MainMenuMediator';
import './game/core/mvc/view/setting/SettingMediator';
import './game/core/mvc/view/test/BattleSimRunner';
import './game/core/mvc/view/test/TestMediator';
import { initGMCheatActions } from './game/gm/GMCheats';
import { GMInputService } from './game/gm/GMInputService';
import { LanguageService } from './game/i18n/LanguageService';
import { getGraphicsQualityLabel } from './game/render/GraphicsQualityLevel';
import { GraphicsQualityService } from './game/render/GraphicsQualityService';
import { RenderTextureQualityScaler } from './game/render/RenderTextureQualityScaler';
import { UIManager } from './game/ui/UIManager';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {

    onLoad(): void {
        if (DEV || GameConfig.forceEnableGM) {
            profiler.showStats();
        }
        GraphicsQualityService.init();
        UIManager.init();
        this.node.addComponent(RenderTextureQualityScaler);
        if (DEV) {
            input.on(Input.EventType.KEY_DOWN, this._onDevKeyDown, this);
        }
    }

    onDestroy(): void {
        if (DEV) {
            input.off(Input.EventType.KEY_DOWN, this._onDevKeyDown, this);
        }
    }

    private _onDevKeyDown(event: EventKeyboard): void {
        if (event.keyCode !== KeyCode.F9) {
            return;
        }
        const next = GraphicsQualityService.cycleQuality();
        const scale = GraphicsQualityService.getCurrentScale();
        console.log(`[Dev] 画质切换: ${getGraphicsQualityLabel(next)} (${scale}x)`);
    }

    start() {
        GMInputService.init();
        this.startLoadConfig();
    }

    async startLoadConfig() {
        console.log('[Main] 开始加载配置表...');
        await ConfigReader.init((finished, total) => {
            const p = total > 0 ? (finished / total) : 0;
            console.log(`[Main] 配置表加载进度: ${(p * 100).toFixed(1)}% (${finished}/${total})`);
        });
        console.log('[Main] 配置表加载完成');
        if (DevConfig.isGMAllowed()) {
            initGMCheatActions();
        }
        LanguageService.init();

        await this.startGame();
    }

    startGame() {
        if (GameConfig.test) {
            UIManager.gotoView('TestView');
        } else {
            UIManager.gotoView('MainMenuView');
        }
    }

    update(deltaTime: number) {

    }
}

