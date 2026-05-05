import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';
import { IElementSaveDataItem } from '../../../../save/PlayerSaveData';
import { MathUtil } from '../../../../utils/MathUtil';
import { Model } from '../Model';
import { EElementType } from './ElementType';

export class Element extends Model {
    private _elemType: EElementType;
    get elemType(): EElementType {
        return this._elemType;
    }

    private _point: number;
    /** 元素点数 */
    get point(): number {
        return this._point;
    }

    constructor(elemType: EElementType) {
        super();
        this._elemType = elemType;
    }

    resetPoint() {
        const json = ConfigReader.getValue("elemPointProbabilty");
        let point = Math.max(1, MathUtil.getFinalValueBySpecialRandomJson(json));
        this._point = point;
    }

    synchronize(data: IElementSaveDataItem): void {
        if (data.point != null) {
            this._point = data.point;
        }
    }

    getSaveData(): IElementSaveDataItem {
        return {
            point: this._point,
        };
    }

    resetToDefault(): void {
        this.resetPoint();
    }
}



