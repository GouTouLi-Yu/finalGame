/**
 * 图片资源路径常量（相对项目根目录）
 */
'use strict';

const path = require('path');

const UI_RES_ROOT = 'assets/res/uires';
const BG_ROOT = 'assets/res/uires/bg';
const COMMON_RES_ROOT = 'assets/res/uires/common/res';
const EXCLUDED_UI_ASSET_ROOT = 'assets/res/ui/asset';

const BG_TARGET_WIDTH = 2560;
const BG_TARGET_HEIGHT = 1440;
const BG_SIZE_TOLERANCE = 20;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function getProjectRoot() {
    return Editor.Project.path;
}

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function toAbsolutePath(relativePath) {
    return path.normalize(path.join(getProjectRoot(), relativePath));
}

function toRelativePath(absolutePath) {
    return toPosixPath(path.relative(getProjectRoot(), absolutePath));
}

function toDbUrl(relativePath) {
    return `db://${toPosixPath(relativePath)}`;
}

function isUnderDir(fileRelativePath, dirRelativePath) {
    const normalizedFile = toPosixPath(fileRelativePath);
    const normalizedDir = toPosixPath(dirRelativePath);
    return normalizedFile === normalizedDir
        || normalizedFile.startsWith(`${normalizedDir}/`);
}

function isImageFile(fileName) {
    return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

module.exports = {
    UI_RES_ROOT,
    BG_ROOT,
    COMMON_RES_ROOT,
    EXCLUDED_UI_ASSET_ROOT,
    BG_TARGET_WIDTH,
    BG_TARGET_HEIGHT,
    BG_SIZE_TOLERANCE,
    IMAGE_EXTENSIONS,
    getProjectRoot,
    toPosixPath,
    toAbsolutePath,
    toRelativePath,
    toDbUrl,
    isUnderDir,
    isImageFile,
};
