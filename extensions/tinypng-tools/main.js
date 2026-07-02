/**
 * TinyPNG 压缩插件
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ConfigManager = require('./lib/configManager');
const { compressFolder: doCompressFolder } = require('./lib/compressFolder');

const configManager = new ConfigManager();

const DEFAULT_ART_FOLDER_RELATIVE = '../reslgy/美术';

function getDefaultArtFolder() {
    const config = configManager.readConfig();
    const stored = (config.defaultArtFolder || DEFAULT_ART_FOLDER_RELATIVE).trim();
    const resolved = path.isAbsolute(stored)
        ? path.normalize(stored)
        : path.normalize(path.join(Editor.Project.path, stored));
    if (fs.existsSync(resolved)) {
        return resolved;
    }
    return Editor.Project.path;
}

async function openPanel() {
    await Editor.Panel.open('tinypng-tools');
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
    const config = configManager.readConfig();
    let defaultPath = getDefaultArtFolder();
    if (config.lastFolder && fs.existsSync(config.lastFolder)) {
        defaultPath = config.lastFolder;
    }

    const result = await Editor.Dialog.select({
        type: 'directory',
        title: '选择要压缩的图片文件夹',
        path: defaultPath,
    });

    if (result.canceled || !result.filePaths || !result.filePaths.length) {
        return '';
    }

    return result.filePaths[0];
}

async function compressFolder(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';
    const apiKey = options && options.apiKey ? options.apiKey.trim() : '';

    if (!folderPath) {
        return {
            success: false,
            message: '请先选择文件夹',
        };
    }

    const config = configManager.readConfig();
    const key = apiKey || (config.apiKey || '').trim();

    try {
        const result = await doCompressFolder(folderPath, key);

        configManager.saveConfig({
            ...config,
            apiKey: key,
            lastFolder: folderPath,
        });

        return result;
    } catch (error) {
        console.error('[tinypng-tools] 压缩失败:', error);
        return {
            success: false,
            message: error.message || String(error),
        };
    }
}

exports.methods = {
    openPanel,
    getConfig,
    setConfig,
    pickFolder,
    compressFolder,
};

exports.load = function () {
    console.log('[tinypng-tools] 插件已加载');
};

exports.unload = function () {
    console.log('[tinypng-tools] 插件已卸载');
};
