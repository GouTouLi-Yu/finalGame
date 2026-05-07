
/**
 * 比较工具类
 * @description 目前支持的功能
 * 1. 解析excel比较表达式，返回比较结果
 */
export class CompareUtil {
    /**
     *
     * @description 解析比较表达式，返回比较结果
     * @param actual 实际值
     * @param raw 比较表达式
     * @detail 目前支持的比较表达式格式种类：
     * 1. >= a && <= b
     * 2. > a && < b
     * 3. >= a && < b
     * 4. > a && <= b
     * 5. = a
     * 6. != a
     * 7. >= a
     * 8. <= a
     * 9. > a
     * 10. < a
     * @return 比较结果
     */
    static parse(actual: number, raw: string): boolean {
        const parts = raw.split('&&').map(p => p.trim());
        if (parts.length === 1) {
            return CompareUtil.checkSingle(actual, parts[0]);
        }
        if (parts.length === 2) {
            return CompareUtil.checkSingle(actual, parts[0])
                && CompareUtil.checkSingle(actual, parts[1]);
        }
        return false;
    }

    /**
     * 解析单个条件：>=3、<=7、>5、<10、=1、!=0
     */
    private static checkSingle(actual: number, raw: string): boolean {
        const match = raw.match(/^(>=|<=|>|<|=|!=)\s*(-?\d+)$/);
        if (!match) return false;
        const op = match[1];
        const target = Number(match[2]);
        switch (op) {
            case '>=': return actual >= target;
            case '<=': return actual <= target;
            case '>': return actual > target;
            case '<': return actual < target;
            case '=': return actual === target;
            case '!=': return actual !== target;
            default: return false;
        }
    }


    /**
     * @description 将多个值按运算符方向聚合成一个值，然后比较。
     * @param values 多个值
     * @param raw 比较表达式
     * @returns true 如果满足条件
     */
    static parseMulti(values: number[], raw: string): boolean {
        if (values.length === 0) return true;

        if (values.length === 1) {
            return CompareUtil.parse(values[0], raw);
        }

        // = 和 != 逐一比较
        if (raw.startsWith('=') || raw.startsWith('!=')) {
            const match = raw.match(/^(=|!=)\s*(-?\d+)$/);
            if (!match) return false;
            const op = match[1];
            const target = Number(match[2]);
            return op === '!='
                ? values.every(v => v !== target)
                : values.every(v => v === target);
        }

        // 范围比较：先聚合
        let aggregated: number;
        if (raw.includes('<')) {
            aggregated = Math.max(...values);
        } else if (raw.includes('>')) {
            aggregated = Math.min(...values);
        } else {
            return false;
        }

        return CompareUtil.parse(aggregated, raw);
    }
}


