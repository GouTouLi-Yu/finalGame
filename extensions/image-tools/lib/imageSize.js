/**
 * 读取 PNG / JPG 尺寸（无第三方依赖）
 */
'use strict';

const fs = require('fs');

function readImageSize(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 24) {
        return null;
    }

    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return readPngSize(buffer);
    }

    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return readJpegSize(buffer);
    }

    return null;
}

function readPngSize(buffer) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}

function readJpegSize(buffer) {
    let offset = 2;
    while (offset < buffer.length) {
        if (buffer[offset] !== 0xFF) {
            offset += 1;
            continue;
        }

        const marker = buffer[offset + 1];
        const blockLength = buffer.readUInt16BE(offset + 2);

        if (marker === 0xC0 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
        }

        offset += 2 + blockLength;
    }

    return null;
}

function isBackgroundSize(width, height, targetWidth, targetHeight, tolerance) {
    return Math.abs(width - targetWidth) <= tolerance
        && Math.abs(height - targetHeight) <= tolerance;
}

module.exports = {
    readImageSize,
    isBackgroundSize,
};
