/** 游戏支持的语言（与 Translate 表字段 CN / EN / JP / CHT / KR 一致） */
export enum ELanguage {
    CN = 'CN',
    CHT = 'CHT',
    EN = 'EN',
    JP = 'JP',
    KR = 'KR',
}

export const DEFAULT_LANGUAGE = ELanguage.CN;

/** 所有支持的语言代码 */
export const SUPPORTED_LANGUAGES: readonly ELanguage[] = [
    ELanguage.CN,
    ELanguage.CHT,
    ELanguage.EN,
    ELanguage.JP,
    ELanguage.KR,
];

/** 语言切换顺序（设置按钮循环） */
export const LANGUAGE_CYCLE_ORDER: readonly ELanguage[] = SUPPORTED_LANGUAGES;

/** 界面展示用语言名（用该语言自身书写） */
export const LANGUAGE_NATIVE_NAMES: Readonly<Record<ELanguage, string>> = {
    [ELanguage.CN]: '简体中文',
    [ELanguage.CHT]: '繁體中文',
    [ELanguage.EN]: 'English',
    [ELanguage.JP]: '日本語',
    [ELanguage.KR]: '한국어',
};

/**
 * 某语言缺文案时的回退顺序。
 * 例：繁中缺条目时回退简体；其它语言缺条目时回退简体。
 */
export const LANGUAGE_FALLBACK_ORDER: Readonly<Partial<Record<ELanguage, readonly ELanguage[]>>> = {
    [ELanguage.CHT]: [ELanguage.CN],
    [ELanguage.EN]: [ELanguage.CN],
    [ELanguage.JP]: [ELanguage.CN],
    [ELanguage.KR]: [ELanguage.CN],
};

export function isSupportedLanguage(raw: unknown): raw is ELanguage {
    return typeof raw === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(raw);
}

export function getLanguageNativeName(lang: ELanguage): string {
    return LANGUAGE_NATIVE_NAMES[lang] ?? lang;
}
