import { EventDispatcher } from '../../frame/event/EventDispatcher';
import { LuaEvent } from '../../frame/event/PCEvent';
import { PCEventType } from '../../frame/event/PCEventType';
import { Injector } from '../../frame/Injector/Injector';
import { DataStoreUtil } from '../utils/DataStoreUtil';
import {
    DEFAULT_GRAPHICS_QUALITY,
    EGraphicsQuality,
    GRAPHICS_QUALITY_CYCLE_ORDER,
    GRAPHICS_QUALITY_SCALE,
    isSupportedGraphicsQuality,
} from './GraphicsQualityLevel';

const GRAPHICS_QUALITY_STORAGE_KEY = 'game_graphics_quality';

export interface IGraphicsQualityScaler {
    applyQuality(): void;
    /** 延迟到下一帧再 apply，避免弹窗/按钮点击与 Canvas 布局同帧冲突 */
    scheduleApplyQuality?(): void;
    /** 中低画质下将新挂到 HUD/弹窗层的节点同步为 UI_2D */
    syncLayers?(): void;
}

/** 画质档位：本地持久化 + 驱动 RenderTexture 双相机架构 */
export class GraphicsQualityService {
    private static _current: EGraphicsQuality = DEFAULT_GRAPHICS_QUALITY;
    private static _scaler: IGraphicsQualityScaler | null = null;

    static init(): void {
        const saved = DataStoreUtil.loadData<string>(GRAPHICS_QUALITY_STORAGE_KEY);
        this._current = isSupportedGraphicsQuality(saved) ? saved : DEFAULT_GRAPHICS_QUALITY;
        this._scaler?.applyQuality();
    }

    static registerScaler(scaler: IGraphicsQualityScaler): void {
        this._scaler = scaler;
        this._scaler.applyQuality();
    }

    static unregisterScaler(scaler: IGraphicsQualityScaler): void {
        if (this._scaler === scaler) {
            this._scaler = null;
        }
    }

    static getCurrent(): EGraphicsQuality {
        return this._current;
    }

    static getCurrentScale(): number {
        return GRAPHICS_QUALITY_SCALE[this._current];
    }

    static setQuality(quality: EGraphicsQuality): void {
        if (!isSupportedGraphicsQuality(quality)) {
            console.warn(`[GraphicsQualityService] 不支持的画质: ${quality}`);
            return;
        }
        if (this._current === quality) {
            return;
        }
        this._current = quality;
        DataStoreUtil.saveData(GRAPHICS_QUALITY_STORAGE_KEY, quality);
        this._scaler?.applyQuality();
        this._dispatchChanged();
    }

    /** 设置弹窗内切换：先关弹窗，下一帧再 apply，避免与 RT 切换同帧冲突 */
    static setQualityFromSetting(quality: EGraphicsQuality): void {
        if (!isSupportedGraphicsQuality(quality)) {
            console.warn(`[GraphicsQualityService] 不支持的画质: ${quality}`);
            return;
        }
        if (this._current === quality) {
            return;
        }
        this._current = quality;
        DataStoreUtil.saveData(GRAPHICS_QUALITY_STORAGE_KEY, quality);
        this._requestApplyQuality(false);
        this._dispatchChanged();
    }

    /** 新界面打开后重新同步 Layer（仅 area 切换时由 UIManager 调用） */
    static refresh(): void {
        this._requestApplyQuality(true);
    }

    /** 弹窗 / HUD 挂节点后同步 Layer，不触发完整 applyQuality */
    static syncLayers(): void {
        this._scaler?.syncLayers?.();
    }

    private static _requestApplyQuality(immediate = false): void {
        if (!this._scaler) {
            return;
        }
        if (!immediate && typeof this._scaler.scheduleApplyQuality === 'function') {
            this._scaler.scheduleApplyQuality();
            return;
        }
        this._scaler.applyQuality();
    }

    /** F9 调试用：立即切换，不走延迟 */
    static cycleQuality(): EGraphicsQuality {
        const idx = GRAPHICS_QUALITY_CYCLE_ORDER.indexOf(this._current);
        const next = GRAPHICS_QUALITY_CYCLE_ORDER[(idx + 1) % GRAPHICS_QUALITY_CYCLE_ORDER.length];
        if (this._current === next) {
            return next;
        }
        this._current = next;
        DataStoreUtil.saveData(GRAPHICS_QUALITY_STORAGE_KEY, next);
        this._scaler?.applyQuality();
        this._dispatchChanged();
        return next;
    }

    private static _dispatchChanged(): void {
        const dispatcher = Injector.shared.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher | null;
        if (!dispatcher) {
            return;
        }
        dispatcher.dispatchEvent(
            PCEventType.EVT_GRAPHICS_QUALITY_CHANGED,
            new LuaEvent(PCEventType.EVT_GRAPHICS_QUALITY_CHANGED, {
                quality: this._current,
                scale: this.getCurrentScale(),
            }),
        );
    }
}
