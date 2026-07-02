/**
 * 从 .bc7-backup 还原 PNG，并删除对应 DDS
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { getBackupRoot, getManifestPath } = require('./walkImages');

async function restoreFolder(folderPath) {
    const root = path.normalize(folderPath);
    const backupRoot = getBackupRoot(root);
    const manifestPath = getManifestPath(root);

    if (!fs.existsSync(manifestPath)) {
        return {
            success: false,
            message: '未找到备份清单，请确认该文件夹曾用本工具压缩过（存在 .bc7-backup/manifest.json）',
            restored: 0,
            files: [],
            errors: [],
        };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const items = Array.isArray(manifest.items) ? manifest.items : [];

    if (items.length === 0) {
        return {
            success: false,
            message: '备份清单为空',
            restored: 0,
            files: [],
            errors: [],
        };
    }

    console.log('========== BC7 还原 ==========');
    console.log(`文件夹: ${root}`);

    const restoredFiles = [];
    const errors = [];

    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const pngPath = path.join(root, item.relPng.split('/').join(path.sep));
        const ddsPath = path.join(root, item.relDds.split('/').join(path.sep));
        const backupPath = path.join(root, item.backup.split('/').join(path.sep));

        try {
            if (!fs.existsSync(backupPath)) {
                throw new Error(`备份文件不存在: ${item.backup}`);
            }

            fs.copyFileSync(backupPath, pngPath);

            if (fs.existsSync(ddsPath)) {
                fs.unlinkSync(ddsPath);
            }

            restoredFiles.push(item.relPng);
            console.log(`  [${i + 1}/${items.length}] ✓ 还原 ${item.relPng}`);
        } catch (error) {
            const message = error.message || String(error);
            errors.push(`${item.relPng}: ${message}`);
            console.warn(`  [${i + 1}/${items.length}] ✗ ${item.relPng}: ${message}`);
        }
    }

    const summary = errors.length === 0
        ? `已还原 ${restoredFiles.length} 张 PNG`
        : `还原完成：成功 ${restoredFiles.length} 张，失败 ${errors.length} 张`;

    console.log('========== 还原完成 ==========');
    console.log(summary);

    return {
        success: errors.length === 0,
        message: summary,
        restored: restoredFiles.length,
        files: restoredFiles,
        errors,
    };
}

module.exports = {
    restoreFolder,
};
