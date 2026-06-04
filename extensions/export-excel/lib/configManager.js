/**
 * 配置文件管理模块
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_EXCEL_LOCATION = 'D:\\finalGame\\reslgy\\data\\trunk';

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../settings.json');
    }

    /**
     * 读取配置
     */
    readConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(content);
                if (parsed && typeof parsed === 'object') {
                    if (!parsed.excelLocation) {
                        parsed.excelLocation = DEFAULT_EXCEL_LOCATION;
                    }
                    return parsed;
                }
            }
        } catch (error) {
            console.error('读取配置文件失败:', error);
        }
        // 返回默认配置
        return {
            excelLocation: DEFAULT_EXCEL_LOCATION
        };
    }

    /**
     * 保存配置
     */
    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('保存配置文件失败:', error);
            return false;
        }
    }

    /**
     * 获取Excel路径
     */
    getExcelLocation() {
        const config = this.readConfig();
        return config.excelLocation || DEFAULT_EXCEL_LOCATION;
    }

    /**
     * 设置Excel路径
     */
    setExcelLocation(location) {
        const config = this.readConfig();
        config.excelLocation = location;
        return this.saveConfig(config);
    }
}

module.exports = ConfigManager;

