import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { AreaViewMediator } from '../../../view/AreaViewMediator';

export class MainMenuMediator extends AreaViewMediator {
    public initialize(..._any: any[]): void {
        super.initialize(..._any);
    }

    public onRegister(): void {

    }

    registerUI() {

    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
    }

}
ClassConfig.addClass("MainMenuMediator", MainMenuMediator);

