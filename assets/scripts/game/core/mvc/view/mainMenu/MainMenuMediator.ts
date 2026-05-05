import { Button, Node } from 'cc';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { SaveGameService } from '../../../../manager/SaveGameService';
import Strings from '../../../../utils/Strings';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { MainMenuFacade } from '../../facade/mainMenu/MainMenuFacade';

enum BtnType {
    startGame,
    continueGame,
    cultivation,
    settings,
    exitGame,
}

export class MainMenuMediator extends AreaViewMediator {
    private _layoutNode: Node;
    private _btnNum = 5;

    public initialize(..._any: any[]): void {
        super.initialize(..._any);
    }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
    }

    registerUI() {
        this._layoutNode = this.view.getChildByName("layout");
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {
        this.setBtnNodes();
    }

    setBtnNodes() {
        const btnTempNode = this.view.getChildByName("btnTemp");
        const btnOrder = [
            BtnType.startGame,
            BtnType.continueGame,
            BtnType.cultivation,
            BtnType.settings,
            BtnType.exitGame,
        ];
        for (let i = 0; i < this._btnNum; i++) {
            const kind = btnOrder[i];
            const btnNode = btnTempNode.clone();
            btnNode.setParent(this._layoutNode);
            btnNode.active = true;
            btnNode.setName(`btn_${BtnType[kind]}`);
            btnNode.getChildByName("Label").setString(Strings.get(`TEXT_MAIN_MENU_00${i + 1}`));

            const button = btnNode.getComponent(Button);
            if (button && kind === BtnType.continueGame) {
                button.interactable = SaveGameService.hasSave();
            }

            if (!btnNode.click) {
                btnNode.addClickListener(() => {
                    const facade = MainMenuFacade.getInstance();
                    switch (kind) {
                        case BtnType.startGame:
                            facade.opStartNewGame();
                            break;
                        case BtnType.continueGame:
                            facade.opStartContinue();
                            break;
                        default:
                            break;
                    }
                });
                btnNode.click = true;
            }
        }
    }
}
ClassConfig.addClass("MainMenuMediator", MainMenuMediator);

