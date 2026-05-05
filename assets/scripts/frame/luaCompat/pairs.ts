/**
 * 移植自 k 项目 `engine/extend/G.ts` 的 `pairs`。
 * 用于以「键, 值」形式遍历 JSON/普通对象、数组、Map（与 Lua `pairs` 习惯类似）。
 *
 * @example
 * for (const [key, value] of pairs(someJson)) { ... }
 */
export function* pairs(table: any): Generator<[any, any], void, unknown> {
    if (table instanceof Array) {
        for (let i = 0; i < table.length; i++) {
            yield [String(i), table[i]];
        }
    } else if (table instanceof Map) {
        for (const entry of table.entries()) {
            yield [entry[0] as any, entry[1]];
        }
    } else if (table) {
        for (const key in table) {
            yield [key, table[key]];
        }
    }
}

/**
 * 移植自 k 的 `ipairs`：数组按下标；Map 用 entries；其它对象按连续数字字符串键 \"0\"、\"1\"…
 */
export function* ipairs(table: any): Generator<[any, any], void, unknown> {
    if (table instanceof Array) {
        for (let i = 0; i < table.length; i++) {
            yield [i, table[i]];
        }
    } else if (table instanceof Map) {
        for (const entry of table.entries()) {
            yield [entry[0], entry[1]];
        }
    } else if (table) {
        let index = 0;
        let key = String(index);
        while (key in table) {
            yield [index, table[key]];
            ++index;
            key = String(index);
        }
    }
}
