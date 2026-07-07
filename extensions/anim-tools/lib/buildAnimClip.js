/**
 * 生成 animClip.anim JSON
 */
'use strict';

const SAMPLE = 30;

function buildAnimClipJson(spriteFrameUuids, options = {}) {
    const clipName = options.clipName || 'animClip';
    const sample = typeof options.sample === 'number' && options.sample > 0 ? options.sample : SAMPLE;
    const frameCount = spriteFrameUuids.length;
    const frameStep = 1 / sample;
    const times = [];
    for (let i = 0; i < frameCount; i += 1) {
        times.push(Number((i * frameStep).toFixed(16)));
    }
    const duration = frameCount > 0 ? times[frameCount - 1] : 0;
    const values = spriteFrameUuids.map((uuid) => ({
        __uuid__: uuid,
        __expectedType__: 'cc.SpriteFrame',
    }));

    return [
        {
            __type__: 'cc.AnimationClip',
            _name: clipName,
            _objFlags: 0,
            __editorExtras__: {
                embeddedPlayerGroups: [],
            },
            _native: '',
            sample,
            speed: 1,
            wrapMode: 2,
            enableTrsBlending: false,
            _duration: duration,
            _hash: Math.floor(Math.random() * 1000000000),
            _tracks: [{ __id__: 1 }],
            _exoticAnimation: null,
            _events: [],
            _embeddedPlayers: [],
            _additiveSettings: { __id__: 6 },
            _auxiliaryCurveEntries: [],
        },
        {
            __type__: 'cc.animation.ObjectTrack',
            _binding: {
                __type__: 'cc.animation.TrackBinding',
                path: { __id__: 2 },
                proxy: null,
            },
            _channel: { __id__: 4 },
        },
        {
            __type__: 'cc.animation.TrackPath',
            _paths: [{ __id__: 3 }, 'spriteFrame'],
        },
        {
            __type__: 'cc.animation.ComponentPath',
            component: 'cc.Sprite',
        },
        {
            __type__: 'cc.animation.Channel',
            _curve: { __id__: 5 },
        },
        {
            __type__: 'cc.ObjectCurve',
            _times: times,
            _values: values,
        },
        {
            __type__: 'cc.AnimationClipAdditiveSettings',
            enabled: false,
            refClip: null,
        },
    ];
}

module.exports = {
    buildAnimClipJson,
    SAMPLE,
};
