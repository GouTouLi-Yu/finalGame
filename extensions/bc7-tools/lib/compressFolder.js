/**
 * 使用 texconv 将文件夹内 PNG 转为 BC7 DDS（原地替换，保留备份可还原）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {
    listPngFiles,
    getBackupRoot,
    getManifestPath,
} = require('./walkImages');

const execFileAsync = promisify(execFile);

function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function validateTexconv(texconvPath) {
    const resolved = path.normalize(texconvPath.trim());
    if (!resolved || !fs.existsSync(resolved)) {
        throw new Error('请先配置有效的 texconv.exe 路径（DirectXTex 工具）');
    }
    return resolved;
}

async function runTexconv(texconvPath, pngPath, outputDir) {
    await execFileAsync(texconvPath, [
        '-nologo',
        '-y',
        '-f',
        'BC7_UNORM',
        '-o',
        outputDir,
        pngPath,
    ], {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
    });
}

async function compressFolder(folderPath, texconvPath) {
    const root = path.normalize(folderPath);
    const texconv = validateTexconv(texconvPath);
    const pngFiles = listPngFiles(root);

    if (pngFiles.length === 0) {
        return {
            success: false,
            message: '所选文件夹中没有 PNG 图片',
            total: 0,
            converted: 0,
            failed: 0,
            files: [],
            errors: [],
        };
    }

    const backupRoot = getBackupRoot(root);
    ensureDir(backupRoot);

    console.log('========== BC7 压缩 (texconv) ==========');
    console.log(`文件夹: ${root}`);
    console.log(`texconv: ${texconv}`);
    console.log(`待处理: ${pngFiles.length} 张 PNG`);
    console.log(`备份目录: ${backupRoot}`);

    const manifest = {
        version: 1,
        folderRoot: root,
        createdAt: new Date().toISOString(),
        items: [],
    };

    const results = [];
    const errors = [];
    let totalBefore = 0;
    let totalAfter = 0;

    for (let i = 0; i < pngFiles.length; i += 1) {
        const pngPath = pngFiles[i];
        const rel = path.relative(root, pngPath);
        const name = path.basename(pngPath);
        const outputDir = path.dirname(pngPath);
        const ddsPath = path.join(outputDir, `${path.basename(pngPath, '.png')}.dds`);
        const backupPath = path.join(backupRoot, rel);

        try {
            const beforeSize = fs.statSync(pngPath).size;
            ensureDir(path.dirname(backupPath));
            fs.copyFileSync(pngPath, backupPath);

            await runTexconv(texconv, pngPath, outputDir);

            if (!fs.existsSync(ddsPath)) {
                throw new Error('texconv 未生成 DDS 文件');
            }

            const afterSize = fs.statSync(ddsPath).size;
            fs.unlinkSync(pngPath);

            totalBefore += beforeSize;
            totalAfter += afterSize;

            manifest.items.push({
                relPng: rel.split(path.sep).join('/'),
                relDds: path.relative(root, ddsPath).split(path.sep).join('/'),
                backup: path.relative(root, backupPath).split(path.sep).join('/'),
            });

            results.push(`${name}: ${formatSize(beforeSize)} → ${path.basename(ddsPath)} ${formatSize(afterSize)}`);
            console.log(`  [${i + 1}/${pngFiles.length}] ✓ ${rel}`);
        } catch (error) {
            const message = error.message || String(error);
            errors.push(`${rel}: ${message}`);
            console.warn(`  [${i + 1}/${pngFiles.length}] ✗ ${rel}: ${message}`);
        }
    }

    fs.writeFileSync(getManifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

    const saved = totalBefore - totalAfter;
    const ratio = totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : '0.0';
    const summary = errors.length === 0
        ? `BC7 转换完成：${results.length} 张，体积 ${formatSize(totalBefore)} → ${formatSize(totalAfter)}（${ratio}%）`
        : `完成：成功 ${results.length} 张，失败 ${errors.length} 张`;

    console.log('========== 处理完成 ==========');
    console.log(summary);
    console.log('如需还原，请在面板点击「从备份还原」');

    return {
        success: errors.length === 0,
        message: summary,
        total: pngFiles.length,
        converted: results.length,
        failed: errors.length,
        totalBefore,
        totalAfter,
        backupDir: backupRoot,
        files: results,
        errors,
    };
}

module.exports = {
    compressFolder,
};
