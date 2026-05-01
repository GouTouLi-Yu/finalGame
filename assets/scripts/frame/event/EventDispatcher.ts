import DisposableObject from '../base/DisposableObject';

/** k 项目 EventListener */
export class EventListener {
    public fun!: Function;
    public beDelete = false;
    public callthis: any;
}

/**
 * 全局事件派发（精简自 k 项目 EventDispatcher，去掉多分组单例入口，改为直接 new）
 */
export class EventDispatcher extends DisposableObject {
    private _events: Record<number, EventListener[]> = {};

    constructor() {
        super();
    }

    protected deleteMe(): void {
        this._events = {};
    }

    public addEventListener(eventType: number, listener: EventListener, prepend = false) {
        if (!this.isValid) return;
        let existing = this._events[eventType];
        if (!existing) {
            existing = [];
            this._events[eventType] = existing;
        }
        if (prepend) existing.unshift(listener);
        else existing.push(listener);
    }

    public removeEventListener(eventType: number, listener: EventListener) {
        if (!this.isValid) return;
        const list = this._events[eventType];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] === listener) {
                listener.beDelete = true;
                list.splice(i, 1);
                break;
            }
        }
    }

    public dispatchEvent(eventType: number, ...args: any[]) {
        if (!this.isValid) return false;
        const list = this._events[eventType];
        if (!list || list.length === 0) return false;

        const len = list.length;
        const listeners = this.arrayClone(list, len);
        for (let i = 0; i < len; ++i) {
            if (listeners[i].beDelete === false) {
                if (listeners[i].callthis != null) {
                    listeners[i].fun.call(listeners[i].callthis, args[0]);
                } else {
                    listeners[i].fun(args[0]);
                }
            }
        }
        return true;
    }

    private arrayClone(arr: EventListener[], n: number) {
        const copy: EventListener[] = new Array(n);
        for (let i = 0; i < n; ++i) copy[i] = arr[i];
        return copy;
    }
}
