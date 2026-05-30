/** 游戏支持的语言（与 Translate 表字段 zh / en / ja 一致） */
export enum ELanguage {
    CN = 'CN',
    EN = 'EN',
    JP = 'JP',
}

export const DEFAULT_LANGUAGE = ELanguage.CN;

/** 语言切换顺序（设置按钮可循环） */
export const LANGUAGE_CYCLE_ORDER: readonly ELanguage[] = [
    ELanguage.CN,
    ELanguage.EN,
    ELanguage.JP,
];
