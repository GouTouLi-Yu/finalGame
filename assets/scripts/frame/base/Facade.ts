import { Injector } from '../Injector/Injector';
import EventObject from './EventObject';

/**
 * Facade 基类（移植自 k：`playcrab/framework/core/Facade.ts`）。
 * 单例通过 `Injector.shared.getInstance` 获取（k 侧为 `KosCtx.getInstance`）。
 */
export default abstract class Facade extends EventObject {
    constructor(..._args: any[]) {
        super();
    }

    public static getInstance<T extends abstract new (...args: any) => any>(this: T): InstanceType<T> {
        return Injector.shared.getInstance(this) as InstanceType<T>;
    }
}
