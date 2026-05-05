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

export interface PlayerSaveData {
    version: number;
    elementModel?: IElementSaveData;
}
