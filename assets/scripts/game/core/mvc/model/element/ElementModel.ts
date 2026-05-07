import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { pairs } from 'db://assets/scripts/frame/luaCompat/pairs';
import { IElementSaveData, IElementSaveDataItem } from 'db://assets/scripts/game/save/PlayerSaveData';
import { Model } from '../Model';
import { Element } from './Element';
import { EElementType } from './ElementType';

export class ElementModel extends Model {
    private _elementMap: Map<EElementType, Element>;
    private _allElements: EElementType[];
    get allElements(): EElementType[] {
        return this._allElements;
    }

    constructor() {
        super();
        this._elementMap = new Map();
    }

    private resetElementComponentMap() {
        let elements = this._allElements;
        for (let type of elements) {
            let element = this._elementMap.get(type) ?? new Element(type);
            element.resetToDefault();
            this._elementMap.set(type, element);
        }
    }

    getSaveData(): IElementSaveData {
        let elements: Record<string, IElementSaveDataItem> = {};
        let elementTypes = this._allElements;
        for (let elemType of elementTypes) {
            elements[elemType] = this._elementMap.get(elemType).getSaveData();
        }
        return { elements };
    }

    synchronize(data: IElementSaveData): void {
        if (data.elements != null) {
            for (let [elemType, componentData] of pairs(data.elements)) {
                let element = this._elementMap.get(elemType) ?? new Element(elemType);
                element.synchronize(componentData);
                this._elementMap.set(elemType, element);
                this._allElements.push(elemType);
            }
        }
    }

    resetToDefault(): void {
        this.resetElementComponentMap();
    }
}
ClassConfig.addClass("ElementModel", ElementModel);


