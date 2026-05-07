import { Model } from '../Model';

/** 英雄基元数据类（与 {@link HeroModel} 对应） */
export class Hero extends Model {
    private _id: string;
    get id(): string {
        return this._id;
    }

    constructor(id: string) {
        super();
        this._id = id;
    }

    synchronize(data: any): void {}

    getSaveData(): any {}

    resetToDefault(): void {}
}
