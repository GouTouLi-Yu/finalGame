import { EventDispatcher } from '../../frame/event/EventDispatcher';
import { LuaEvent } from '../../frame/event/PCEvent';
import { PCEventType } from '../../frame/event/PCEventType';
import { Injector } from '../../frame/Injector/Injector';
import { DataStoreUtil } from '../utils/DataStoreUtil';
import { AnimQualityApplier } from './AnimQualityApplier';
import {
    ANIM_QUALITY_CYCLE_ORDER,
    AnimQualityLevel,
    isAnimQualityLevel,
} from './AnimQualityLevel';

const STORAGE_KEY = 'game_anim_quality';

export class AnimQualityService {
    private static _current: AnimQualityLevel = AnimQualityLevel.High;

    static init(): void {
        const saved = DataStoreUtil.loadData<string>(STORAGE_KEY);
        this._current = isAnimQualityLevel(saved) ? saved : AnimQualityLevel.High;
        this.refreshAll();
    }

    /** 对当前场景中所有可切换画质的 Animation 重新应用档位 */
    static refreshAll(): number {
        return AnimQualityApplier.refreshAll(this._current);
    }

    static getCurrent(): AnimQualityLevel {
        return this._current;
    }

    static setLevel(level: AnimQualityLevel): void {
        if (!isAnimQualityLevel(level)) {
            console.warn(`[AnimQualityService] 无效画质档位: ${level}`);
            return;
        }
        if (this._current === level) {
            return;
        }
        this._current = level;
        DataStoreUtil.saveData(STORAGE_KEY, level);
        this.dispatchChanged();
        this.refreshAll();
    }

    static cycleLevel(): AnimQualityLevel {
        const idx = ANIM_QUALITY_CYCLE_ORDER.indexOf(this._current);
        const next = ANIM_QUALITY_CYCLE_ORDER[(idx + 1) % ANIM_QUALITY_CYCLE_ORDER.length];
        this.setLevel(next);
        return next;
    }

    private static dispatchChanged(): void {
        const dispatcher = Injector.shared.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher | null;
        if (!dispatcher) {
            return;
        }
        dispatcher.dispatchEvent(
            PCEventType.EVT_ANIM_QUALITY_CHANGED,
            new LuaEvent(PCEventType.EVT_ANIM_QUALITY_CHANGED, { level: this._current }),
        );
    }
}
