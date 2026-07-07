'use strict';

const BASE64_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Cocos Creator 脚本组件 __type__ 使用压缩 UUID（与编辑器序列化一致）。
 */
function compressUuid(fullUuid) {
    const normalized = String(fullUuid || '').split('@')[0].replace(/-/g, '');
    if (normalized.length !== 32) {
        return fullUuid;
    }
    const reserved = normalized.slice(0, 5);
    const rest = normalized.slice(5);
    let compressed = reserved;
    for (let i = 0; i < rest.length; i += 3) {
        const hexVal1 = parseInt(rest[i], 16);
        const hexVal2 = parseInt(rest[i + 1], 16);
        const hexVal3 = parseInt(rest[i + 2], 16);
        compressed += BASE64_KEY_CHARS[(hexVal1 << 2) | (hexVal2 >> 2)];
        compressed += BASE64_KEY_CHARS[((hexVal2 & 3) << 4) | hexVal3];
    }
    return compressed;
}

module.exports = {
    compressUuid,
};
