/**
 * TS 插件中心 - 主进程入口
 *
 * 菜单配置流程：
 * 1. 在 plugins.json 添加插件（id / category / label / extension / message）
 * 2. 运行 npm run sync-menu 同步 package.json 菜单
 * 3. 重新加载 ts-plugins 扩展
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PLUGINS_CONFIG_PATH = path.join(__dirname, 'plugins.json');

function readPluginsConfig() {
    try {
        const raw = fs.readFileSync(PLUGINS_CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);
        return Array.isArray(config.plugins) ? config.plugins : [];
    } catch (error) {
        console.error('[ts-plugins] 读取 plugins.json 失败:', error);
        return [];
    }
}

async function invokePlugin(plugin) {
    if (!plugin || !plugin.extension) {
        throw new Error('插件配置无效');
    }

    if (plugin.openPanel) {
        await Editor.Panel.open(plugin.openPanel);
        return;
    }

    if (!plugin.message) {
        throw new Error(`插件 ${plugin.label || plugin.id} 未配置 message`);
    }

    await Editor.Message.request(plugin.extension, plugin.message);
}

function findPlugin(pluginId) {
    return readPluginsConfig().find((item) => item.id === pluginId) || null;
}

async function runPlugin(event, pluginId) {
    let id = pluginId;
    if (typeof event === 'string' && id === undefined) {
        id = event;
        event = null;
    }

    const plugin = findPlugin(id);
    if (!plugin) {
        const message = `未找到插件: ${id}`;
        console.error('[ts-plugins]', message);
        if (event && typeof event.reply === 'function') {
            event.reply(new Error(message));
            return;
        }
        await Editor.Dialog.warn('插件不存在', message);
        return false;
    }

    try {
        console.log(`[ts-plugins] 运行插件: ${plugin.label} (${plugin.extension})`);
        await invokePlugin(plugin);
        if (event && typeof event.reply === 'function') {
            event.reply(null, true);
        }
        return true;
    } catch (error) {
        console.error(`[ts-plugins] 插件执行失败: ${plugin.label}`, error);
        if (event && typeof event.reply === 'function') {
            event.reply(error);
            return;
        }
        await Editor.Dialog.error('插件执行失败', error.message || String(error));
        return false;
    }
}

function toMethodName(message) {
    const parts = message.split('-');
    return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function buildMethods() {
    const methods = {
        runPlugin,
    };

    for (const plugin of readPluginsConfig()) {
        const message = `run-${plugin.id}`;
        const methodName = toMethodName(message);
        methods[methodName] = () => runPlugin(null, plugin.id);
    }

    return methods;
}

exports.methods = buildMethods();

exports.load = function () {
    const plugins = readPluginsConfig();
    console.log('[ts-plugins] 插件中心已加载');
    plugins.forEach((plugin) => {
        console.log(`  [${plugin.category}] ${plugin.label} -> ${plugin.extension}/${plugin.message}`);
    });
};

exports.unload = function () {
    console.log('[ts-plugins] 插件中心已卸载');
};
