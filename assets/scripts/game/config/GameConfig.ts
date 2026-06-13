import { _decorator } from 'cc';
import { ELanguage } from '../i18n/LanguageType';
const { ccclass, property } = _decorator;

export const GameConfig = {
    test: false,
    /**
     * 强制开启 GM（仅开发者本地调试 release 包时用，正式发布务必保持 false）。
     */
    forceEnableGM: false,
    /** 默认语言；玩家曾在设置中切换过则以本地存储为准 */
    language: ELanguage.CN,
}

