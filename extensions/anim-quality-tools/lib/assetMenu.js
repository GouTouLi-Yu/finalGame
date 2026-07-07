'use strict';

const { buildQualityTiersForSelection } = require('./buildQualityTiers');

async function queryAssetInfo(uuid) {
    try {
        return await Editor.Message.request('asset-db', 'query-asset-info', uuid);
    } catch (error) {
        return null;
    }
}

async function getSelectedAssetInfos() {
    const uuids = Editor.Selection.getSelected('asset') || [];
    const infos = [];
    for (const uuid of uuids) {
        const info = await queryAssetInfo(uuid);
        if (info && info.file) {
            infos.push(info);
        }
    }
    return infos;
}

function formatBuildResults(results, tierMode) {
    if (tierMode === 'two') {
        return results.map((item) => (
            `${item.relPath}\n  高 ${item.highFrames} 帧 / 中 ${item.midFrames} 帧（低画质运行时使用中档）`
        ));
    }
    return results.map((item) => (
        `${item.relPath}\n  高 ${item.highFrames} 帧 / 中 ${item.midFrames} 帧 / 低 ${item.lowFrames} 帧`
    ));
}

exports.getSelectedAssetInfos = getSelectedAssetInfos;
exports.formatBuildResults = formatBuildResults;
exports.buildQualityTiersForSelection = buildQualityTiersForSelection;
