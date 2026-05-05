import { Node } from 'cc';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { UIManager } from '../../../../ui/UIManager';
import Strings from '../../../../utils/Strings';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { ElementComponent } from '../../model/element/ElementComponent';

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
        this.test();
    }

    test() {
        let Component = new ElementComponent();
    }

    setBtnNodes() {
        let btnTempNode = this.view.getChildByName("btnTemp");
        let viewNames = ["MainView", "MainView", "MainView", "MainView", "MainView"];
        for (let i = 0; i < this._btnNum; i++) {
            let btnNode = btnTempNode.clone();
            btnNode.setParent(this._layoutNode);
            btnNode.active = true;
            btnNode.setName(`btn_${BtnType[i]}`);
            btnNode.getChildByName("Label").setString(Strings.get(`TEXT_MAIN_MENU_00${i + 1}`));
            if (!btnNode.click) {
                btnNode.addClickListener(() => {
                    UIManager.gotoView("MainView");
                });
                btnNode.click = true;
            }
        }
    }
}
ClassConfig.addClass("MainMenuMediator", MainMenuMediator);

