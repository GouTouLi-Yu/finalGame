/**
 * 动画序列帧批量重命名
 */
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
/** 序列帧后缀固定三位：_001、_002 … */
const FRAME_PAD_LENGTH = 3;
const FRAME_START_INDEX = 1;

function normalizePrefix(prefix) {
    const value = (prefix || '').trim();
    if (!value) {
        throw new Error('命名前缀不能为空');
    }
    return value.replace(/_+$/g, '');
}

function getFrameNumber(fileName) {
    const info = extractFrameInfo(fileName);
    return info ? info.number : Number.MAX_SAFE_INTEGER;
}

function extractFrameInfo(fileName) {
    const stem = path.basename(fileName, path.extname(fileName));
    const suffixMatch = stem.match(/_(\d+)$/);
    if (suffixMatch) {
        return {
            number: parseInt(suffixMatch[1], 10),
        };
    }
    const anyMatch = stem.match(/(\d+)$/);
    if (anyMatch) {
        return {
            number: parseInt(anyMatch[1], 10),
        };
    }
    return null;
}

function listImageFiles(folderPath) {
    if (!fs.existsSync(folderPath)) {
        throw new Error(`文件夹不存在: ${folderPath}`);
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
        throw new Error(`路径不是文件夹: ${folderPath}`);
    }

    return fs.readdirSync(folderPath)
        .filter((name) => {
            if (!IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase())) {
                return false;
            }
            if (name.startsWith('__anim_rename_tmp_')) {
                return false;
            }
            return true;
        })
        .sort((a, b) => {
            const diff = getFrameNumber(a) - getFrameNumber(b);
            if (diff !== 0) {
                return diff;
            }
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
}

function buildTargetNames(files, prefix, startIndex, padLength) {
    const normalizedPrefix = normalizePrefix(prefix);
    const targets = [];

    for (let i = 0; i < files.length; i += 1) {
        const oldName = files[i];
        const ext = path.extname(oldName);
        const index = startIndex + i;
        const suffix = String(index).padStart(padLength, '0');
        const newName = `${normalizedPrefix}_${suffix}${ext}`;
        targets.push({ oldName, newName });
    }

    const newNameSet = new Set(targets.map((item) => item.newName.toLowerCase()));
    if (newNameSet.size !== targets.length) {
        throw new Error('生成的目标文件名存在重复，请检查前缀或起始序号');
    }

    return targets;
}

function batchRenameImages(folderPath, prefix) {
    const files = listImageFiles(folderPath);
    if (files.length === 0) {
        return {
            success: false,
            message: '文件夹中没有找到 PNG/JPG/JPEG/WebP 图片',
            files: [],
            renames: [],
        };
    }

    const renames = buildTargetNames(files, prefix, FRAME_START_INDEX, FRAME_PAD_LENGTH);
    const folder = path.normalize(folderPath);

    // 先改成临时名，避免互相覆盖
    const tempPairs = renames.map((item, index) => ({
        oldName: item.oldName,
        tempName: `__anim_rename_tmp_${String(index + 1).padStart(4, '0')}${path.extname(item.oldName)}`,
        newName: item.newName,
    }));

    for (const pair of tempPairs) {
        fs.renameSync(
            path.join(folder, pair.oldName),
            path.join(folder, pair.tempName)
        );
    }

    const results = [];
    for (const pair of tempPairs) {
        fs.renameSync(
            path.join(folder, pair.tempName),
            path.join(folder, pair.newName)
        );
        results.push(`${pair.oldName} -> ${pair.newName}`);
    }

    return {
        success: true,
        message: `成功重命名 ${results.length} 张图片（${FRAME_START_INDEX.toString().padStart(FRAME_PAD_LENGTH, '0')} 起，${FRAME_PAD_LENGTH} 位）`,
        count: results.length,
        startIndex: FRAME_START_INDEX,
        padLength: FRAME_PAD_LENGTH,
        renames: results,
        files: results,
    };
}

module.exports = {
    batchRenameImages,
    listImageFiles,
    normalizePrefix,
    extractFrameInfo,
};
