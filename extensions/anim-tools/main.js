/**
 * 动画工具插件
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ConfigManager = require('./lib/configManager');
const { batchRenameImages } = require('./lib/batchRename');
const { buildFrameAnim } = require('./lib/buildFrameAnim');

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

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function toDbUrl(absolutePath) {
    const projectRoot = Editor.Project.path;
    const relative = path.relative(projectRoot, absolutePath);
    if (relative.startsWith('..')) {
        return null;
    }
    return `db://${toPosixPath(relative)}`;
}

async function refreshFolderIfInProject(folderPath) {
    const dbUrl = toDbUrl(path.normalize(folderPath));
    if (!dbUrl) {
        return;
    }
    try {
        await Editor.Message.request('asset-db', 'refresh-asset', dbUrl);
    } catch (error) {
        console.warn('[anim-tools] 刷新资源目录失败:', error.message || error);
    }
}

async function openPanel() {
    await Editor.Panel.open('anim-tools');
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

async function batchRename(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';
    const prefix = options && options.prefix ? options.prefix.trim() : '';

    if (!folderPath) {
        return {
            success: false,
            message: '请先选择文件夹',
            files: [],
        };
    }

    try {
        console.log('========== 动画一键命名 ==========');
        console.log(`文件夹: ${folderPath}`);
        console.log(`前缀: ${prefix}`);

        const result = batchRenameImages(folderPath, prefix);

        if (result.success) {
            configManager.saveConfig({
                ...configManager.readConfig(),
                lastFolder: folderPath,
                lastPrefix: prefix,
            });
            console.log(`序号: ${result.startIndex} 起，${result.padLength} 位`);
            await refreshFolderIfInProject(folderPath);
            result.renames.forEach((line) => console.log(`  ${line}`));
            console.log(`✓ ${result.message}`);
        } else {
            console.warn(`[anim-tools] ${result.message}`);
        }

        return result;
    } catch (error) {
        console.error('[anim-tools] 重命名失败:', error);
        return {
            success: false,
            message: error.message || String(error),
            files: [],
        };
    }
}

async function buildFrameAnimAction(options) {
    const folderPath = options && options.folderPath ? options.folderPath.trim() : '';

    if (!folderPath) {
        return {
            success: false,
            message: '请先选择美术序列帧目录',
        };
    }

    try {
        const result = await buildFrameAnim(folderPath);
        if (result.success) {
            configManager.saveConfig({
                ...configManager.readConfig(),
                lastBuildFolder: folderPath,
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
    openPanel,
    openBuildPanel,
    getConfig,
    setConfig,
    pickFolder,
    batchRename,
    buildFrameAnimAction,
};

exports.load = function () {
    console.log('[anim-tools] 插件已加载');
};

exports.unload = function () {
    console.log('[anim-tools] 插件已卸载');
};
