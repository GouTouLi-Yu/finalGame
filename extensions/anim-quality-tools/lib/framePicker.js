/**
 * 均匀抽帧：隔若干帧保留一帧，避免连续删除
 */
'use strict';

function pickEvenlySpacedIndices(totalCount, keepRatio) {
    if (totalCount <= 0) {
        return [];
    }
    const targetCount = Math.max(1, Math.round(totalCount * keepRatio));
    if (targetCount >= totalCount) {
        return Array.from({ length: totalCount }, (_, index) => index);
    }

    const indices = [];
    for (let i = 0; i < targetCount; i += 1) {
        indices.push(Math.round((i * (totalCount - 1)) / (targetCount - 1)));
    }

    return [...new Set(indices)].sort((a, b) => a - b);
}

module.exports = {
    pickEvenlySpacedIndices,
};
