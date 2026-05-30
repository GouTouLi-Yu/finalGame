import { _decorator } from 'cc';
import { ELanguage } from '../i18n/LanguageType';
const { ccclass, property } = _decorator;

export const GameConfig = {
    test: true,
    /** 默认语言；玩家曾在设置中切换过则以本地存储为准 */
    language: ELanguage.CN,
}

