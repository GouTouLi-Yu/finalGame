import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';
import { pairs } from 'db://assets/scripts/frame/luaCompat/pairs';
import { Card } from '../model/card/Card';

const TABLE = 'CardConfig';

/** CardConfig.params：值为固定数或按等级下标的数组 */
export type ICardParams = Record<string, number | number[]>;

export class CardUtil {
    static getCfg(id: string) {
        return ConfigReader.getDataById(TABLE, id);
    }

    /** CardConfig 中全部卡牌 id（已排序） */
    static getAllIds(): string[] {
        const table = ConfigReader.getDataTable(TABLE);
        if (!table) {
            return [];
        }
        const ids: string[] = [];
        for (const [id] of pairs(table)) {
            if (this.getCfg(id)) {
                ids.push(String(id));
            }
        }
        ids.sort((a, b) => a.localeCompare(b));
        return ids;
    }

    static getManaPoint(id: string): number {
        return this.getCfg(id)?.manaPoint ?? 0;
    }

    static getActionId(id: string): string {
        return this.getCfg(id)?.actionId ?? '';
    }

    static isValidCardId(id: string): boolean {
        return this.getCfg(id) != null;
    }

    /**
     * 解析 params：数组取下标 level-1；单值各等级相同。
     * level 小于 1 时按 1 处理；超出数组长度取最后一档。
     */
    static resolveParams(
        params: ICardParams | null | undefined,
        level: number,
    ): Record<string, number> {
        const out: Record<string, number> = {};
        if (!params) {
            return out;
        }
        const index = Math.max(0, level - 1);
        for (const key of Object.keys(params)) {
            const val = params[key];
            if (Array.isArray(val)) {
                if (val.length === 0) {
                    out[key] = 0;
                } else {
                    out[key] = val[Math.min(index, val.length - 1)];
                }
            } else if (typeof val === 'number') {
                out[key] = val;
            }
        }
        return out;
    }

    static getParams(cardId: string, level: number): Record<string, number> {
        return this.resolveParams(this.getCfg(cardId)?.params, level);
    }

    static getParamsForCard(card: Card): Record<string, number> {
        return this.getParams(card.id, card.level);
    }
}
