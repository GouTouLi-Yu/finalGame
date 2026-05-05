import { pairs } from '../../frame/luaCompat/pairs';

export class MathUtil {
    private static getRandomMap(json: any): Map<number, [number, number]> {
        let low = 0;
        let high = 0;
        let map = new Map<number, [number, number]>();
        for (let [point, prob] of pairs(json)) {
            high = Number(point);
            map.set(prob, [low, high]);
            low = high + 1;
        }
        return map;
    }

    /** 根据表中配置的特殊随机值json获取最终值 */
    static getFinalValueBySpecialRandomJson(json: any): number {
        let random = Math.floor(Math.random() * 100);
        let map = this.getRandomMap(json);
        let total = 0;
        for (let [prob, [low, high]] of map) {
            total += prob;
            if (random < total) {
                let point = Math.floor(Math.random() * (high - low + 1)) + low;
                return point;
            }
        }
        console.error("getFinalValueBySpecialRandomJson error ===>", json);
        return 0;
    }
}


