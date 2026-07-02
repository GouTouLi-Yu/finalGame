/**
 * 一键制作帧动画
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveTargetFromSource, toDbUrl } = require('./animPathUtil');
const {
    removeFolderCompletely,
    ensureFolder,
    createAsset,
    refreshAsset,
    waitForSpriteFrameMetas,
    queryUuid,
} = require('./assetDbHelper');
const { listImageFiles } = require('./batchRename');
const { buildAnimClipJson } = require('./buildAnimClip');
const { buildAnimPrefabJson } = require('./buildAnimPrefab');
const { buildAutoAtlasMeta } = require('./autoAtlasMeta');

const AUTO_ATLAS_PAC = '{\n    "__type__": "cc.SpriteAtlas"\n}\n';

async function buildFrameAnim(sourceFolder) {
    const mapping = resolveTargetFromSource(sourceFolder);
    const { sourceAbs, targetAbs, targetDb, relAfterAnim } = mapping;
    const resAbs = path.join(targetAbs, 'res');
    const resDb = `${targetDb}/res`;

    console.log('========== 一键制作帧动画 ==========');
    console.log(`源目录: ${sourceAbs}`);
    console.log(`目标目录: ${targetAbs}`);

    const imageNames = listImageFiles(sourceAbs);
    if (imageNames.length === 0) {
        return {
            success: false,
            message: '源文件夹中没有找到 PNG/JPG/JPEG/WebP 图片',
        };
    }

    await removeFolderCompletely(targetAbs, targetDb);
    await ensureFolder(resAbs);

    const copiedPaths = [];
    for (const name of imageNames) {
        const dest = path.join(resAbs, name);
        fs.copyFileSync(path.join(sourceAbs, name), dest);
        copiedPaths.push(dest);
    }
    console.log(`已复制 ${copiedPaths.length} 张图片到 res/`);

    await createAsset(`${resDb}/auto-atlas.pac`, AUTO_ATLAS_PAC);
    const atlasUuid = await queryUuid(`${resDb}/auto-atlas.pac`);
    if (atlasUuid) {
        const atlasMetaPath = path.join(resAbs, 'auto-atlas.pac.meta');
        fs.writeFileSync(atlasMetaPath, `${JSON.stringify(buildAutoAtlasMeta(atlasUuid), null, 2)}\n`, 'utf-8');
        await refreshAsset(`${resDb}/auto-atlas.pac`);
    }
    console.log('已创建 auto-atlas.pac (4096×4096)');

    await refreshAsset(resDb);
    const spriteInfoMap = await waitForSpriteFrameMetas(copiedPaths);
    const spriteFrameUuids = copiedPaths.map((filePath) => spriteInfoMap.get(filePath).uuid);
    const firstFrameInfo = spriteInfoMap.get(copiedPaths[0]);
    console.log(`图片 meta 就绪，共 ${spriteFrameUuids.length} 帧`);

    const clipDb = `${targetDb}/animClip.anim`;
    const clipJson = buildAnimClipJson(spriteFrameUuids);
    await createAsset(clipDb, clipJson);
    const clipUuid = await queryUuid(clipDb);
    if (!clipUuid) {
        throw new Error('animClip.anim 创建失败，未获取到 UUID');
    }
    console.log(`已创建 animClip.anim (${clipUuid})`);

    const prefabDb = `${targetDb}/anim.prefab`;
    const prefabJson = buildAnimPrefabJson(firstFrameInfo.uuid, clipUuid, firstFrameInfo);
    await createAsset(prefabDb, prefabJson);
    console.log('已创建 anim.prefab');

    await refreshAsset(targetDb);

    return {
        success: true,
        message: `帧动画制作完成：${relAfterAnim}（${spriteFrameUuids.length} 帧）`,
        targetAbs,
        targetDb,
        frameCount: spriteFrameUuids.length,
        files: [
            `${targetDb}/res/`,
            `${targetDb}/res/auto-atlas.pac`,
            clipDb,
            prefabDb,
        ],
    };
}

module.exports = {
    buildFrameAnim,
};
