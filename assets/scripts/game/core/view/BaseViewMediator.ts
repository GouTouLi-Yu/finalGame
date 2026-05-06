import type { Injector } from '../../../frame/Injector/Injector';
import Mediator, { EMediatorType } from './Mediator';

/**
 * 视图 Mediator 基类（精简自 k：去掉 engine/BgExt/display 适配，保留生命周期钩子）
 */
export class BaseViewMediator extends Mediator {
    public static MediatorType: EMediatorType = EMediatorType.BaseView;

    /**
     * 相对 `game/core/mvc/view/` 的子路径（不含文件名）。
     * 仅当对应 Mediator **未**设置 `Mediator.fullPath` 时参与默认资源路径：`prefab/{mvcViewSubPath}/{Base}Layer`。
     * 不设时目录默认为类名去 Mediator 后首字母小写（MainMenuMediator → mainMenu）。
     */
    public static mvcViewSubPath = '';

    protected _parentMediator: BaseViewMediator | null = null;
    set parentMediator(v: BaseViewMediator | null) {
        this._parentMediator = v;
    }

    isPlayViewAnim = false;

    protected _dismissCallback: any;
    protected _currentSceneMediator: any;

    constructor() {
        super();
    }

    public sysInject(injector: Injector) {
        super.sysInject(injector);
        // k 项目会注入 currentSceneMediator；未注册时保持 undefined 即可
        try {
            this._currentSceneMediator = injector.getInstanceOnlyRead('currentSceneMediator');
        } catch {
            /* optional */
        }
    }

    public wakeUpView() {}

    public adjustLayout(_targetFrame: any) {
        // 需要安全区/异形屏适配时在此实现，或挂在子类
    }

    public setupView(_data?: any) {}

    public enterWithDelay() {}

    public didFinishEnterTransition(_isAnim = false) {}

    public willStartExitTransition() {}

    public didFinishExitTransition() {}

    public willBeCovered() {}

    public didFinishCoverTransition() {}

    public resumeWithData(_data: any) {}

    public didFinishResumeTransition() {}

    public willBeClosed(_data?: any) {}
}
