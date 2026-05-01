/**
 * @description 可 dispose 的对象（参考 k 项目 DisposableObject）
 * 本工程不引入对 Injector 的循环依赖：injector 相关用 any
 */
export default class DisposableObject {
    private static _objectCount = 0;
    public static get objectCount() {
        return DisposableObject._objectCount;
    }

    private _injector: any;

    public getInjector(): any {
        return this._injector;
    }

    public get injector(): any {
        return this._injector;
    }

    public set injector(value: any) {
        this._injector = value;
    }

    public constructor() {
        DisposableObject._objectCount++;
    }

    private _isValid = true;

    public get isValid(): boolean {
        return this._isValid;
    }

    public initialize(..._any: any[]) { }

    public __dispose(): void {
        if (!this._isValid) {
            console.error(`${this.constructor.name} can not dispose repet!`);
            throw new Error('dispose repet');
        }
        this._isValid = false;
        this._dispose();
        this.deleteMe();
        DisposableObject._objectCount--;
    }

    /** k 原版中的私有.dispose 易与语义混淆，这里不对外导出 */

    protected _dispose() { }

    protected deleteMe() { }

    public sysInject(injector: any) {
        this._injector = injector;
    }

    protected userInject(_injector: any) { }
}
