import { Node, NodeEventType } from 'cc';
import DisposableObject from '../../frame/base/DisposableObject';
import type { Injector } from '../../frame/Injector/Injector';

declare module 'cc' {
    interface Node {
        mediator?: any;
        getViewName?: () => string;
    }
}

interface ViewInfo {
    mediatorClazz: string;
    autoCreate: boolean;
    autoRemove: boolean;
}

/**
 * 视图与 Mediator 绑定表（精简自 k 项目 MediatorMap）
 */
export class MediatorMap extends DisposableObject {
    injector!: Injector;

    private _viewNameToMediatorMap = new Map<string, ViewInfo>();
    private _registeredMediators = new Map<Node, any>();
    private _mediatorNameToViewListMap = new Map<string, Node[]>();

    constructor() {
        super();
        this._viewNameToMediatorMap = new Map();
        this._registeredMediators = new Map();
        this._mediatorNameToViewListMap = new Map();
    }

    hasMapping(viewName: string) {
        const info = this._viewNameToMediatorMap.get(viewName);
        return info != null && info.mediatorClazz != null;
    }

    mapView(viewName: string, mediatorClazz: string, autoCreate?: boolean, autoRemove?: boolean) {
        this._viewNameToMediatorMap.set(viewName, {
            mediatorClazz,
            autoCreate: autoCreate === false ? false : true,
            autoRemove: autoRemove === false ? false : true,
        });
    }

    unmapView(viewName: string) {
        this._viewNameToMediatorMap.delete(viewName);
    }

    createMediator(viewComponent: Node) {
        if (viewComponent == null || viewComponent.getViewName == null) {
            return null;
        }
        const viewName = viewComponent.getViewName();
        const info = this._viewNameToMediatorMap.get(viewName);
        if (info != null) {
            const mediatorName = info.mediatorClazz;
            const mediator = this.injector.instantiate(mediatorName);
            if (mediator != null) {
                const scriptHandler = (node: Node) => {
                    node.off(NodeEventType.NODE_DESTROYED, scriptHandler, this);
                    this.onExitSomeView(node);
                };
                viewComponent.on(NodeEventType.NODE_DESTROYED, scriptHandler, this);
                this.registerMediator(viewComponent, mediator);
                this.addViewToViewListMap(mediatorName, viewComponent);
            }
            return mediator;
        }
        return null;
    }

    onExitSomeView(view: Node) {
        if (view == null || view.getViewName == null) {
            return;
        }
        const viewName = view.getViewName();
        const info = this._viewNameToMediatorMap.get(viewName);
        if (info != null) {
            this.removeMediatorByView(view);
            const mediatorName = info.mediatorClazz;
            this.removeViewFromViewListMap(mediatorName, view);
        }
    }

    registerMediator(viewComponent: Node, mediator: any) {
        if (viewComponent == null || mediator == null) {
            return;
        }
        if (this._registeredMediators.has(viewComponent)) {
            if (this._registeredMediators.get(viewComponent) === mediator) {
                return;
            }
            this.removeMediatorByView(viewComponent);
        }
        mediator.setView(viewComponent);
        viewComponent.mediator = mediator;
        this._registeredMediators.set(viewComponent, mediator);
        mediator.onRegister?.();
    }

    removeMediatorByView(viewComponent: Node) {
        if (viewComponent == null) return;
        const med = this._registeredMediators.get(viewComponent);
        if (med != null) {
            this._registeredMediators.delete(viewComponent);
            viewComponent.mediator = null;
            med.onRemove?.();
            med.__dispose?.();
        }
    }

    retrieveMediator(viewComponent: Node): any {
        if (viewComponent == null) return null;
        return this._registeredMediators.get(viewComponent);
    }

    getViewListByViewName(viewName: string): Node[] | undefined {
        const info = this._viewNameToMediatorMap.get(viewName);
        if (info) {
            const mediatorName = info.mediatorClazz;
            return this.getViewListFromViewListMap(mediatorName);
        }
        return undefined;
    }

    addViewToViewListMap(mediatorName: string, viewComponent: Node) {
        if (!this._mediatorNameToViewListMap.has(mediatorName)) {
            this._mediatorNameToViewListMap.set(mediatorName, []);
        }
        const viewList = this._mediatorNameToViewListMap.get(mediatorName)!;
        viewList.push(viewComponent);
    }

    getViewListFromViewListMap(mediatorName: string): Node[] | undefined {
        return this._mediatorNameToViewListMap.get(mediatorName);
    }

    removeViewFromViewListMap(mediatorName: string, view: Node) {
        const viewList = this.getViewListFromViewListMap(mediatorName);
        if (viewList && viewList.length > 0) {
            for (let i = 0; i < viewList.length; i++) {
                if (viewList[i] === view) {
                    viewList.splice(i, 1);
                    break;
                }
            }
        }
    }
}
