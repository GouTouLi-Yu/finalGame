import { ElementModel } from "../model/element/ElementModel";
import { ALL_ELEMENT_TYPES, EElementType } from "../model/element/ElementType";
import { Player } from "../model/Player/Player";

const ELEM_ASSET_DIR = 'asset/elem';

export class ElementUtil {
    private static get elementModel(): ElementModel {
        return Player.instance.elementModel;
    }

    static getAllElements(): EElementType[] {
        return this.elementModel.allElements;
    }

    /** 解析配表元素字段；无效或空串返回 null */
    static parseElement(value: unknown): EElementType | null {
        const name = typeof value === 'string' ? value.trim() : '';
        return this.isElementType(name) ? name : null;
    }

    static isElementType(value: string): value is EElementType {
        return (ALL_ELEMENT_TYPES as readonly string[]).includes(value);
    }

    static getIconPath(element: EElementType): string {
        return `${ELEM_ASSET_DIR}/ic_elem_${element}`;
    }
}


