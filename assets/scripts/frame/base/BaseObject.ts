/**
 * @description 生命周期基类（参考 k 项目 BaseObject）
 */
export default class BaseObject {
    private static _objectCount = 0;
    public static get objectCount() {
        return BaseObject._objectCount;
    }

    public constructor() {
        BaseObject._objectCount++;
    }

    private _invalid = false;

    protected get invalid(): boolean {
        return this._invalid;
    }

    /** 初始化，子类可重写 */
    public initialize(..._arg: any[]) { }

    /** 销毁，外部调用 */
    public dispose(): void {
        if (this._invalid) {
            console.error(`${this.constructor.name} can not dispose repet!`);
            throw new Error('dispose repet');
        }
        this._invalid = true;
        this.deleteMe();
        BaseObject._objectCount--;
    }

    /** 供子类重写 */
    protected deleteMe() { }
}
