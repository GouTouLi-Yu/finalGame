import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { Model } from '../Model';
import { Hero } from './Hero';

export class HeroModel extends Model {
    private _heroMap: Map<string, Hero>;

    constructor() {
        super();
        this._heroMap = new Map();
    }

    get heroMap(): Map<string, Hero> {
        return this._heroMap;
    }

    synchronize(data: any): void {}

    getSaveData(): any {}

    resetToDefault(): void {}
}
ClassConfig.addClass('HeroModel', HeroModel);
