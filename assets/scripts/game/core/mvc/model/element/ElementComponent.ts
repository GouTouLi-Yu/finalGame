import { ConfigReader } from "db://assets/scripts/frame/Data/ConfigReader";
import { MathUtil } from "../../../../utils/MathUtil";
import { EComponentType, IComponent } from "../entity/ComponentType";
import { EElementType } from "./ElementType";

export class ElementComponent implements IComponent {
    readonly type: EComponentType = EComponentType.elements;

    private _valueMap: Map<EElementType, number>;

    constructor() {
        this._valueMap = new Map();
        this.initValueMap();
    }

    initValueMap() {
        const elements = [EElementType.fire, EElementType.water, EElementType.wind, EElementType.light, EElementType.ice, EElementType.thunder, EElementType.rock];
        const json = ConfigReader.getValue("elemPointProbabilty");

        for (const element of elements) {
            let point = MathUtil.getFinalValueBySpecialRandomJson(json);
            this._valueMap.set(element, point);
            console.log("element ===>", element, "point ===>", point);
        }
    }

    serialize(): any {
        return null;
    }

    deserialize(): any {
        return null;
    }
}


