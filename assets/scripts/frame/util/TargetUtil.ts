
/**
 * @description 通用目标工具类， 目前作用有：
 * 1. 解析excel target 字符串，返回实际需要检查的 key 列表。
 */
export class TargetUtil {
    /**
     * 解析 target 字符串，返回实际需要检查的 key 列表。
     * 
     * 语法：
     *   "fire"           → ["fire"]
     *   "fire+thunder"   → ["fire", "thunder"]
     *   "all-fire"       → 除 fire 外所有
     *   "all-fire-thunder" → 除 fire 和 thunder 外所有
     *   "all"            → 全部
     * 
     * @param target   要解析的字符串
     * @param allKeys  全集列表，比如所有元素名、所有属性名、所有技能类型
     */
    static resolve(target: string, allKeys: string[]): string[] {
        if (target === 'all') {
            return [...allKeys];
        }

        if (target.startsWith('all-')) {
            const excluded = target.substring(4).split('-');
            return allKeys.filter(e => !excluded.includes(e));
        }

        return target.split('+');
    }
}


