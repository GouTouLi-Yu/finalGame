/** 磁盘存档 JSON 对应的结构；变更时请递增 SAVE_VERSION 并做好迁移或兼容 */

/** 与磁盘存档不兼容时由 {@link SaveGameService.load} 整份移除 */
export const SAVE_VERSION = 5;

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

/** 冒险卡牌单条存档（对应 {@link AdventureCardModel}；id 为 CardConfig.id） */
export interface IAdventureCardSaveData {
    id: string;
    level: number;
}

/** 冒险存档（各字段对应 AdventureModel 子模块） */
export interface IAdventureSaveData {
    adventureCards: IAdventureCardSaveData[];
}

export interface PlayerSaveData {
    version: number;
    elementDatas?: IElementSaveData;
    itemDatas?: IItemSaveData;
    adventureDatas?: IAdventureSaveData;
}
