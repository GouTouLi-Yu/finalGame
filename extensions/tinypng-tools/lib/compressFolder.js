/**
 * TinyPNG 压缩文件夹内所有图片（原地覆盖）
 */
'use strict';

const fs = require('fs');
const tinify = require('tinify');
const { listImageFiles } = require('./walkImages');

function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressSingleFile(filePath) {
    const beforeSize = fs.statSync(filePath).size;
    const source = tinify.fromFile(filePath);
    await source.toFile(filePath);
    const afterSize = fs.statSync(filePath).size;
    const saved = beforeSize - afterSize;
    const ratio = beforeSize > 0 ? ((saved / beforeSize) * 100).toFixed(1) : '0.0';

    return {
        filePath,
        beforeSize,
        afterSize,
        saved,
        ratio,
    };
}

async function compressFolder(folderPath, apiKey) {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('请先在面板中填写 TinyPNG API Key');
    }

    tinify.key = apiKey.trim();

    const files = listImageFiles(folderPath);
    if (files.length === 0) {
        return {
            success: false,
            message: '所选文件夹中没有 PNG/JPG 图片',
            total: 0,
            compressed: 0,
            failed: 0,
            files: [],
            errors: [],
        };
    }

    console.log('========== TinyPNG 压缩 ==========');
    console.log(`文件夹: ${folderPath}`);
    console.log(`待压缩: ${files.length} 张`);
    console.log(`本月已用 API: ${tinify.compressionCount} 次`);

    const results = [];
    const errors = [];
    let totalBefore = 0;
    let totalAfter = 0;

    for (let i = 0; i < files.length; i += 1) {
        const filePath = files[i];
        const name = filePath.split(/[\\/]/).pop();
        try {
            const item = await compressSingleFile(filePath);
            totalBefore += item.beforeSize;
            totalAfter += item.afterSize;
            results.push(item);
            console.log(
                `  [${i + 1}/${files.length}] ${name}: `
                + `${formatSize(item.beforeSize)} → ${formatSize(item.afterSize)} `
                + `(省 ${item.ratio}%)`
            );
        } catch (error) {
            const message = error.message || String(error);
            errors.push({ filePath, message });
            console.warn(`  [${i + 1}/${files.length}] ${name} 失败: ${message}`);
        }
    }

    const totalSaved = totalBefore - totalAfter;
    const totalRatio = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(1) : '0.0';
    const summary = errors.length === 0
        ? `压缩完成：${results.length} 张，共省 ${formatSize(totalSaved)} (${totalRatio}%)`
        : `完成：成功 ${results.length} 张，失败 ${errors.length} 张，共省 ${formatSize(totalSaved)} (${totalRatio}%)`;

    console.log('========== 处理完成 ==========');
    console.log(summary);
    console.log(`本月 API 累计: ${tinify.compressionCount} 次`);

    return {
        success: errors.length === 0,
        message: summary,
        total: files.length,
        compressed: results.length,
        failed: errors.length,
        totalBefore,
        totalAfter,
        totalSaved,
        totalRatio,
        compressionCount: tinify.compressionCount,
        files: results.map((item) => {
            const name = item.filePath.split(/[\\/]/).pop();
            return `${name}: ${formatSize(item.beforeSize)} → ${formatSize(item.afterSize)}`;
        }),
        errors: errors.map((item) => `${item.filePath}: ${item.message}`),
    };
}

module.exports = {
    compressFolder,
};
