import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { AreaViewMediator } from '../../../view/AreaViewMediator';

export class MainMediator extends AreaViewMediator {
    public static fullPath = 'prefab/main';

    public initialize(..._any: any[]): void {

    }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
    }

    registerUI(): void {

    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {

    }
}

ClassConfig.addClass("MainMediator", MainMediator);
