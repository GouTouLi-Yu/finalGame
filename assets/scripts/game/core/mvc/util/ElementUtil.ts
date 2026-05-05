import { EElementType } from "../model/element/ElementType";

export class ElementUtil {
    static getAllElements(): EElementType[] {
        return [EElementType.fire, EElementType.water, EElementType.wind, EElementType.light, EElementType.ice, EElementType.thunder, EElementType.rock];
    }
}


