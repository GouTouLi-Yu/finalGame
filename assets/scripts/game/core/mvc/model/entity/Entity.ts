import { ClassConfig } from "db://assets/scripts/frame/Injector/ClassConfig";
import { EComponentType, IComponent } from "./ComponentType";


export class Entity {
    protected readonly _id: number;
    protected _name: string;
    protected _components: Map<EComponentType, IComponent>;
    static nextId: number = 1;

    constructor(name: string) {
        this._id = Entity.nextId++;
        this._name = name;
        this._components = new Map();
    }

    addComponent(component: IComponent) {
        this._components.set(component.type, component);
    }

    getComponent(type: EComponentType) {
        return this._components.get(type);
    }

    removeComponent(type: EComponentType) {
        this._components.delete(type);
    }

    /** 获取所有组件 */
    getComponents(): Array<IComponent> {
        return Array.from(this._components.values());
    }

    initComponents() {

    }
}
ClassConfig.addClass("Entity", Entity);

