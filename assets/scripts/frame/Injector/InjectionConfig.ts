import DisposableObject from '../base/DisposableObject';
import { InjectionResult } from './InjectionResult';

/** 某项注入配置（参考 k 项目 InjectionConfig） */
export class InjectionConfig extends DisposableObject {
    private _result: InjectionResult | null = null;

    constructor(result?: InjectionResult | null) {
        super();
        this.setResult(result ?? null);
    }

    protected deleteMe(): void {
        if (this._result) {
            this._result.__dispose();
        }
    }

    public setResult(result: InjectionResult | null) {
        if (this._result && this._result.isValid) {
            this._result.__dispose();
        }
        this._result = result;
    }

    public getResponse(injector: any): any {
        if (this._result) {
            return this._result.getResponse(injector);
        }
        return null;
    }

    public willRespond() {
        return this._result != null && this._result !== undefined;
    }
}
