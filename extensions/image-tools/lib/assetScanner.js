/**
 * 遍历资源与 meta / prefab 解析
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
    UI_RES_ROOT,
    COMMON_RES_ROOT,
    BG_ROOT,
    toPosixPath,
    toAbsolutePath,
    isUnderDir,
    isImageFile,
} = require('./pathConfig');

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:@[0-9a-f]+)?/gi;

function walkFiles(rootRelativePath, options = {}) {
    const {
        extensions = null,
        filter = null,
    } = options;

    const rootAbsolute = toAbsolutePath(rootRelativePath);
    const results = [];

    if (!fs.existsSync(rootAbsolute)) {
        return results;
    }

    function walk(currentAbsolute, currentRelative) {
        const entries = fs.readdirSync(currentAbsolute, { withFileTypes: true });
        for (const entry of entries) {
            const entryAbsolute = path.join(currentAbsolute, entry.name);
            const entryRelative = toPosixPath(path.join(currentRelative, entry.name));

            if (entry.isDirectory() || entry.isSymbolicLink()) {
                walk(entryAbsolute, entryRelative);
                continue;
            }

            if (extensions) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!extensions.has(ext)) {
                    continue;
                }
            }

            if (filter && !filter(entryRelative, entryAbsolute)) {
                continue;
            }

            results.push({
                absolutePath: entryAbsolute,
                relativePath: entryRelative,
                fileName: entry.name,
            });
        }
    }

    walk(rootAbsolute, toPosixPath(rootRelativePath));
    return results;
}

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        return null;
    }
}

function collectMetaUuids(meta) {
    const uuids = new Set();
    if (!meta || typeof meta !== 'object') {
        return uuids;
    }

    if (meta.uuid) {
        uuids.add(meta.uuid);
    }

    if (meta.subMetas && typeof meta.subMetas === 'object') {
        for (const key of Object.keys(meta.subMetas)) {
            const subMeta = meta.subMetas[key];
            if (subMeta && subMeta.uuid) {
                uuids.add(subMeta.uuid);
            }
        }
    }

    return uuids;
}

function buildImageUuidIndex(imageFiles) {
    const uuidToImage = new Map();
    const imageInfos = [];

    for (const file of imageFiles) {
        const metaPath = `${file.absolutePath}.meta`;
        const meta = readJsonSafe(metaPath);
        if (!meta) {
            continue;
        }

        const uuids = collectMetaUuids(meta);
        const info = {
            relativePath: file.relativePath,
            absolutePath: file.absolutePath,
            fileName: file.fileName,
            uuids,
            packable: meta.userData && meta.userData.packable !== false,
            inAutoAtlasFolder: hasAutoAtlasInAncestors(file.relativePath),
        };

        imageInfos.push(info);
        for (const uuid of uuids) {
            uuidToImage.set(uuid.toLowerCase(), info);
            const baseUuid = uuid.split('@')[0].toLowerCase();
            uuidToImage.set(baseUuid, info);
        }
    }

    return { uuidToImage, imageInfos };
}

function hasAutoAtlasInAncestors(relativePath) {
    const parts = relativePath.split('/');
    for (let i = parts.length - 1; i > 0; i -= 1) {
        const dirRelative = parts.slice(0, i).join('/');
        const dirAbsolute = toAbsolutePath(dirRelative);
        if (!fs.existsSync(dirAbsolute)) {
            continue;
        }
        const hasPac = fs.readdirSync(dirAbsolute).some((name) => name.endsWith('.pac'));
        if (hasPac) {
            return true;
        }
    }
    return false;
}

/**
 * uires 下可作为玩法模块的目录（排除 common / bg）
 */
function listUiresModuleFolders() {
    const rootAbsolute = toAbsolutePath(UI_RES_ROOT);
    if (!fs.existsSync(rootAbsolute)) {
        return [];
    }

    return fs.readdirSync(rootAbsolute, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => name !== 'common' && name !== 'bg');
}

/**
 * 预制体父文件夹名 -> uires 模块目录名（大小写不敏感）
 */
function resolveModuleFolder(parentFolderName, moduleFolders) {
    if (!parentFolderName) {
        return null;
    }

    if (moduleFolders.includes(parentFolderName)) {
        return parentFolderName;
    }

    const lower = parentFolderName.toLowerCase();
    return moduleFolders.find((name) => name.toLowerCase() === lower) || null;
}

function getModuleResRoot(moduleFolder) {
    return `${UI_RES_ROOT}/${moduleFolder}/res`;
}

/**
 * 判断图片路径对该玩法模块是否合法：
 * - 本模块 res
 * - common/res
 * - bg（全屏背景）
 */
function isImageAllowedForModule(imageRelativePath, moduleFolder) {
    return isUnderDir(imageRelativePath, getModuleResRoot(moduleFolder))
        || isUnderDir(imageRelativePath, COMMON_RES_ROOT)
        || isUnderDir(imageRelativePath, BG_ROOT);
}

function extractUuidsFromText(content) {
    const matches = content.match(UUID_PATTERN) || [];
    return Array.from(new Set(matches.map((item) => item.toLowerCase())));
}

/**
 * 扫描 prefab：静态引用的 uires 图片若不在本模块/common/bg，则视为跨模块引用
 */
function findCrossModuleImageViolations(uuidToImage, moduleFolders) {
    const prefabFiles = walkFiles('assets', {
        extensions: new Set(['.prefab']),
    });

    const violationMap = new Map();

    for (const prefab of prefabFiles) {
        const parentFolder = path.posix.basename(path.posix.dirname(prefab.relativePath));
        const moduleFolder = resolveModuleFolder(parentFolder, moduleFolders);
        if (!moduleFolder) {
            continue;
        }

        const content = fs.readFileSync(prefab.absolutePath, 'utf-8');
        const uuids = extractUuidsFromText(content);

        for (const uuid of uuids) {
            const image = uuidToImage.get(uuid);
            if (!image) {
                continue;
            }
            if (!isUnderDir(image.relativePath, UI_RES_ROOT)) {
                continue;
            }
            if (isUnderDir(image.relativePath, COMMON_RES_ROOT)) {
                continue;
            }
            if (isUnderDir(image.relativePath, BG_ROOT)) {
                continue;
            }
            if (isImageAllowedForModule(image.relativePath, moduleFolder)) {
                continue;
            }

            if (!violationMap.has(image.relativePath)) {
                violationMap.set(image.relativePath, {
                    image,
                    references: [],
                });
            }

            const record = violationMap.get(image.relativePath);
            const alreadyAdded = record.references.some((item) => item.prefabPath === prefab.relativePath);
            if (!alreadyAdded) {
                record.references.push({
                    prefabPath: prefab.relativePath,
                    prefabModule: moduleFolder,
                    prefabParentFolder: parentFolder,
                });
            }
        }
    }

    return Array.from(violationMap.values())
        .sort((a, b) => a.image.relativePath.localeCompare(b.image.relativePath));
}

module.exports = {
    walkFiles,
    readJsonSafe,
    collectMetaUuids,
    buildImageUuidIndex,
    listUiresModuleFolders,
    resolveModuleFolder,
    getModuleResRoot,
    isImageAllowedForModule,
    findCrossModuleImageViolations,
    hasAutoAtlasInAncestors,
};
