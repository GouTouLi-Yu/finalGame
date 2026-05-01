/**
 * 字符串 key ↔ 类的注册表（供 Injector 解析）。
 * 参考：外部项目 ClassConfig，去掉与本项目无关的工具函数，保持简单。
 */

export class ClassConfig {
    private static _nameToClass = new Map<string, any>();
    private static _classToName = new Map<any, string>();

    /** 注册可通过 Injector 获取的类（同一 key 只能注册一次） */
    static addClass(name: string, clazz: any) {
        if (this._nameToClass.has(name)) {
            throw new Error(`[ClassConfig] 已存在注册: ${name}`);
        }
        this._nameToClass.set(name, clazz);
        this._classToName.set(clazz, name);
    }

    static getClass(name: string) {
        return this._nameToClass.get(name);
    }

    static getClassName(clazz: any): string | undefined {
        return this._classToName.get(clazz);
    }

    static haveClass(name: string) {
        return this._nameToClass.has(name);
    }

    /** 集中写注册时可放在这里，或在 Main / 各模块初始化里直接 addClass */
    static init() {
        // 示例：ClassConfig.addClass('FooService', FooService);
    }
}
