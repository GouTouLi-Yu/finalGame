import { ElementModel } from "../model/element/ElementModel";
import { EElementType } from "../model/element/ElementType";
import { Player } from "../model/Player/Player";

export class ElementUtil {
    private static get elementModel(): ElementModel {
        return Player.instance.elementModel;
    }

    static getAllElements(): EElementType[] {
        return this.elementModel.allElements;
    }
}


