/**
 * 递归扫描 PNG
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PNG_EXT = '.png';
const BACKUP_DIR_NAME = '.bc7-backup';

function listPngFiles(folderPath) {
    const root = path.normalize(folderPath);
    if (!fs.existsSync(root)) {
        throw new Error(`文件夹不存在: ${root}`);
    }
    if (!fs.statSync(root).isDirectory()) {
        throw new Error(`路径不是文件夹: ${root}`);
    }

    const results = [];

    function walk(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === BACKUP_DIR_NAME) {
                continue;
            }
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory() || entry.isSymbolicLink()) {
                walk(absolute);
                continue;
            }
            if (path.extname(entry.name).toLowerCase() === PNG_EXT) {
                results.push(absolute);
            }
        }
    }

    walk(root);
    results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return results;
}

function getBackupRoot(folderPath) {
    return path.join(path.normalize(folderPath), BACKUP_DIR_NAME);
}

function getManifestPath(folderPath) {
    return path.join(getBackupRoot(folderPath), 'manifest.json');
}

module.exports = {
    listPngFiles,
    getBackupRoot,
    getManifestPath,
    BACKUP_DIR_NAME,
};
