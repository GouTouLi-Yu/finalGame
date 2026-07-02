/**
 * 一键取消所有图集压缩纹理
 */
'use strict';

const fs = require('fs');
const { walkFiles, readJsonSafe } = require('./assetScanner');
const { toDbUrl, toPosixPath } = require('./pathConfig');

const SCAN_ROOTS = [
    'assets/res/anim',
    'assets/res/uires',
];

function isAutoAtlasMeta(meta) {
    return meta && meta.importer === 'auto-atlas';
}

function collectAutoAtlasMetaFiles() {
    const results = [];
    for (const root of SCAN_ROOTS) {
        const files = walkFiles(root, {
            filter: (_relative, absolute) => absolute.endsWith('.pac.meta'),
        });
        results.push(...files);
    }
    return results;
}

function disableCompressTexture(meta) {
    if (!meta.userData) {
        meta.userData = {};
    }
    if (!meta.userData.compressSettings) {
        meta.userData.compressSettings = {};
    }

    const alreadyDisabled = meta.userData.compressSettings.useCompressTexture === false;
    meta.userData.compressSettings.useCompressTexture = false;
    return !alreadyDisabled;
}

async function refreshAtlasAsset(relativePath) {
    const pacRelative = relativePath.replace(/\.meta$/, '');
    const dbUrl = toDbUrl(pacRelative);
    try {
        await Editor.Message.request('asset-db', 'refresh-asset', dbUrl);
    } catch (error) {
        console.warn(`[image-tools] 刷新图集失败: ${pacRelative}`, error.message || error);
    }
}

async function disableAllAtlasCompressTexture() {
    console.log('========== 一键取消所有图集压缩纹理 ==========');
    console.log(`扫描目录: ${SCAN_ROOTS.join(', ')}`);

    const metaFiles = collectAutoAtlasMetaFiles();
    if (metaFiles.length === 0) {
        console.log('[图集压缩] 未找到任何 auto-atlas 图集');
        return {
            scanned: 0,
            updated: 0,
            skipped: 0,
            files: [],
        };
    }

    let updated = 0;
    let skipped = 0;
    const updatedFiles = [];

    for (const file of metaFiles) {
        const meta = readJsonSafe(file.absolutePath);
        if (!isAutoAtlasMeta(meta)) {
            skipped += 1;
            continue;
        }

        const changed = disableCompressTexture(meta);
        if (!changed) {
            skipped += 1;
            console.log(`  跳过（已是未压缩）: ${toPosixPath(file.relativePath.replace(/\.meta$/, ''))}`);
            continue;
        }

        fs.writeFileSync(file.absolutePath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8');
        await refreshAtlasAsset(file.relativePath);
        updated += 1;
        updatedFiles.push(toPosixPath(file.relativePath.replace(/\.meta$/, '')));
        console.log(`  ✓ 已取消压缩: ${updatedFiles[updatedFiles.length - 1]}`);
    }

    console.log('========== 处理完成 ==========');
    console.log(`扫描图集: ${metaFiles.length} 个，更新: ${updated} 个，跳过: ${skipped} 个`);

    return {
        scanned: metaFiles.length,
        updated,
        skipped,
        files: updatedFiles,
    };
}

module.exports = {
    disableAllAtlasCompressTexture,
    SCAN_ROOTS,
};
