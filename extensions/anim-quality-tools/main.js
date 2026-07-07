/**
 * 动画画质分级工具
 */
'use strict';

const {
    buildQualityTiersForSelection,
    getSelectedAssetInfos,
    formatBuildResults,
} = require('./lib/assetMenu');

async function runBuildForSelection(tierMode, dialogTitle) {
    const assetInfos = await getSelectedAssetInfos();
    if (assetInfos.length === 0) {
        throw new Error('请先在资源管理器中选中帧动画目录或目录内文件');
    }
    const results = await buildQualityTiersForSelection(assetInfos, tierMode);
    await Editor.Dialog.info(dialogTitle, formatBuildResults(results, tierMode).join('\n\n'));
    return results;
}

async function runBuildQualityTiers() {
    try {
        return await runBuildForSelection('three', '三档画质 clip 已生成');
    } catch (error) {
        console.error('[anim-quality-tools] 生成三档失败:', error);
        await Editor.Dialog.error('三档画质 clip 生成失败', error.message || String(error));
    }
}

async function runBuildQualityTiersTwo() {
    try {
        return await runBuildForSelection('two', '两档画质 clip 已生成');
    } catch (error) {
        console.error('[anim-quality-tools] 生成两档失败:', error);
        await Editor.Dialog.error('两档画质 clip 生成失败', error.message || String(error));
    }
}

exports.methods = {
    runBuildQualityTiers,
    runBuildQualityTiersTwo,
};

exports.load = function load() {
    console.log('[anim-quality-tools] 动画画质分级插件已加载');
};

exports.unload = function unload() {
    console.log('[anim-quality-tools] 动画画质分级插件已卸载');
};
