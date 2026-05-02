import { StringConstants } from "./StringConstants";

type StringParam = Record<string, string | number | boolean | null | undefined>;

class Strings {
    public static get(id: string, param?: StringParam): string {
        return this.find(id, param) || id;
    }

    static find(id: string, param?: StringParam): string {
        if (!id) {
            console.trace("Strings.find: id is null or empty");
            return "";
        }
        const strId = id.toString();
        const content = (StringConstants as Record<string, string>)[strId];
        if (content == null || typeof content !== "string") {
            return "";
        }
        return this.getFormatString(content, param);
    }

    static getFormatString(str: string | null | undefined, param?: StringParam): string {
        if (str == null || str === "") {
            return str ?? "";
        }
        if (!param) {
            return str;
        }
        return str.replace(/\$\{(\w+)\}/g, (full, name: string) => {
            if (Object.prototype.hasOwnProperty.call(param, name)) {
                const v = param[name];
                return v != null ? String(v) : full;
            }
            return full;
        });
    }

    static isCNCharacter(char: string) {
        const reg = /[^\u4e00-\u9fa5]/;
        if (!reg.test(char)) {
            return true;
        }
        return false;
    }

    static isFullAngle(char: string) {
        const reg = /[\uff00-\uffff]/g;
        if (reg.test(char)) {
            return true;
        }
        return false;
    }

    static clampStringAndAddEllipsis(str: string, fontSize: number, maxWidth: number, offsetX: number = 0): string {
        let curWidth = 0;
        let i = 0;
        for (const char of str) {
            curWidth += (this.isCNCharacter(char) || this.isFullAngle(char)) ? fontSize : fontSize / 2;
            if (curWidth >= maxWidth - offsetX) {
                return str.substring(0, i) + "...";
            }
            i++;
        }
        return str;
    }

    static getFixWidthStr(str: string, charNum: number): string {
        const num = str.length;
        if (num >= charNum || num <= 1) {
            return str;
        }
        const spaceNum = (charNum - num) * 4;
        const preSpaceNum = Math.floor(spaceNum / (num - 1));
        let newStr = "";
        for (let i = 0; i < num; i++) {
            newStr += str[i];
            if (i < num - 1) {
                for (let j = 0; j < preSpaceNum; j++) {
                    newStr += " ";
                }
            }
        }
        return newStr;
    }

    static intToRoman(num: number): string {
        const romanNumerals: [number, string][] = [
            [1000, "M"],
            [900, "CM"],
            [500, "D"],
            [400, "CD"],
            [100, "C"],
            [90, "XC"],
            [50, "L"],
            [40, "XL"],
            [10, "X"],
            [9, "IX"],
            [5, "V"],
            [4, "IV"],
            [1, "I"],
        ];

        let result = "";
        let n = num;
        for (const [value, numeral] of romanNumerals) {
            while (n >= value) {
                result += numeral;
                n -= value;
            }
        }
        return result;
    }
}

export default Strings;
