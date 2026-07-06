/**
 * 美术 anim 路径 → 引擎 assets/res/anim 路径映射
 */
'use strict';

const path = require('path');

const ART_ANIM_PATTERN = /[\\/]美术[\\/]anim[\\/](.+)$/;
const PROTECTED_DB_URLS = new Set([
    'db://assets/res/anim/character',
    'db://assets/res/anim/ui',
    'db://assets/res/anim/enemy',
]);

const ALLOWED_ROOT_TYPES = new Set(['character', 'ui', 'enemy']);

const ROOT_TYPE_ABBR = {
    character: 'chac',
    ui: 'ui',
    enemy: 'enemy',
};

function isAllowedRootType(rootType) {
    return ALLOWED_ROOT_TYPES.has(rootType);
}

function getRootTypeAbbr(rootType) {
    return ROOT_TYPE_ABBR[rootType] || rootType;
}

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function resolveTargetFromSource(sourceFolder) {
    const normalized = path.normalize(sourceFolder);
    const match = normalized.match(ART_ANIM_PATTERN);
    if (!match || !match[1]) {
        throw new Error('源路径必须包含「美术\\anim\\」段，例如：...\\美术\\anim\\character\\liYin\\battle\\hurt 或 ...\\美术\\anim\\enemy\\goblin\\attack');
    }

    const relAfterAnim = toPosixPath(match[1]);
    const segments = relAfterAnim.split('/').filter(Boolean);
    if (segments.length === 0) {
        throw new Error('「美术\\anim\\」之后的路径不能为空');
    }

    const rootType = segments[0].toLowerCase();
    if (!isAllowedRootType(rootType)) {
        throw new Error(`anim 路径必须以 character、ui 或 enemy 开头，当前为: ${segments[0]}`);
    }

    const targetAbs = path.join(Editor.Project.path, 'assets', 'res', 'anim', ...segments);
    const targetDb = `db://assets/res/anim/${relAfterAnim}`;

    if (PROTECTED_DB_URLS.has(targetDb)) {
        throw new Error('不能覆盖 anim/character、anim/ui 或 anim/enemy 根目录');
    }

    return {
        sourceAbs: normalized,
        targetAbs,
        targetDb,
        relAfterAnim,
        actionName: segments[segments.length - 1],
    };
}

/** 根据美术 anim 路径推测序列帧命名前缀，例如 anim_chac_liYin_hurt / anim_enemy_goblin_attack */
function suggestPrefixFromSource(sourceFolder) {
    try {
        const mapping = resolveTargetFromSource(sourceFolder);
        const segments = mapping.relAfterAnim.split('/').filter(Boolean);
        const rootType = segments[0].toLowerCase();
        const typeAbbr = getRootTypeAbbr(rootType);
        const actionName = segments[segments.length - 1];
        if ((rootType === 'character' || rootType === 'enemy') && segments.length >= 2) {
            return `anim_${typeAbbr}_${segments[1]}_${actionName}`;
        }
        return `anim_${typeAbbr}_${actionName}`;
    } catch {
        return '';
    }
}

function toDbUrl(absolutePath) {
    const projectRoot = Editor.Project.path;
    const relative = path.relative(projectRoot, path.normalize(absolutePath));
    if (relative.startsWith('..')) {
        return null;
    }
    return `db://${toPosixPath(relative)}`;
}

module.exports = {
    resolveTargetFromSource,
    suggestPrefixFromSource,
    toDbUrl,
    toPosixPath,
    PROTECTED_DB_URLS,
};
