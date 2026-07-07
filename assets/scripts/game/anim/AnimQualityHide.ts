import { _decorator, Component } from 'cc';
import { EventDispatcher, EventListener } from '../../frame/event/EventDispatcher';
import { LuaEvent } from '../../frame/event/PCEvent';
import { PCEventType } from '../../frame/event/PCEventType';
import { Injector } from '../../frame/Injector/Injector';
import {
    AnimQualityLevel,
    shouldHideAtQualityLevel,
} from './AnimQualityLevel';
import { AnimQualityService } from './AnimQualityService';

const { ccclass, menu, property } = _decorator;

/**
 * 按动画画质隐藏节点以节省性能。
 * qualityLevel：1=中档及以下隐藏，2=仅低档隐藏，0=始终显示。
 */
@ccclass('AnimQualityHide')
@menu('Game/AnimQualityHide')
export class AnimQualityHide extends Component {
    @property({
        tooltip: '1=中档及以下隐藏 2=仅低档隐藏 0=不隐藏',
    })
    qualityLevel = 2;

    private _listener: EventListener | null = null;
    private _baseActive = true;

    onLoad(): void {
        this._baseActive = this.node.active;
        this._registerQualityListener();
    }

    start(): void {
        this.applyLevel(AnimQualityService.getCurrent());
        this._registerQualityListener();
    }

    onDestroy(): void {
        this._unregisterQualityListener();
    }

    applyLevel(level: AnimQualityLevel): void {
        const hidden = shouldHideAtQualityLevel(this.qualityLevel, level);
        this.node.active = this._baseActive && !hidden;
    }

    private _registerQualityListener(): void {
        const dispatcher = this._getDispatcher();
        if (!dispatcher || this._listener) {
            return;
        }
        const listener = new EventListener();
        listener.fun = (event?: LuaEvent) => {
            const level = (event?.payload as { level?: AnimQualityLevel } | undefined)?.level
                ?? AnimQualityService.getCurrent();
            this.applyLevel(level);
        };
        listener.beDelete = false;
        listener.callthis = null;
        dispatcher.addEventListener(PCEventType.EVT_ANIM_QUALITY_CHANGED, listener);
        this._listener = listener;
    }

    private _unregisterQualityListener(): void {
        const dispatcher = this._getDispatcher();
        if (!dispatcher || !this._listener) {
            return;
        }
        dispatcher.removeEventListener(PCEventType.EVT_ANIM_QUALITY_CHANGED, this._listener);
        this._listener = null;
    }

    private _getDispatcher(): EventDispatcher | null {
        try {
            return Injector.shared.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher;
        } catch {
            return null;
        }
    }
}
