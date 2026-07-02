/**
 * 从 plugins.json 同步 menu 到 package.json
 *
 * Cocos 菜单规则（避免重复层级）：
 * - path 只写到分类目录，如 "ts插件/excel"
 * - label 是最终菜单项名称，如 "一键导表"
 * - 不要把 label 再写进 path 最后一级
 *
 * 新增插件：只改 plugins.json，然后运行 npm run sync-menu
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PLUGINS_JSON = path.join(ROOT, 'plugins.json');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

function toMethodName(message) {
    const parts = message.split('-');
    return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function buildMenuPath(category) {
    return `ts插件/${category}`;
}

function syncMenu() {
    const pluginsConfig = JSON.parse(fs.readFileSync(PLUGINS_JSON, 'utf-8'));
    const plugins = Array.isArray(pluginsConfig.plugins) ? pluginsConfig.plugins : [];
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));

    const menu = [];
    const messages = {
        'run-plugin': {
            methods: ['runPlugin'],
        },
    };

    for (const plugin of plugins) {
        if (!plugin.id || !plugin.category || !plugin.label) {
            throw new Error(`插件配置不完整: ${JSON.stringify(plugin)}`);
        }

        const message = `run-${plugin.id}`;
        const method = toMethodName(message);

        menu.push({
            path: buildMenuPath(plugin.category),
            label: plugin.label,
            message,
        });

        messages[message] = {
            methods: [method],
        };
    }

    packageJson.contributions = packageJson.contributions || {};
    packageJson.contributions.menu = menu;
    packageJson.contributions.messages = messages;

    fs.writeFileSync(PACKAGE_JSON, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8');

    console.log('[ts-plugins] 菜单已同步:');
    for (const item of menu) {
        console.log(`  ${item.path} -> ${item.label}`);
    }
}

syncMenu();
