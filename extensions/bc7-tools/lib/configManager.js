/**
 * BC7 工具配置
 */
'use strict';

const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../settings.json');
    }

    readConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
        } catch (error) {
            console.error('[bc7-tools] 读取配置失败:', error);
        }
        return {
            texconvPath: '',
            defaultArtFolder: '../reslgy/美术',
            lastFolder: '',
        };
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
            return true;
        } catch (error) {
            console.error('[bc7-tools] 保存配置失败:', error);
            return false;
        }
    }
}

module.exports = ConfigManager;
