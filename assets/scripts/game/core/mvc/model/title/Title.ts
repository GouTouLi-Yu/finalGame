import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';
import { Model } from '../Model';

/** 称号基元数据类（与 {@link TitleModel} 对应） */
export class Title extends Model {
    get cfg() {
        return ConfigReader.getDataById('TitleConfig', this._id);
    }

    private _id: string;
    get id(): string {
        return this._id;
    }

    get name(): string {
        return this.cfg.name;
    }

    constructor(id: string) {
        super();
        this._id = id;
    }

    synchronize(data: any): void {}

    getSaveData(): any {}

    resetToDefault(): void {}
}
