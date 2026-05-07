import { Model } from '../Model';

/** 槽位基元数据类（与 {@link SlotModel} 对应） */
export class Slot extends Model {
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
