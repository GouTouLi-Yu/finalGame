/**
 * 递归扫描文件夹内 PNG/JPG
 */
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function listImageFiles(folderPath) {
    const root = path.normalize(folderPath);
    if (!fs.existsSync(root)) {
        throw new Error(`文件夹不存在: ${root}`);
    }

    const stat = fs.statSync(root);
    if (!stat.isDirectory()) {
        throw new Error(`路径不是文件夹: ${root}`);
    }

    const results = [];

    function walk(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory() || entry.isSymbolicLink()) {
                walk(absolute);
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.has(ext)) {
                results.push(absolute);
            }
        }
    }

    walk(root);
    results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return results;
}

module.exports = {
    listImageFiles,
    IMAGE_EXTENSIONS,
};
