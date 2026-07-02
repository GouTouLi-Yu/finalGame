/**
 * 图片处理插件
 */
'use strict';

const { checkBackgroundPlacement } = require('./lib/backgroundCheck');
const { moveSharedToCommon } = require('./lib/moveSharedToCommon');
const { disableAllAtlasCompressTexture } = require('./lib/disableAtlasCompressTexture');

async function runCheckBackground() {
    try {
        await checkBackgroundPlacement();
    } catch (error) {
        console.error('[image-tools] 背景图位置检查失败:', error);
    }
}

async function runMoveSharedToCommon() {
    try {
        await moveSharedToCommon();
    } catch (error) {
        console.error('[image-tools] 多引用资源移动失败:', error);
    }
}

async function runDisableAtlasCompressTexture() {
    try {
        await disableAllAtlasCompressTexture();
    } catch (error) {
        console.error('[image-tools] 取消图集压缩纹理失败:', error);
    }
}

exports.methods = {
    runCheckBackground,
    runMoveSharedToCommon,
    runDisableAtlasCompressTexture,
};

exports.load = function () {
    console.log('[image-tools] 图片处理插件已加载');
};

exports.unload = function () {
    console.log('[image-tools] 图片处理插件已卸载');
};
