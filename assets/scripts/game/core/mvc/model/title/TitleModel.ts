import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { Model } from '../Model';
import { Title } from './Title';

export class TitleModel extends Model {
    private _titleMap: Map<string, Title>;

    constructor() {
        super();
        this._titleMap = new Map();
    }

    get titleMap(): Map<string, Title> {
        return this._titleMap;
    }

    synchronize(data: any): void {}

    getSaveData(): any {}

    resetToDefault(): void {}
}
ClassConfig.addClass('TitleModel', TitleModel);
