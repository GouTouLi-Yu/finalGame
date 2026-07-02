/**
 * 功能2：跨模块静态引用资源移到 common/res
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
    UI_RES_ROOT,
    COMMON_RES_ROOT,
    EXCLUDED_UI_ASSET_ROOT,
    toAbsolutePath,
    toDbUrl,
    isUnderDir,
    isImageFile,
} = require('./pathConfig');
const {
    walkFiles,
    buildImageUuidIndex,
    listUiresModuleFolders,
    getModuleResRoot,
    findCrossModuleImageViolations,
} = require('./assetScanner');

function isMovableImage(relativePath) {
    if (!isUnderDir(relativePath, UI_RES_ROOT)) {
        return false;
    }
    if (isUnderDir(relativePath, COMMON_RES_ROOT)) {
        return false;
    }
    if (isUnderDir(relativePath, EXCLUDED_UI_ASSET_ROOT)) {
        return false;
    }
    return true;
}

function getImageModuleLabel(relativePath) {
    const prefix = `${UI_RES_ROOT}/`;
    if (!relativePath.startsWith(prefix)) {
        return 'unknown';
    }
    const rest = relativePath.slice(prefix.length);
    return rest.split('/')[0] || 'unknown';
}

async function moveAssetByDb(srcRelativePath, destRelativePath) {
    const srcUrl = toDbUrl(srcRelativePath);
    const destUrl = toDbUrl(destRelativePath);
    await Editor.Message.request('asset-db', 'move-asset', srcUrl, destUrl);
}

async function refreshAssets(relativeDirs) {
    for (const dir of relativeDirs) {
        try {
            await Editor.Message.request('asset-db', 'refresh-asset', toDbUrl(dir));
        } catch (error) {
            console.warn(`[跨模块移动] 刷新目录失败: ${dir}`, error.message || error);
        }
    }
}

async function moveSharedToCommon() {
    console.log('========== 跨模块资源移到 common ==========');
    console.log(`资源根目录: ${UI_RES_ROOT}`);
    console.log(`目标目录: ${COMMON_RES_ROOT}`);
    console.log('判定规则:');
    console.log('  1. 取 prefab 父文件夹名作为玩法模块（如 MainMenu -> mainMenu）');
    console.log('  2. 该 prefab 静态引用的 uires 图片，只允许来自：');
    console.log('     - assets/res/uires/{模块名}/res/');
    console.log('     - assets/res/uires/common/res/');
    console.log('     - assets/res/uires/bg/');
    console.log('  3. 引用其他玩法 res 目录下的图片 -> 剪切到 common/res/');

    const moduleFolders = listUiresModuleFolders();
    if (moduleFolders.length === 0) {
        console.log(`[跨模块移动] 未找到玩法模块目录，请确认 ${UI_RES_ROOT} 是否存在`);
        return { moved: [], skipped: [], failed: [] };
    }
    console.log(`已识别玩法模块: ${moduleFolders.join(', ')}`);

    const imageFiles = walkFiles(UI_RES_ROOT, {
        filter: (relative, absolute) => isMovableImage(relative) && isImageFile(absolute),
    });

    if (imageFiles.length === 0) {
        console.log(`[跨模块移动] 未找到可处理的图片，请确认 ${UI_RES_ROOT} 是否存在`);
        return { moved: [], skipped: [], failed: [] };
    }

    const { uuidToImage } = buildImageUuidIndex(imageFiles);
    const violations = findCrossModuleImageViolations(uuidToImage, moduleFolders);

    if (violations.length === 0) {
        console.log('[跨模块移动] 未发现跨模块静态引用');
        return { moved: [], skipped: [], failed: [] };
    }

    console.log(`[跨模块移动] 发现 ${violations.length} 张跨模块引用图片`);

    const moved = [];
    const skipped = [];
    const failed = [];
    const refreshDirs = new Set([UI_RES_ROOT, COMMON_RES_ROOT]);

    for (const violation of violations) {
        const image = violation.image;
        const destRelativePath = `${COMMON_RES_ROOT}/${image.fileName}`;
        const destAbsolutePath = toAbsolutePath(destRelativePath);
        const imageModule = getImageModuleLabel(image.relativePath);

        console.log(`[候选] ${image.fileName}`);
        console.log(`  原路径: ${image.relativePath}`);
        console.log(`  当前所在模块: ${imageModule}`);
        violation.references.forEach((ref) => {
            console.log(`  违规引用 prefab: ${ref.prefabPath}`);
            console.log(`    prefab 模块: ${ref.prefabModule} (允许目录: ${getModuleResRoot(ref.prefabModule)})`);
        });

        if (fs.existsSync(destAbsolutePath)) {
            const message = `目标已存在同名文件，跳过: ${destRelativePath}`;
            skipped.push({
                fileName: image.fileName,
                from: image.relativePath,
                to: destRelativePath,
                reason: message,
            });
            console.warn(`[跳过] ${message}`);
            continue;
        }

        try {
            await moveAssetByDb(image.relativePath, destRelativePath);
            moved.push({
                fileName: image.fileName,
                from: image.relativePath,
                to: destRelativePath,
                imageModule,
                references: violation.references,
            });

            refreshDirs.add(path.posix.dirname(image.relativePath));
            refreshDirs.add(COMMON_RES_ROOT);

            console.log(`[已移动] ${image.fileName}`);
            console.log(`  ${image.relativePath} -> ${destRelativePath}`);
        } catch (error) {
            const message = error.message || String(error);
            failed.push({
                fileName: image.fileName,
                from: image.relativePath,
                to: destRelativePath,
                reason: message,
            });
            console.error(`[失败] ${image.fileName}: ${message}`);
        }
    }

    await refreshAssets(Array.from(refreshDirs));

    console.log('========== 移动完成 ==========');
    console.log(`成功: ${moved.length}，跳过: ${skipped.length}，失败: ${failed.length}`);
    moved.forEach((item) => {
        console.log(`  ${item.fileName}: ${item.from} -> ${item.to}`);
    });

    return { moved, skipped, failed };
}

module.exports = {
    moveSharedToCommon,
};
