import { PCEvent } from '../../frame/event/PCEvent';

/** 与 k 项目 ViewEvent / PopupEvent 结构一致 */
export class ViewEvent extends PCEvent {
    private _view: any;
    private _options: any;
    private _delegate: any;

    constructor(eventType: number, view: any, options: any, payload: any, delegate?: any) {
        super(eventType, payload);
        this._view = view;
        this._options = options;
        this._delegate = delegate;
    }

    public getView() {
        return this._view;
    }

    public getOptions() {
        return this._options;
    }

    public getDelegate() {
        return this._delegate;
    }
}

export class PopupEvent extends ViewEvent {
    constructor(eventType: number, view: any, options: any, payload: any, delegate?: any) {
        super(eventType, view, options, payload, delegate);
    }
}
