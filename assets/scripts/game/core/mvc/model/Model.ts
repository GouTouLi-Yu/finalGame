import DisposableObject from 'db://assets/scripts/frame/base/DisposableObject';

export abstract class Model extends DisposableObject {
    /** 同步数据 */
    abstract synchronize(data: any): void;
    /** 重置为默认状态 */
    abstract resetToDefault(): void;
    /** 获取保存数据 */
    abstract getSaveData(): any;
}


