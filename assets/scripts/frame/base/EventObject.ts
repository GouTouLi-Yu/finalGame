import DisposableObject from './DisposableObject';
import { EventMap } from '../event/EventMap';
import { LuaEvent, PCEvent } from '../event/PCEvent';
import type { Injector } from '../Injector/Injector';
import type { EventDispatcher } from '../event/EventDispatcher';

/**
 * 带事件能力的对象（精简自 k 项目 EventObject）
 */
export default class EventObject extends DisposableObject {
    private _eventDispatcher!: EventDispatcher;
    private _eventMap!: EventMap;

    public constructor() {
        super();
    }

    public sysInject(injector: Injector) {
        super.sysInject(injector);
        this._eventDispatcher = injector.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher;
        this._eventMap = new EventMap(this._eventDispatcher);
    }

    protected _dispose(): void {
        super._dispose();
        this.removeAllEventListener();
    }

    public removeAllEventListener() {
        this._eventMap?.removeAllEventListener();
    }

    public handler(func: Function) {
        return [this, func];
    }

    public addListener(eventType: number, Targetfun: any[], prepend = false): boolean {
        return this._eventMap.addEventListener(eventType, Targetfun[0], Targetfun[1], prepend);
    }

    public mapEventListener(eventType: number, target: any, fun: Function, prepend = false): boolean {
        return this._eventMap.addEventListener(eventType, target, fun, prepend);
    }

    public unmapEventListener(eventType: number, target: any, fun: Function) {
        return this._eventMap.removeEventListener(eventType, target, fun);
    }

    public removeListener(eventType: number, target: any, fun: Function) {
        this._eventMap.removeEventListener(eventType, target, fun);
    }

    public dispatchEvent(event: PCEvent) {
        this._eventDispatcher?.dispatchEvent(event.getEventType(), event);
    }

    public dispatch(event: PCEvent | number, payload?: any) {
        let e: PCEvent;
        if (typeof event === 'number') {
            e = new LuaEvent(event, payload);
        } else {
            e = event;
        }
        this._eventDispatcher?.dispatchEvent(e.getEventType(), e);
    }
}
