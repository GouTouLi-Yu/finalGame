/**
 * 路径工具：配置中统一使用相对项目根目录的路径
 */
const path = require('path');

/** 相对项目根目录的默认 Excel 目录 */
const DEFAULT_EXCEL_RELATIVE = '../reslgy/data/trunk';

function getProjectRoot() {
    return Editor.Project.path;
}

/**
 * 将配置中的路径解析为绝对路径（支持相对/绝对，兼容旧配置）
 */
function resolveExcelLocation(storedPath) {
    const value = (storedPath || DEFAULT_EXCEL_RELATIVE).trim();
    if (!value) {
        return path.normalize(path.join(getProjectRoot(), DEFAULT_EXCEL_RELATIVE));
    }
    if (path.isAbsolute(value)) {
        return path.normalize(value);
    }
    return path.normalize(path.join(getProjectRoot(), value));
}

/**
 * 将绝对路径转为相对项目根目录的路径，写入 settings.json
 */
function toStoredPath(absolutePath) {
    if (!absolutePath) {
        return DEFAULT_EXCEL_RELATIVE;
    }
    const projectRoot = getProjectRoot();
    const resolved = path.normalize(path.resolve(absolutePath));
    const relative = path.relative(projectRoot, resolved);
    return relative.split(path.sep).join('/');
}

/**
 * 若配置仍是绝对路径，自动转为相对路径
 */
function normalizeStoredPath(storedPath) {
    if (!storedPath || !path.isAbsolute(storedPath.trim())) {
        return storedPath || DEFAULT_EXCEL_RELATIVE;
    }
    return toStoredPath(storedPath);
}

module.exports = {
    DEFAULT_EXCEL_RELATIVE,
    getProjectRoot,
    resolveExcelLocation,
    toStoredPath,
    normalizeStoredPath,
};
