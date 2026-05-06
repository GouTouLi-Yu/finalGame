import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { PopupViewMediator } from '../../../view/PopupViewMediator';

export class BagMediator extends PopupViewMediator {
    public static fullPath = 'prefab/bag';

    public initialize(..._any: any[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
    }

    registerUI(): void { }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void { }
}

ClassConfig.addClass('BagMediator', BagMediator);
