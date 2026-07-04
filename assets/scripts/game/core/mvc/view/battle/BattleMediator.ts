import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { AreaViewMediator } from '../../../view/AreaViewMediator';

/**
 * 战斗全屏界面 Mediator。
 * 约定：界面 id `BattleView` → `prefab/battle/BattleLayer`（ui bundle）。
 */
export class BattleMediator extends AreaViewMediator {
    public static fullPath = 'prefab/battle';

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

ClassConfig.addClass('BattleMediator', BattleMediator);
