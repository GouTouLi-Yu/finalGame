/**
 * 美术 anim 路径 → 引擎 assets/res/anim 路径映射
 */
'use strict';

const path = require('path');

const ART_ANIM_PATTERN = /[\\/]美术[\\/]anim[\\/](.+)$/;
const PROTECTED_DB_URLS = new Set([
    'db://assets/res/anim/character',
    'db://assets/res/anim/ui',
]);

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function resolveTargetFromSource(sourceFolder) {
    const normalized = path.normalize(sourceFolder);
    const match = normalized.match(ART_ANIM_PATTERN);
    if (!match || !match[1]) {
        throw new Error('源路径必须包含「美术\\anim\\」段，例如：...\\美术\\anim\\character\\liYin\\battle\\hurt');
    }

    const relAfterAnim = toPosixPath(match[1]);
    const segments = relAfterAnim.split('/').filter(Boolean);
    if (segments.length === 0) {
        throw new Error('「美术\\anim\\」之后的路径不能为空');
    }

    const rootType = segments[0].toLowerCase();
    if (rootType !== 'character' && rootType !== 'ui') {
        throw new Error(`anim 路径必须以 character 或 ui 开头，当前为: ${segments[0]}`);
    }

    const targetAbs = path.join(Editor.Project.path, 'assets', 'res', 'anim', ...segments);
    const targetDb = `db://assets/res/anim/${relAfterAnim}`;

    if (PROTECTED_DB_URLS.has(targetDb)) {
        throw new Error('不能覆盖 anim/character 或 anim/ui 根目录');
    }

    return {
        sourceAbs: normalized,
        targetAbs,
        targetDb,
        relAfterAnim,
        actionName: segments[segments.length - 1],
    };
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
    toDbUrl,
    toPosixPath,
    PROTECTED_DB_URLS,
};
