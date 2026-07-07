/**
 * 动画画质档位预设（PC 轻量：共用 res/ 图集，仅生成多档 clip）
 */
'use strict';

const TIERS = {
    high: {
        id: 'high',
        label: '高',
        clipName: 'animClip',
        keepRatio: 1,
    },
    mid: {
        id: 'mid',
        label: '中',
        clipName: 'animClip_mid',
        keepRatio: 5 / 6,
    },
    low: {
        id: 'low',
        label: '低',
        clipName: 'animClip_low',
        keepRatio: 2 / 3,
    },
};

/** @typedef {'three' | 'two'} TierMode */

const TIER_MODES = {
    three: {
        id: 'three',
        label: '三档',
        tierKeys: ['high', 'mid', 'low'],
    },
    two: {
        id: 'two',
        label: '两档',
        tierKeys: ['high', 'mid'],
    },
};

const SHARED_RES_DIR = 'res';
const MARKER_FILE = 'animQuality.json';
const LEGACY_RES_DIRS = ['res_mid', 'res_low'];

function getTierMode(mode) {
    return TIER_MODES[mode] || TIER_MODES.three;
}

module.exports = {
    TIERS,
    TIER_MODES,
    getTierMode,
    SHARED_RES_DIR,
    MARKER_FILE,
    LEGACY_RES_DIRS,
};
