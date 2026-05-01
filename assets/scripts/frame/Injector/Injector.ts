import BaseObject from '../base/BaseObject';
import { ClassConfig } from './ClassConfig';
import { InjectionConfig } from './InjectionConfig';
import { InjectSingletonResult, InjectValueResult } from './InjectionResult';

/**
 * 依赖注入器（主体结构参考 k 项目 playcrab/framework/injector/Injector.ts）
 */
export class Injector extends BaseObject {
    private _parentInjector: Injector | null = null;
    private _mappings: Record<string, InjectionConfig> = {};

    constructor(parentInjector: Injector | null = null) {
        super();
        this._parentInjector = parentInjector;
        this._mappings = {};
    }

    /** 全局默认 Injector（k 项目中通常由 Context 持有；此处便于 UIManager 等直接使用） */
    static readonly shared = new Injector(null);

    protected deleteMe(): void {
        for (const key of Object.keys(this._mappings)) {
            const element = this._mappings[key];
            if (!element) continue;
            element.__dispose?.();
            delete this._mappings[key];
        }
        this._mappings = {};
    }

    private genRequestKey(classType: any, name: string | null | undefined = null): string {
        if (!classType) {
            classType = 'BaseObject';
        }
        let Key: string;
        if (typeof classType === 'string') {
            Key = classType;
        } else {
            Key = ClassConfig.getClassName(classType) as string;
            if (!Key) {
                throw new Error(`Injector: Can't find class by type '${classType}'`);
            }
        }
        if (name) {
            Key = Key + '#' + name;
        }
        return Key;
    }

    getInstance<T extends abstract new (...args: any) => any>(classType: T, name?: string | null | undefined): InstanceType<T>;
    getInstance(classType: string, name?: string | null | undefined): any;
    public getInstance<T extends abstract new (...args: any) => any>(
        classType: T | string,
        name: string | null | undefined = null
    ): InstanceType<T> | any {
        let cfg = this._findInjectionConfigForRequest(classType, name, true);
        if (!cfg) {
            this.mapSingleton(classType, name);
            cfg = this._findInjectionConfigForRequest(classType, name, true);
        }
        if (!cfg) {
            return null;
        }
        return cfg.getResponse(this);
    }

    public getInstanceOnlyRead(classType: any, name: string | null | undefined = null) {
        const cfg = this._findInjectionConfigForRequest(classType, name, true);
        if (!cfg) {
            return null;
        }
        return cfg.getResponse(this);
    }

    public deleteInstance(clazz: any, named: string | null = null) {
        this._cleanInjectionConfigForRequest(clazz, named, true);
    }

    /**
     * 向对象执行注入（参考 k）
     */
    public injectInto(target: any) {
        target?.sysInject?.(this);
        target?.userInject?.(this);
    }

    public hasInstantiate(classType: any, ..._arg: any[]): any {
        let clazz = classType;
        if (typeof classType === 'string') {
            clazz = ClassConfig.getClass(classType);
        }
        if (!clazz) {
            return false;
        }
        return true;
    }

    public instantiate(classType: any, ...arg: any[]): any {
        const obj = this._instantiate(classType, ...arg);
        if (obj) {
            this.injectInto(obj);
        }
        return obj;
    }

    private _instantiate(classType: any, ...arg: any[]) {
        let clazz = classType;
        if (typeof classType === 'string') {
            clazz = ClassConfig.getClass(classType);
        }
        if (!clazz) {
            throw new Error(`Can't find class by name '${classType}'`);
        }
        const obj = new clazz(...arg);
        obj.initialize?.(...arg);
        return obj;
    }

    public hasMapping(clazz: any, named: string | null = null) {
        const cfg = this._findInjectionConfigForRequest(clazz, named, true);
        return cfg && cfg.willRespond();
    }

    public mapSingleton(whenAskedFor: any, named: string | null = null) {
        const cfg = this._getOrCreateMyownConfigForRequest(whenAskedFor, named);
        cfg.setResult(new InjectSingletonResult(whenAskedFor));
        return cfg;
    }

    public mapValue(whenAskedFor: any, useValue: any, named: string | null = null) {
        const cfg = this._getOrCreateMyownConfigForRequest(whenAskedFor, named);
        cfg.setResult(new InjectValueResult(useValue));
        return cfg;
    }

    public unmap(clazz: any, named: string | null = null) {
        const cfg = this._findInjectionConfigForRequest(clazz, named, false);
        if (cfg) {
            cfg.setResult(null);
        }
        this.deleteInstance(clazz, named);
    }

    public _findInjectionConfigForRequest(classType: any, named: string | null = null, searchParent = true): InjectionConfig | null {
        const requestKey = this.genRequestKey(classType, named);
        return this._findInjectionConfigByKey(requestKey, searchParent);
    }

    private _findInjectionConfigByKey(requestKey: string, searchParent = true): InjectionConfig | null {
        let cfg = this._mappings[requestKey];
        if (cfg) {
            return cfg;
        }
        if (this._parentInjector && searchParent) {
            return this._parentInjector._findInjectionConfigByKey(requestKey, true);
        }
        return null;
    }

    private _cleanInjectionConfigForRequest(classType: any, named: string | null = null, searchParent = true) {
        const requestKey = this.genRequestKey(classType, named);
        return this._cleanInjectionConfigByKey(requestKey, searchParent);
    }

    public _cleanInjectionConfigByKey(requestKey: string, searchParent = true) {
        const cfg = this._mappings[requestKey];
        if (cfg) {
            if (cfg.isValid) {
                cfg.__dispose();
            }
            delete this._mappings[requestKey];
            return;
        }
        if (this._parentInjector && searchParent) {
            return this._parentInjector._cleanInjectionConfigByKey(requestKey, true);
        }
        return;
    }

    private _getOrCreateMyownConfigForRequest(classType: any, named: string | null = null): InjectionConfig {
        const requestKey = this.genRequestKey(classType, named);
        let cfg = this._mappings[requestKey];
        if (!cfg) {
            cfg = new InjectionConfig(null);
            this._mappings[requestKey] = cfg;
        }
        return cfg;
    }
}
