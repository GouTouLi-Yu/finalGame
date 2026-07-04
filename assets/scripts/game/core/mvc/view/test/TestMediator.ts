import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { UIManager } from '../../../../ui/UIManager';
import Strings from '../../../../utils/Strings';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

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
        console.log(Strings.get("TRANS_HERO_NAME_001"));
        UIManager.gotoView("BattleView");
    }


    memoryTest() {
        UIManager.gotoView("MainMenuView");
    }
}

ClassConfig.addClass('TestMediator', TestMediator);
