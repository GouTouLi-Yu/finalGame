/**
 * asset-db 辅助方法
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { toDbUrl } = require('./animPathUtil');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryUuid(dbUrl) {
    try {
        const uuid = await Editor.Message.request('asset-db', 'query-uuid', dbUrl);
        return uuid || null;
    } catch (error) {
        return null;
    }
}

async function refreshAsset(dbUrl) {
    if (!dbUrl) {
        return;
    }
    try {
        await Editor.Message.request('asset-db', 'refresh-asset', dbUrl);
    } catch (error) {
        console.warn(`[anim-tools] refresh-asset 失败: ${dbUrl}`, error.message || error);
    }
}

async function deleteAssetByUrl(dbUrl) {
    const uuid = await queryUuid(dbUrl);
    if (!uuid) {
        return false;
    }
    try {
        await Editor.Message.request('asset-db', 'delete-asset', uuid);
        return true;
    } catch (error) {
        console.warn(`[anim-tools] delete-asset 失败: ${dbUrl}`, error.message || error);
        return false;
    }
}

async function createAsset(dbUrl, content) {
    const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await Editor.Message.request('asset-db', 'create-asset', dbUrl, data);
    await refreshAsset(dbUrl);
    return queryUuid(dbUrl);
}

async function removeFolderCompletely(absolutePath, dbUrl) {
    const deleted = await deleteAssetByUrl(dbUrl);
    if (!deleted && fs.existsSync(absolutePath)) {
        fs.rmSync(absolutePath, { recursive: true, force: true });
        const parentDb = toDbUrl(path.dirname(absolutePath));
        await refreshAsset(parentDb);
    }
}

async function ensureFolder(absolutePath) {
    fs.mkdirSync(absolutePath, { recursive: true });
    await refreshAsset(toDbUrl(absolutePath));
}

function readSpriteFrameInfo(metaPath) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    let sfMeta = meta.subMetas && meta.subMetas.f9941;
    if (!sfMeta) {
        sfMeta = Object.values(meta.subMetas || {}).find((item) => item.importer === 'sprite-frame');
    }
    if (!sfMeta || !sfMeta.uuid) {
        throw new Error(`无法读取 SpriteFrame meta: ${metaPath}`);
    }
    const userData = sfMeta.userData || {};
    return {
        uuid: sfMeta.uuid,
        width: userData.width || userData.rawWidth || 100,
        height: userData.height || userData.rawHeight || 100,
    };
}

async function waitForSpriteFrameMetas(imageAbsPaths, timeoutMs = 60000) {
    const pending = new Set(imageAbsPaths);
    const result = new Map();
    const start = Date.now();

    while (pending.size > 0 && Date.now() - start < timeoutMs) {
        for (const imagePath of [...pending]) {
            const metaPath = `${imagePath}.meta`;
            if (!fs.existsSync(metaPath)) {
                continue;
            }
            try {
                result.set(imagePath, readSpriteFrameInfo(metaPath));
                pending.delete(imagePath);
            } catch (error) {
                // meta 尚未写完，继续等待
            }
        }

        if (pending.size === 0) {
            break;
        }

        const resDb = toDbUrl(path.dirname(imageAbsPaths[0] || ''));
        await refreshAsset(resDb);
        await sleep(500);
    }

    if (pending.size > 0) {
        throw new Error(`等待图片导入超时，剩余 ${pending.size} 张未生成 meta`);
    }

    return result;
}

module.exports = {
    sleep,
    queryUuid,
    refreshAsset,
    deleteAssetByUrl,
    createAsset,
    removeFolderCompletely,
    ensureFolder,
    readSpriteFrameInfo,
    waitForSpriteFrameMetas,
};
