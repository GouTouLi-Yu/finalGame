'use strict';

const fs = require('fs');
const path = require('path');
const { pickEvenlySpacedIndices } = require('./framePicker');
const { TIERS, getTierMode, SHARED_RES_DIR, MARKER_FILE, LEGACY_RES_DIRS } = require('./tierConfig');
const { toRelativePath, toDbUrl } = require('./pathUtil');
const { listImageFiles } = require('../../anim-tools/lib/batchRename');
const { buildAnimClipJson } = require('../../anim-tools/lib/buildAnimClip');
const {
    createAsset,
    refreshAsset,
    removeFolderCompletely,
    waitForSpriteFrameMetas,
    queryUuid,
    deleteAssetByUrl,
} = require('../../anim-tools/lib/assetDbHelper');
const { patchAnimPrefab } = require('./prefabPatcher');

function isAnimFolder(absolutePath) {
    if (!fs.existsSync(absolutePath)) {
        return false;
    }
    const resDir = path.join(absolutePath, 'res');
    const clipPath = path.join(absolutePath, 'animClip.anim');
    const prefabPath = path.join(absolutePath, 'anim.prefab');
    return fs.existsSync(resDir)
        && fs.statSync(resDir).isDirectory()
        && fs.existsSync(clipPath)
        && fs.existsSync(prefabPath)
        && listImageFiles(resDir).length > 0;
}

async function removeLegacyTierFolders(animAbs, animDb) {
    for (const dirName of LEGACY_RES_DIRS) {
        const abs = path.join(animAbs, dirName);
        if (fs.existsSync(abs)) {
            await removeFolderCompletely(abs, `${animDb}/${dirName}`);
            console.log(`[anim-quality-tools] 已清理旧版完整模式目录: ${dirName}/`);
        }
    }
}

async function loadSpriteFrameUuids(sourceResAbs, pngNames) {
    const pngPaths = pngNames.map((name) => path.join(sourceResAbs, name));
    const spriteInfoMap = await waitForSpriteFrameMetas(pngPaths);
    return pngPaths.map((filePath) => spriteInfoMap.get(filePath).uuid);
}

function readSourceClipSample(animAbs) {
    const clipPath = path.join(animAbs, `${TIERS.high.clipName}.anim`);
    try {
        const root = JSON.parse(fs.readFileSync(clipPath, 'utf-8'))[0];
        const sample = root?.sample;
        if (typeof sample === 'number' && sample > 0) {
            return sample;
        }
    } catch (error) {
        console.warn(`[anim-quality-tools] 读取 ${TIERS.high.clipName}.anim 采样率失败，使用默认 30`, error.message || error);
    }
    return require('../../anim-tools/lib/buildAnimClip').SAMPLE;
}

function scaleSampleForSubset(sourceSample, sourceFrameCount, subsetFrameCount) {
    if (sourceFrameCount <= 0 || subsetFrameCount <= 0) {
        return sourceSample;
    }
    return sourceSample * subsetFrameCount / sourceFrameCount;
}

async function buildSubsetClip(animDb, clipName, spriteFrameUuids, sourceSample, sourceFrameCount) {
    const sample = scaleSampleForSubset(sourceSample, sourceFrameCount, spriteFrameUuids.length);
    const clipDb = `${animDb}/${clipName}.anim`;
    await deleteAssetByUrl(clipDb);
    await createAsset(clipDb, buildAnimClipJson(spriteFrameUuids, { clipName, sample }));
    const clipUuid = await queryUuid(clipDb);
    if (!clipUuid) {
        throw new Error(`${clipName}.anim 创建失败`);
    }
    return { clipUuid, sample };
}

async function removeLowTierClip(animDb) {
    await deleteAssetByUrl(`${animDb}/${TIERS.low.clipName}.anim`);
}

function writeMarkerFile(animAbs, summary) {
    const tierMode = getTierMode(summary.tierMode);
    const marker = {
        version: 3,
        mode: 'clip-only',
        tierMode: tierMode.id,
        sharedResDir: SHARED_RES_DIR,
        sample: summary.sample,
        tiers: {},
    };

    for (const key of tierMode.tierKeys) {
        const tier = TIERS[key];
        const tierSummary = summary[key];
        marker.tiers[key] = {
            clip: tier.clipName,
            frameCount: tierSummary.frameCount,
            keepRatio: tier.keepRatio,
            sample: tierSummary.sample,
        };
    }

    fs.writeFileSync(
        path.join(animAbs, MARKER_FILE),
        `${JSON.stringify(marker, null, 2)}\n`,
        'utf-8',
    );
}

async function buildQualityTiersForAnim(animAbs, tierMode = 'three') {
    const mode = getTierMode(tierMode);
    if (!isAnimFolder(animAbs)) {
        throw new Error('不是有效的帧动画目录（需包含 res/、animClip.anim、anim.prefab）');
    }

    const relPath = toRelativePath(animAbs);
    const animDb = toDbUrl(relPath);
    const sourceResAbs = path.join(animAbs, SHARED_RES_DIR);
    const pngNames = listImageFiles(sourceResAbs);

    console.log(`[anim-quality-tools] ${mode.label}模式: ${relPath}（${pngNames.length} 帧，共用 res/ 图集）`);

    await removeLegacyTierFolders(animAbs, animDb);

    const allUuids = await loadSpriteFrameUuids(sourceResAbs, pngNames);

    const highClipUuid = await queryUuid(`${animDb}/${TIERS.high.clipName}.anim`);
    if (!highClipUuid) {
        throw new Error('animClip.anim 不存在，请先制作全帧动画');
    }

    const sourceFrameCount = pngNames.length;
    const sourceSample = readSourceClipSample(animAbs);
    console.log(`[anim-quality-tools] ${TIERS.high.clipName}.anim 采样率: ${sourceSample}（${sourceFrameCount} 帧）`);

    await patchAnimPrefab(animAbs, animDb, { highClipUuid });

    const midIndices = pickEvenlySpacedIndices(sourceFrameCount, TIERS.mid.keepRatio);
    const midUuids = midIndices.map((index) => allUuids[index]);
    const midClip = await buildSubsetClip(animDb, TIERS.mid.clipName, midUuids, sourceSample, sourceFrameCount);

    let lowClip = null;
    let lowFrameCount = 0;
    if (mode.id === 'three') {
        const lowIndices = pickEvenlySpacedIndices(sourceFrameCount, TIERS.low.keepRatio);
        lowFrameCount = lowIndices.length;
        const lowUuids = lowIndices.map((index) => allUuids[index]);
        lowClip = await buildSubsetClip(animDb, TIERS.low.clipName, lowUuids, sourceSample, sourceFrameCount);
        console.log(
            `[anim-quality-tools] 等比采样率: 中 ${midClip.sample.toFixed(4)}（${midIndices.length} 帧）`
            + ` / 低 ${lowClip.sample.toFixed(4)}（${lowFrameCount} 帧）`,
        );
    } else {
        await removeLowTierClip(animDb);
        console.log(
            `[anim-quality-tools] 等比采样率: 中 ${midClip.sample.toFixed(4)}（${midIndices.length} 帧）`
            + '；低档 clip 已移除（运行时低画质回落到中档）',
        );
    }

    await patchAnimPrefab(animAbs, animDb, {
        highClipUuid,
        midClipUuid: midClip.clipUuid,
        lowClipUuid: lowClip?.clipUuid,
    });

    const summary = {
        tierMode: mode.id,
        sample: sourceSample,
        high: { frameCount: sourceFrameCount, sample: sourceSample },
        mid: { frameCount: midIndices.length, sample: midClip.sample },
        low: lowClip
            ? { frameCount: lowFrameCount, sample: lowClip.sample }
            : { frameCount: 0, sample: 0 },
    };
    writeMarkerFile(animAbs, summary);
    await refreshAsset(animDb);

    return {
        relPath,
        tierMode: mode.id,
        sourceFrames: pngNames.length,
        highFrames: summary.high.frameCount,
        midFrames: summary.mid.frameCount,
        lowFrames: summary.low.frameCount,
    };
}

async function buildQualityTiersForSelection(assetInfos, tierMode = 'three') {
    const animFolders = [];
    for (const info of assetInfos) {
        if (!info || !info.file) {
            continue;
        }
        const abs = path.normalize(info.file);
        if (info.isDirectory) {
            if (isAnimFolder(abs)) {
                animFolders.push(abs);
                continue;
            }
            walkAnimFolders(abs, animFolders);
            continue;
        }
        const parent = path.dirname(abs);
        if (isAnimFolder(parent) && !animFolders.includes(parent)) {
            animFolders.push(parent);
        }
    }

    if (animFolders.length === 0) {
        throw new Error('请选中帧动画目录（含 res/ + animClip.anim + anim.prefab），或选中其中任意文件');
    }

    const results = [];
    for (const animAbs of animFolders) {
        results.push(await buildQualityTiersForAnim(animAbs, tierMode));
    }
    return results;
}

function walkAnimFolders(rootAbs, bucket) {
    if (!fs.existsSync(rootAbs)) {
        return;
    }
    if (isAnimFolder(rootAbs)) {
        bucket.push(rootAbs);
        return;
    }
    for (const name of fs.readdirSync(rootAbs)) {
        const child = path.join(rootAbs, name);
        if (fs.statSync(child).isDirectory()) {
            walkAnimFolders(child, bucket);
        }
    }
}

module.exports = {
    isAnimFolder,
    buildQualityTiersForAnim,
    buildQualityTiersForSelection,
};
