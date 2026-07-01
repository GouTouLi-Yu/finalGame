import { _decorator, Component } from 'cc';
import './engine/Extension/NodeExt';
import { ConfigReader } from './frame/Data/ConfigReader';
import { DevConfig } from './game/config/DevConfig';
import { GameConfig } from './game/config/GameConfig';
import './game/core/mvc/facade/battle/BattleFacade';
import './game/core/mvc/facade/mainMenu/MainMenuFacade';
import './game/core/mvc/model/adventure/AdventureDeployModel';
import './game/core/mvc/model/adventure/AdventureModel';
import './game/core/mvc/model/battle/BattleSession';
import './game/core/mvc/model/battle/BattleFieldModel';
import './game/core/mvc/model/battle/BattleActionBarModel';
import './game/core/mvc/port/PlayerAdventureBattlePort';
import './game/core/mvc/service/battle/BattlePlayService';
import './game/core/mvc/service/battle/BattleTurnOrchestrator';
import './game/core/mvc/policy/battle/IAutoPlayPolicy';
import './game/core/mvc/util/ActionUtil';
import './game/core/mvc/util/BattleAutoPlayUtil';
import './game/core/mvc/util/ArmyUtil';
import './game/core/mvc/util/EnemyUtil';
import './game/core/mvc/model/item/ItemModel';
import './game/core/mvc/view/mainMenu/MainMenuMediator';
import './game/core/mvc/view/GM/GMMediator';
import './game/core/mvc/view/test/BattleSimRunner';
import './game/core/mvc/view/test/TestMediator';
import { initGMCheatActions } from './game/gm/GMCheats';
import { GMInputService } from './game/gm/GMInputService';
import { LanguageService } from './game/i18n/LanguageService';
import { UIManager } from './game/ui/UIManager';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {

    onLoad(): void {
        UIManager.init();
    }

    start() {
        GMInputService.init();
        this.startLoadConfig();
    }

    async startLoadConfig() {
        console.log('[Main] 开始加载配置表...');
        await ConfigReader.init((finished, total) => {
            const p = total > 0 ? (finished / total) : 0;
            // 这里之后可以接你们的进度条 UI
            console.log(`[Main] 配置表加载进度: ${(p * 100).toFixed(1)}% (${finished}/${total})`);
        });
        console.log('[Main] 配置表加载完成');
        // 须在 init/loadAll 完成后再读表（进度回调里 _tables 尚未填充）
        if (DevConfig.isGMAllowed()) {
            initGMCheatActions();
        }
        LanguageService.init();

        // 进主菜单前同步默认内存状态；选「继续」时再由 Facade 用存档覆盖
        // 界面 id 必须以 View 结尾；对应 MainMenuMediator（见 MainMenuMediator 文件内 ClassConfig.addClass）
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


