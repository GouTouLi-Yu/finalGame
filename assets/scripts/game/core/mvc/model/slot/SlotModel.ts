import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { Model } from '../Model';
import { Slot } from './Slot';

export class SlotModel extends Model {
    private _slotMap: Map<string, Slot>;

    constructor() {
        super();
        this._slotMap = new Map();
    }

    get slotMap(): Map<string, Slot> {
        return this._slotMap;
    }

    synchronize(data: any): void {}

    getSaveData(): any {}

    resetToDefault(): void {}
}
ClassConfig.addClass('SlotModel', SlotModel);
