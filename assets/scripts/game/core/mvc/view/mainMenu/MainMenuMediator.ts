import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

enum EBtnType {
    startGame,
    continueGame,
    cultivation,
    settings,
    exitGame,
}

/**
 * 主菜单 Mediator。
 * 约定：界面 id `MainMenuView` → `prefab/mainMenu/MainMenuLayer`（ui bundle）。
 * 预制体需含 `layout`、`btnTemp`（模板，含 Label 子节点）。
 */
export class MainMenuMediator extends AreaViewMediator {
    public static fullPath = 'prefab/mainMenu';
    BtnHandles = {
        ["StartBtn"]: "onClickStartBtn",
    }

    onClickStartBtn() {
        console.log("倪好");
    }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
        this.mapEventListeners();
    }

    registerUI(): void {

    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {

    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
    }
}

ClassConfig.addClass('MainMenuMediator', MainMenuMediator);
