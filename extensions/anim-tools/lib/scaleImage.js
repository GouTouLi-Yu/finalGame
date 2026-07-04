/**
 * 复制或缩放单张图片（Electron nativeImage，无第三方依赖）
 */
'use strict';

const fs = require('fs');
const path = require('path');

let nativeImage = null;
try {
    nativeImage = require('electron').nativeImage;
} catch (error) {
    // 非 Electron 环境
}

function copyOrScaleImage(srcPath, destPath, scale) {
    if (scale === 1) {
        fs.copyFileSync(srcPath, destPath);
        return { scaled: false };
    }

    if (!nativeImage) {
        throw new Error('当前环境不支持图片缩放');
    }

    const ext = path.extname(destPath).toLowerCase();
    if (ext === '.webp') {
        fs.copyFileSync(srcPath, destPath);
        return { scaled: false, skippedWebp: true };
    }

    const img = nativeImage.createFromPath(srcPath);
    if (img.isEmpty()) {
        throw new Error(`无法读取图片: ${srcPath}`);
    }

    const { width, height } = img.getSize();
    const newWidth = Math.max(1, Math.round(width * scale));
    const newHeight = Math.max(1, Math.round(height * scale));
    const resized = img.resize({ width: newWidth, height: newHeight, quality: 'best' });

    const buffer = (ext === '.jpg' || ext === '.jpeg')
        ? resized.toJPEG(92)
        : resized.toPNG();
    fs.writeFileSync(destPath, buffer);
    return { scaled: true, width: newWidth, height: newHeight };
}

module.exports = {
    copyOrScaleImage,
};
