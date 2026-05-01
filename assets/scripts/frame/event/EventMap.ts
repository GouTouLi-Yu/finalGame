import { EventDispatcher, EventListener } from './EventDispatcher';

/** 精简自 k 项目 EventMap */
export class EventMap {
    private _dispatcher: EventDispatcher;
    private _events: Record<number, EventListener[]> = {};

    constructor(dispatcher: EventDispatcher) {
        this._dispatcher = dispatcher;
    }

    private getEventListener(eventType: number, target: any, fun: Function): EventListener | null {
        const existing = this._events[eventType];
        if (existing) {
            for (let i = existing.length - 1; i >= 0; i--) {
                const L = existing[i];
                if (L.callthis === target && L.fun === fun) return L;
            }
        }
        return null;
    }

    private createEventListener(eventType: number, target: any, fun: Function): EventListener | null {
        if (this.getEventListener(eventType, target, fun)) return null;
        const listener = new EventListener();
        listener.fun = fun;
        listener.beDelete = false;
        listener.callthis = target;
        return listener;
    }

    public addEventListener(eventType: number, target: any, fun: Function, prepend = false): boolean {
        const listener = this.createEventListener(eventType, target, fun);
        if (!listener) return false;
        let existing = this._events[eventType];
        if (!existing) {
            existing = [];
            this._events[eventType] = existing;
        }
        if (prepend) existing.unshift(listener);
        else existing.push(listener);
        this._dispatcher.addEventListener(eventType, listener, prepend);
        return true;
    }

    public removeEventListener(eventType: number, target: any, fun: Function) {
        const listener = this.getEventListener(eventType, target, fun);
        if (!listener) return;
        const list = this._events[eventType];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] === listener) {
                list.splice(i, 1);
                this._dispatcher.removeEventListener(eventType, listener);
                break;
            }
        }
    }

    public removeAllEventListener() {
        for (const eventTypeStr of Object.keys(this._events)) {
            const eventType = Number(eventTypeStr);
            const list = this._events[eventType];
            if (!list) continue;
            for (let i = list.length - 1; i >= 0; i--) {
                const L = list[i];
                this._dispatcher.removeEventListener(eventType, L);
            }
        }
        this._events = {};
    }
}
