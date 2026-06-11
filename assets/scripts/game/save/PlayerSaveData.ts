/** 磁盘存档 JSON 对应的结构；变更时请递增 SAVE_VERSION 并做好迁移或兼容 */

/** 与磁盘存档不兼容时由 {@link SaveGameService.load} 整份移除 */
export const SAVE_VERSION = 2;

/** 元素组件数据 */
export interface IElementSaveDataItem {
    point: number;
}

/** 元素Model数据（键为 EElementType 的字符串值） */
export interface IElementSaveData {
    elements: Record<string, IElementSaveDataItem>;
}

/** 道具背包存档 */
export interface IItemSaveData {
    items: string[];
}

/** 卡牌数据 */
export interface ICardSaveDataItem {
    level: number;
}

/** 卡牌Model数据 */
export interface ICardSaveData {
    cards: Map<string, ICardSaveDataItem>;
}

export interface PlayerSaveData {
    version: number;
    elementDatas?: IElementSaveData;
    itemDatas?: IItemSaveData;
    cardDatas?: ICardSaveData;
}
