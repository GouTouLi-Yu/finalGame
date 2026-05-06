import { Node } from 'cc';
import EventObject from '../../../frame/base/EventObject';
import type { Injector } from '../../../frame/Injector/Injector';
import type { MediatorMap } from '../../map/MediatorMap';

export enum EMediatorType {
    BaseView,
    AreaView,
    PopupView,
    ScenceView,
}

export enum EAreaViewOenType {
    Push,
    Switch,
}

/**
 * 视图中介基类（精简自 k 项目 framework/core/Mediator.ts）
 */
export default class Mediator extends EventObject {
    public static MediatorType: EMediatorType = EMediatorType.BaseView;
    public static viewRes = '';
    /**
     * ui（或其它 bundle）内预制体所在目录前缀，不含文件名；末尾可有可无 `/`。
     * 例：`prefab/mainMenu`。最终路径 = `{fullPath}/{stripViewSuffix(viewId)}Layer`（无扩展名）。
     * 为空时由 ViewPathResolver 用 `mvcViewSubPath`（或默认首字母小写目录）回退为 `prefab/{子路径}/{Base}Layer`。
     */
    public static fullPath = '';
    public static isEmptyLayer = false;

    protected _dismissed = false;

    protected _view!: Node;
    protected _viewName = '';

    protected _mediatorMap!: MediatorMap;

    getMediatorMap() {
        return this._mediatorMap;
    }

    public sysInject(injector: Injector) {
        super.sysInject(injector);
        this._mediatorMap = injector.getInstanceOnlyRead('MediatorMap') as MediatorMap;
    }

    public getView(): Node {
        return this._view;
    }

    get view() {
        return this._view;
    }

    public getViewName() {
        return this._viewName;
    }

    public setView(viewComponent: Node) {
        this._view = viewComponent;
        this._viewName = viewComponent?.getViewName?.() ?? '';
    }

    public reinject(_injector: Injector) {}

    public adjustLayout(_targetFrame: any) {}

    public onRegister() {}

    public onRemove() {}

    public enterWithData(_data?: any) {}

    public enterWithDelay() {}

    public dismiss(_data?: any) {}
}
