/**
 * BC7 压缩插件
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ConfigManager = require('./lib/configManager');
const { compressFolder: doCompressFolder } = require('./lib/compressFolder');
const { restoreFolder: doRestoreFolder } = require('./lib/restoreFolder');

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
    await Editor.Panel.open('bc7-tools');
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
        title: '选择要 BC7 压缩的文件夹',
        path: defaultPath,
    });

    if (result.canceled || !result.filePaths || !result.filePaths.length) {
        return '';
    }

    return result.filePaths[0];
}

async function pickTexconv() {
    const config = configManager.readConfig();
    let defaultPath = Editor.Project.path;
    if (config.texconvPath && fs.existsSync(path.dirname(config.texconvPath))) {
        defaultPath = path.dirname(config.texconvPath);
    }

    const result = await Editor.Dialog.select({
        type: 'file',
        title: '选择 texconv.exe',
        path: defaultPath,
        filters: [
            { name: 'texconv', extensions: ['exe'] },
            { name: 'All', extensions: ['*'] },
        ],
    });

    if (result.canceled || !result.filePaths || !result.filePaths.length) {
        return '';
    }

    return result.filePaths[0];
}

async function compressFolder(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';
    const texconvPath = options && options.texconvPath ? options.texconvPath.trim() : '';
    const config = configManager.readConfig();
    const resolvedTexconv = texconvPath || (config.texconvPath || '').trim();

    if (!folderPath) {
        return { success: false, message: '请先选择文件夹' };
    }

    try {
        const result = await doCompressFolder(folderPath, resolvedTexconv);
        configManager.saveConfig({
            ...config,
            texconvPath: resolvedTexconv,
            lastFolder: folderPath,
        });
        return result;
    } catch (error) {
        console.error('[bc7-tools] 压缩失败:', error);
        return { success: false, message: error.message || String(error) };
    }
}

async function restoreFolder(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';
    if (!folderPath) {
        return { success: false, message: '请先选择要还原的文件夹' };
    }

    try {
        return await doRestoreFolder(folderPath);
    } catch (error) {
        console.error('[bc7-tools] 还原失败:', error);
        return { success: false, message: error.message || String(error) };
    }
}

exports.methods = {
    openPanel,
    getConfig,
    setConfig,
    pickFolder,
    pickTexconv,
    compressFolder,
    restoreFolder,
};

exports.load = function () {
    console.log('[bc7-tools] 插件已加载');
};

exports.unload = function () {
    console.log('[bc7-tools] 插件已卸载');
};
