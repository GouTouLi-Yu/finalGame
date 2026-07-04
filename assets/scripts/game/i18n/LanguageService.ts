import { ConfigReader } from '../../frame/Data/ConfigReader';
import { EventDispatcher } from '../../frame/event/EventDispatcher';
import { LuaEvent } from '../../frame/event/PCEvent';
import { PCEventType } from '../../frame/event/PCEventType';
import { Injector } from '../../frame/Injector/Injector';
import { GameConfig } from '../config/GameConfig';
import { DataStoreUtil } from '../utils/DataStoreUtil';
import {
    ELanguage,
    isSupportedLanguage,
    LANGUAGE_CYCLE_ORDER,
    LANGUAGE_FALLBACK_ORDER,
} from './LanguageType';

const LANGUAGE_STORAGE_KEY = 'game_language';
const TRANSLATE_TABLE = 'Translate';

export class LanguageService {
    private static _current: ELanguage = GameConfig.language;

    /** 启动时调用一次（ConfigReader.init 之后） */
    static init(): void {
        if (GameConfig.test) {
            // 测试模式下以 GameConfig.language 为准，避免本地缓存覆盖调试语言
            this._current = GameConfig.language;
            return;
        }
        const saved = DataStoreUtil.loadData<string>(LANGUAGE_STORAGE_KEY);
        this._current = isSupportedLanguage(saved) ? saved : GameConfig.language;
    }

    static getCurrent(): ELanguage {
        return this._current;
    }

    /** 当前语言对应的 Translate 表列名 */
    static getFieldKey(): ELanguage {
        return this._current;
    }

    static setLanguage(lang: ELanguage): void {
        if (!isSupportedLanguage(lang)) {
            console.warn(`[LanguageService] 不支持的语言: ${lang}`);
            return;
        }
        if (this._current === lang) {
            return;
        }
        this._current = lang;
        DataStoreUtil.saveData(LANGUAGE_STORAGE_KEY, lang);
        this.dispatchLanguageChanged();
    }

    /** 设置按钮：按 LANGUAGE_CYCLE_ORDER 循环切换 */
    static cycleLanguage(): ELanguage {
        const idx = LANGUAGE_CYCLE_ORDER.indexOf(this._current);
        const next = LANGUAGE_CYCLE_ORDER[(idx + 1) % LANGUAGE_CYCLE_ORDER.length];
        this.setLanguage(next);
        return next;
    }

    /** 从 Translate 表取当前语言文案；缺省时按 LANGUAGE_FALLBACK_ORDER 回退 */
    static getTranslateText(id: string): string | null {
        if (!id) {
            return null;
        }
        const row = ConfigReader.getDataById(TRANSLATE_TABLE, id);
        if (!row) {
            return null;
        }
        const field = this.getFieldKey();
        const text = row[field];
        if (typeof text === 'string' && text !== '') {
            return text;
        }
        const fallbacks = LANGUAGE_FALLBACK_ORDER[field];
        if (fallbacks) {
            for (const fbField of fallbacks) {
                const fbText = row[fbField];
                if (typeof fbText === 'string' && fbText !== '') {
                    return fbText;
                }
            }
        }
        return null;
    }

    private static dispatchLanguageChanged(): void {
        const dispatcher = Injector.shared.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher | null;
        if (!dispatcher) {
            return;
        }
        dispatcher.dispatchEvent(PCEventType.EVT_LANGUAGE_CHANGED, new LuaEvent(PCEventType.EVT_LANGUAGE_CHANGED, {
            language: this._current,
        }));
    }
}
