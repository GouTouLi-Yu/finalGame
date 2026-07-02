/**
 * 配置文件管理模块
 */
const fs = require('fs');
const path = require('path');
const { DEFAULT_EXCEL_RELATIVE, normalizeStoredPath } = require('./pathUtil');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../settings.json');
    }

    /**
     * 读取配置（excelLocation 始终为相对项目根目录的路径）
     */
    readConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(content);
                if (parsed && typeof parsed === 'object') {
                    parsed.excelLocation = normalizeStoredPath(parsed.excelLocation);
                    return parsed;
                }
            }
        } catch (error) {
            console.error('读取配置文件失败:', error);
        }
        return {
            excelLocation: DEFAULT_EXCEL_RELATIVE,
        };
    }

    /**
     * 保存配置
     */
    saveConfig(config) {
        try {
            const normalized = {
                ...config,
                excelLocation: normalizeStoredPath(config.excelLocation),
            };
            fs.writeFileSync(this.configPath, JSON.stringify(normalized, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('保存配置文件失败:', error);
            return false;
        }
    }

    /**
     * 获取 Excel 相对路径
     */
    getExcelLocation() {
        const config = this.readConfig();
        return config.excelLocation || DEFAULT_EXCEL_RELATIVE;
    }

    /**
     * 设置 Excel 路径（可传绝对或相对，保存时统一转为相对路径）
     */
    setExcelLocation(location) {
        const config = this.readConfig();
        config.excelLocation = normalizeStoredPath(location);
        return this.saveConfig(config);
    }
}

module.exports = ConfigManager;
