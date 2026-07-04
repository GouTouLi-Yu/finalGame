/**
 * 动画工具插件
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ConfigManager = require('./lib/configManager');
const { buildFrameAnim } = require('./lib/buildFrameAnim');
const { suggestPrefixFromSource } = require('./lib/animPathUtil');

const configManager = new ConfigManager();

/** 选文件夹对话框默认打开的目录（相对项目根） */
const DEFAULT_ANIM_FOLDER_RELATIVE = '../reslgy/美术/anim';

function getDefaultAnimFolder() {
    const config = configManager.readConfig();
    const stored = (config.defaultAnimFolder || DEFAULT_ANIM_FOLDER_RELATIVE).trim();
    const resolved = path.isAbsolute(stored)
        ? path.normalize(stored)
        : path.normalize(path.join(Editor.Project.path, stored));
    if (fs.existsSync(resolved)) {
        return resolved;
    }
    return Editor.Project.path;
}

async function openBuildPanel() {
    await Editor.Panel.open('anim-tools.build');
}

function getConfig() {
    return configManager.readConfig();
}

function setConfig(config) {
    if (config) {
        configManager.saveConfig({
            ...configManager.readConfig(),
            ...config,
        });
    }
    return true;
}

async function pickFolder() {
    const result = await Editor.Dialog.select({
        type: 'directory',
        title: '选择序列帧文件夹',
        path: getDefaultAnimFolder(),
    });

    if (result.canceled || !result.filePaths || !result.filePaths.length) {
        return '';
    }

    return result.filePaths[0];
}

function suggestPrefix(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';
    if (!folderPath) {
        return '';
    }
    return suggestPrefixFromSource(folderPath);
}

async function buildFrameAnimAction(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';
    const prefix = options && options.prefix ? options.prefix.trim() : '';
    const scale = options && options.scale !== undefined ? options.scale : 1;

    if (!folderPath) {
        return {
            success: false,
            message: '请先选择美术序列帧目录',
        };
    }

    if (!prefix) {
        return {
            success: false,
            message: '请先输入命名前缀',
        };
    }

    if (!Number.isFinite(scale) || scale < 0 || scale > 2) {
        return {
            success: false,
            message: '缩放比例必须是 0 ~ 2 之间的数值',
        };
    }

    try {
        const result = await buildFrameAnim(folderPath, { scale, prefix });
        if (result.success) {
            configManager.saveConfig({
                ...configManager.readConfig(),
                lastBuildFolder: folderPath,
                lastBuildScale: scale,
                lastPrefix: prefix,
            });
            console.log(`✓ ${result.message}`);
        } else {
            console.warn(`[anim-tools] ${result.message}`);
        }
        return result;
    } catch (error) {
        console.error('[anim-tools] 制作帧动画失败:', error);
        return {
            success: false,
            message: error.message || String(error),
        };
    }
}

exports.methods = {
    openBuildPanel,
    getConfig,
    setConfig,
    pickFolder,
    suggestPrefix,
    buildFrameAnimAction,
};

exports.load = function () {
    console.log('[anim-tools] 插件已加载');
};

exports.unload = function () {
    console.log('[anim-tools] 插件已卸载');
};
