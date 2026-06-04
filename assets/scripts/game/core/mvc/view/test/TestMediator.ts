import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { LanguageService } from '../../../../i18n/LanguageService';
import { ELanguage } from '../../../../i18n/LanguageType';
import Strings from '../../../../utils/Strings';
import { AreaViewMediator } from '../../../view/AreaViewMediator';

/**
 * 测试用区域界面 Mediator。
 * 约定：界面 id `TestView` → `prefab/test/TestLayer`（ui bundle，由 fullPath + TestLayer）。
 */
export class TestMediator extends AreaViewMediator {
    public static fullPath = 'prefab/';

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

    public setupView(_data?: any): void {
        LanguageService.setLanguage(ELanguage.CN);
        console.log(Strings.get("TRANS_HERO_NAME_001"));
        console.log("你好");
    }
}

ClassConfig.addClass('TestMediator', TestMediator);
