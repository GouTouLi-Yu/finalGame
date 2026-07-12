/**
 * 动画工具配置
 * - settings.json：团队共享默认（可提交）
 * - settings.local.json：本机状态（gitignore，不影响他人）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SHARED_DEFAULTS = {
    defaultAnimFolder: '../reslgy/美术/anim',
};

const LOCAL_DEFAULTS = {
    lastFolder: '',
    lastPrefix: 'anim_chac_liYin_idle',
    lastBuildFolder: '',
    lastBuildScale: 1,
};

const SHARED_KEYS = Object.keys(SHARED_DEFAULTS);
const LOCAL_KEYS = Object.keys(LOCAL_DEFAULTS);

function readJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.error('[anim-tools] 读取配置失败:', filePath, error);
        return null;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function pickKeys(source, keys) {
    const out = {};
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            out[key] = source[key];
        }
    }
    return out;
}

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../settings.json');
        this.localConfigPath = path.join(__dirname, '../settings.local.json');
    }

    readConfig() {
        const shared = readJson(this.configPath) || {};
        const local = readJson(this.localConfigPath) || {};
        // 兼容旧版：曾把本机字段写在 settings.json 里
        return {
            ...SHARED_DEFAULTS,
            ...LOCAL_DEFAULTS,
            ...pickKeys(shared, SHARED_KEYS),
            ...pickKeys(shared, LOCAL_KEYS),
            ...pickKeys(local, LOCAL_KEYS),
        };
    }

    saveConfig(config) {
        try {
            const current = this.readConfig();
            const merged = { ...current, ...(config || {}) };

            const sharedOut = {
                ...SHARED_DEFAULTS,
                ...pickKeys(merged, SHARED_KEYS),
            };
            writeJson(this.configPath, sharedOut);

            const localOut = {
                ...LOCAL_DEFAULTS,
                ...pickKeys(merged, LOCAL_KEYS),
            };
            writeJson(this.localConfigPath, localOut);
            return true;
        } catch (error) {
            console.error('[anim-tools] 保存配置失败:', error);
            return false;
        }
    }
}

module.exports = ConfigManager;
