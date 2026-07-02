/**
 * 功能1：背景图位置检查
 */
'use strict';

const {
    UI_RES_ROOT,
    BG_ROOT,
    BG_TARGET_WIDTH,
    BG_TARGET_HEIGHT,
    BG_SIZE_TOLERANCE,
    isUnderDir,
    isImageFile,
} = require('./pathConfig');
const { readImageSize, isBackgroundSize } = require('./imageSize');
const { walkFiles, hasAutoAtlasInAncestors } = require('./assetScanner');

async function checkBackgroundPlacement() {
    console.log('========== 背景图位置检查 ==========');
    console.log(`扫描目录: ${UI_RES_ROOT}`);
    console.log(`目标尺寸: ${BG_TARGET_WIDTH}x${BG_TARGET_HEIGHT} (±${BG_SIZE_TOLERANCE})`);
    console.log(`正确目录: ${BG_ROOT}/`);

    const imageFiles = walkFiles(UI_RES_ROOT, {
        filter: (_relative, absolute) => isImageFile(absolute),
    });

    if (imageFiles.length === 0) {
        console.log(`[背景图检查] 未找到任何 PNG/JPG 图片，请确认目录 ${UI_RES_ROOT} 是否存在`);
        return { count: 0, items: [] };
    }

    const issues = [];

    for (const file of imageFiles) {
        const size = readImageSize(file.absolutePath);
        if (!size) {
            continue;
        }

        if (!isBackgroundSize(
            size.width,
            size.height,
            BG_TARGET_WIDTH,
            BG_TARGET_HEIGHT,
            BG_SIZE_TOLERANCE
        )) {
            continue;
        }

        const inBgFolder = isUnderDir(file.relativePath, BG_ROOT);
        const inAtlasFolder = hasAutoAtlasInAncestors(file.relativePath);

        if (!inBgFolder || inAtlasFolder) {
            const reasons = [];
            if (!inBgFolder) {
                reasons.push('未放在 bg 目录');
            }
            if (inAtlasFolder) {
                reasons.push('位于 Auto Atlas 图集目录内');
            }

            const item = {
                fileName: file.fileName,
                relativePath: file.relativePath,
                width: size.width,
                height: size.height,
                reasons,
            };
            issues.push(item);

            console.log(`[背景图异常] ${file.fileName}`);
            console.log(`  路径: ${file.relativePath}`);
            console.log(`  尺寸: ${size.width}x${size.height}`);
            console.log(`  原因: ${reasons.join('；')}`);
        }
    }

    console.log('========== 检查完成 ==========');
    if (issues.length === 0) {
        console.log('未发现背景尺寸图片位置异常');
    } else {
        console.log(`共发现 ${issues.length} 张背景尺寸图片位置异常`);
    }

    return { count: issues.length, items: issues };
}

module.exports = {
    checkBackgroundPlacement,
};
