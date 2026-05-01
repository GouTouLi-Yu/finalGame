import type { Injector } from '../../../frame/Injector/Injector';
import Mediator, { EMediatorType } from './Mediator';

/**
 * 视图 Mediator 基类（精简自 k：去掉 engine/BgExt/display 适配，保留生命周期钩子）
 */
export class BaseViewMediator extends Mediator {
    public static MediatorType: EMediatorType = EMediatorType.BaseView;

    /**
     * 相对 `game/core/mvc/view/` 的子路径（不含文件名），用于默认预制体目录。
     * 例如 `shop/gift` → `prefab/shop/gift/GiftLayer`。
     * 不设时默认为单层：类名去掉 Mediator 后的名字（MainMenuMediator → MainMenu）。
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
