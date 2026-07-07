import { _decorator, Animation, Component } from 'cc';
import { EventDispatcher, EventListener } from '../../frame/event/EventDispatcher';
import { LuaEvent } from '../../frame/event/PCEvent';
import { PCEventType } from '../../frame/event/PCEventType';
import { Injector } from '../../frame/Injector/Injector';
import { AnimQualityLevel, resolveAnimQualityClipName } from './AnimQualityLevel';
import { AnimQualityService } from './AnimQualityService';

const { ccclass, menu } = _decorator;

@ccclass('AnimQualityClip')
@menu('Game/AnimQualityClip')
export class AnimQualityClip extends Component {
    private _animation: Animation | null = null;
    private _listener: EventListener | null = null;

    onLoad(): void {
        this._animation = this.getComponent(Animation);
        this._registerQualityListener();
    }

    start(): void {
        this.applyLevel(AnimQualityService.getCurrent());
        this._registerQualityListener();
    }

    onDestroy(): void {
        this._unregisterQualityListener();
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

    private _hasTierClips(): boolean {
        return !!this._animation?.clips.some((clip) => clip?.name === 'animClip_mid');
    }

    applyLevel(level: AnimQualityLevel): void {
        if (!this._animation || !this._hasTierClips()) {
            return;
        }

        const clipNames = this._animation.clips.map((item) => item?.name);
        const clipName = resolveAnimQualityClipName(clipNames, level);
        const clip = clipName
            ? this._animation.clips.find((item) => item?.name === clipName)
            : undefined;
        if (!clip) {
            return;
        }

        const prevState = this._animation.defaultClip
            ? this._animation.getState(this._animation.defaultClip.name)
            : null;
        const normalizedTime = prevState && prevState.duration > 0
            ? (prevState.time % prevState.duration) / prevState.duration
            : 0;

        this._animation.stop();
        this._animation.defaultClip = clip;
        this._animation.play(clip.name);

        const nextState = this._animation.getState(clip.name);
        if (nextState && nextState.duration > 0) {
            nextState.time = normalizedTime * nextState.duration;
        }
    }
}
