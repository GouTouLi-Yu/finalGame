import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';
import { pairs } from 'db://assets/scripts/frame/luaCompat/pairs';
import Strings from '../../../utils/Strings';
import { Card } from '../model/card/Card';

const TABLE = 'CardConfig';

const CARD_ASSET_DIR = 'asset/card';
const CARD_ICON_DIR = `${CARD_ASSET_DIR}/cardIcon`;
const MIN_QUALITY = 1;
const MAX_QUALITY = 4;

/** CardConfig.params：值为固定数或按等级下标的数组 */
export type ICardParams = Record<string, number | number[]>;

/** 卡牌描述类型：战斗手牌用 brief，详情弹窗用 detailed */
export type CardDescKind = 'brief' | 'detailed';

/** CardConfig 行（与配表字段一致） */
export interface ICardConfigRow {
    id: string;
    manaPoint?: number;
    name?: string;
    iconName?: string;
    /** 简单描述（战斗界面） */
    briefDesc?: string;
    /** 详细描述（卡牌详情） */
    detailedDesc?: string;
    elem1?: string;
    elem2?: string;
    isResonance?: string | number | boolean;
    actionId?: string;
    weak?: string | number;
    params?: ICardParams;
    quality?: number;
    buyPrice?: number;
    conditionId?: string;
}

export class CardUtil {
    static getCfg(id: string): ICardConfigRow | null {
        return ConfigReader.getDataById(TABLE, id) as ICardConfigRow | null;
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

    /** 品质 clamp 到 1~4，非法值回退 1 */
    static clampQuality(quality: unknown): number {
        const q = typeof quality === 'number' ? quality : Number(quality);
        if (!Number.isFinite(q)) {
            return MIN_QUALITY;
        }
        return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.floor(q)));
    }

    /** 品质图资源名：pic_kpd_01 / pic_yd_02 … */
    static formatQualityImageName(prefix: string, quality: unknown): string {
        const clamped = this.clampQuality(quality);
        const suffix = clamped < 10 ? `0${clamped}` : String(clamped);
        return `${prefix}_${suffix}`;
    }

    static getQualityBgPath(quality: unknown): string {
        return `${CARD_ASSET_DIR}/${this.formatQualityImageName('pic_kpd', quality)}`;
    }

    static getQualityBadgePath(quality: unknown): string {
        return `${CARD_ASSET_DIR}/${this.formatQualityImageName('pic_yd', quality)}`;
    }

    static getIconPath(iconName: unknown): string | null {
        const name = typeof iconName === 'string' ? iconName.trim() : '';
        return name ? `${CARD_ICON_DIR}/${name}` : null;
    }

    /** 配表布尔：支持 true / 1 / "1" / "true" / "yes" */
    static parseConfigBool(value: unknown): boolean {
        if (value === true || value === 1) {
            return true;
        }
        if (typeof value === 'string') {
            const s = value.trim().toLowerCase();
            return s === '1' || s === 'true' || s === 'yes';
        }
        return false;
    }

    static isResonance(cfg: ICardConfigRow | null | undefined): boolean {
        return this.parseConfigBool(cfg?.isResonance);
    }

    static getDisplayName(cardId: string): string {
        return Strings.get(this.getCfg(cardId)?.name ?? '');
    }

    /**
     * 描述文案；默认 briefDesc。
     * level 传入时会注入 params 占位符（如 ${dmgRate}）
     */
    static getDisplayDesc(cardId: string, level?: number, kind: CardDescKind = 'brief'): string {
        const cfg = this.getCfg(cardId);
        if (cfg == null) {
            return '';
        }
        const key = kind === 'detailed' ? (cfg.detailedDesc ?? '') : (cfg.briefDesc ?? '');
        const params = level != null ? this.getParams(cardId, level) : undefined;
        return Strings.get(key, params);
    }
}
