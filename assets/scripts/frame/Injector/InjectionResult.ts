import DisposableObject from '../base/DisposableObject';

/** 注入解析结果抽象类（参考 k 项目 InjectionResult） */
export class InjectionResult extends DisposableObject {
    public constructor() {
        super();
    }

    public getResponse(_injector: any): any {
        throw new Error('InjectionResult must override getResponse!');
    }
}

export class InjectClassResult extends InjectionResult {
    private _responseType: any;

    constructor(responseType: any) {
        super();
        this._responseType = responseType;
    }

    public getResponse(injector: any) {
        if (!this._responseType) return null;
        return injector.getInstance(this._responseType);
    }
}

export class InjectSingletonResult extends InjectionResult {
    private _responseType: any;
    private _responseInstance: any;

    constructor(responseType: any) {
        super();
        this._responseType = responseType;
    }

    public getResponse(injector: any) {
        if (this._responseInstance) {
            return this._responseInstance;
        }
        if (!this._responseType) {
            return null;
        }
        this._responseInstance = injector.instantiate(this._responseType);
        return this._responseInstance;
    }
}

export class InjectValueResult extends InjectionResult {
    private _value: any;

    constructor(object: any) {
        super();
        this._value = object;
    }

    public deleteMe() { }

    public getResponse(_injector: any) {
        return this._value;
    }
}
