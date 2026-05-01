/** 与 k 项目 PCEvent / LuaEvent 一致的最小事件载体 */
export class PCEvent {
    private _eventType: number;
    private _payload: any;

    constructor(eventType: number, payload?: any) {
        this._eventType = eventType;
        this._payload = payload;
    }

    get eventType() {
        return this._eventType;
    }

    public getEventType() {
        return this._eventType;
    }

    get payload() {
        return this._payload;
    }

    public getPayload() {
        return this._payload;
    }
}

export class LuaEvent extends PCEvent {
    constructor(eventType: number, payload?: any) {
        super(eventType, payload);
    }
}
