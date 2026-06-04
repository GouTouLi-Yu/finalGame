/**
 * 文件改动检测模块
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileWatcher {
    constructor() {
        this.cachePath = path.join(__dirname, '../cache/fileCache.json');
        this.cache = this.loadCache();
    }

    loadCache() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const content = fs.readFileSync(this.cachePath, 'utf-8');
                const parsed = JSON.parse(content);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (error) {
            console.error('加载缓存失败:', error);
        }
        return { excelFiles: {}, jsonFiles: {} };
    }

    saveCache() {
        try {
            const dir = path.dirname(this.cachePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('保存缓存失败:', error);
            return false;
        }
    }

    calculateHash(filePath) {
        try {
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
            console.error('计算文件哈希失败:', error);
            return null;
        }
    }

    getFileMtime(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.mtime.getTime();
        } catch (error) {
            console.error('获取文件修改时间失败:', error);
            return 0;
        }
    }

    checkExcelChanged(filePath) {
        if (!fs.existsSync(filePath)) return { changed: false, reason: '文件不存在' };
        const mtime = this.getFileMtime(filePath);
        const hash = this.calculateHash(filePath);
        const cached = this.cache.excelFiles[filePath];
        if (!cached) return { changed: true, reason: '新文件' };
        if (cached.mtime !== mtime || cached.hash !== hash) return { changed: true, reason: '文件已修改' };
        return { changed: false, reason: '未改动' };
    }

    updateExcelCache(filePath, tableName) {
        const mtime = this.getFileMtime(filePath);
        const hash = this.calculateHash(filePath);
        this.cache.excelFiles[filePath] = { mtime, hash, tableName };
        this.saveCache();
    }

    updateJsonCache(jsonPath, tableNames) {
        const mtime = this.getFileMtime(jsonPath);
        const hash = this.calculateHash(jsonPath);
        this.cache.jsonFiles[jsonPath] = { mtime, hash, tableNames };
        this.saveCache();
    }

    getAllExcelFiles(excelLocation) {
        const files = [];
        try {
            if (!fs.existsSync(excelLocation)) return files;
            const items = fs.readdirSync(excelLocation);
            for (const item of items) {
                // Excel 打开时会生成 ~$.xlsx 之类的临时文件，直接忽略
                if (item.startsWith('~$')) {
                    continue;
                }
                const fullPath = path.join(excelLocation, item);
                const stats = fs.statSync(fullPath);
                if (stats.isFile() && (item.endsWith('.xlsx') || item.endsWith('.xls'))) {
                    files.push(fullPath);
                } else if (stats.isDirectory()) {
                    files.push(...this.getAllExcelFiles(fullPath));
                }
            }
        } catch (error) {
            console.error('读取Excel文件列表失败:', error);
        }
        return files;
    }

    detectChangedFiles(excelLocation) {
        const changedFiles = [];
        const allFiles = this.getAllExcelFiles(excelLocation);
        for (const filePath of allFiles) {
            const result = this.checkExcelChanged(filePath);
            if (result.changed) changedFiles.push(filePath);
        }
        return changedFiles;
    }
}

module.exports = FileWatcher;

