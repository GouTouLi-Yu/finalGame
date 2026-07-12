/**
 * 配置文件管理
 * - settings.json：团队默认 Excel 路径（可提交）
 * - settings.local.json：本机覆盖路径（gitignore）
 */
const fs = require('fs');
const path = require('path');
const { DEFAULT_EXCEL_RELATIVE, normalizeStoredPath } = require('./pathUtil');

function readJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.error('[export-excel] 读取配置失败:', filePath, error);
        return null;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../settings.json');
        this.localConfigPath = path.join(__dirname, '../settings.local.json');
    }

    /**
     * 读取配置（excelLocation 为相对项目根目录的路径）
     * 优先级：settings.local.json > settings.json > 代码默认
     */
    readConfig() {
        const shared = readJson(this.configPath) || {};
        const local = readJson(this.localConfigPath) || {};
        const excelLocation = normalizeStoredPath(
            local.excelLocation || shared.excelLocation || DEFAULT_EXCEL_RELATIVE,
        );
        return { excelLocation };
    }

    /**
     * 保存本机覆盖（不改团队 settings.json）
     */
    saveConfig(config) {
        try {
            const excelLocation = normalizeStoredPath(
                (config && config.excelLocation) || DEFAULT_EXCEL_RELATIVE,
            );
            writeJson(this.localConfigPath, { excelLocation });
            return true;
        } catch (error) {
            console.error('[export-excel] 保存本机配置失败:', error);
            return false;
        }
    }

    getExcelLocation() {
        const config = this.readConfig();
        return config.excelLocation || DEFAULT_EXCEL_RELATIVE;
    }

    setExcelLocation(location) {
        return this.saveConfig({
            excelLocation: normalizeStoredPath(location),
        });
    }
}

module.exports = ConfigManager;
