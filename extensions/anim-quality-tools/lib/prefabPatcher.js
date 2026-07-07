'use strict';

const fs = require('fs');
const path = require('path');
const { refreshAsset } = require('../../anim-tools/lib/assetDbHelper');

const STANDARD_TYPES = new Set([
    'cc.Prefab',
    'cc.Node',
    'cc.UITransform',
    'cc.Sprite',
    'cc.Animation',
    'cc.CompPrefabInfo',
    'cc.PrefabInfo',
]);

function findNodeIndex(prefab) {
    return prefab.findIndex((item) => item.__type__ === 'cc.Node' && item._parent === null);
}

function findAnimationIndex(prefab) {
    return prefab.findIndex((item) => item.__type__ === 'cc.Animation');
}

function findPrefabInfoIndex(prefab) {
    return prefab.findIndex((item) => item.__type__ === 'cc.PrefabInfo');
}

function isCustomScriptType(type) {
    return typeof type === 'string' && !STANDARD_TYPES.has(type);
}

/**
 * 清理历史版本误插入的 AnimQualityClip 等自定义脚本，修复 _prefab / _components 错位。
 * 画质切换改由运行时 AnimQualityApplier 负责，不再往 prefab 挂脚本。
 */
function repairCorruptedPrefab(prefab) {
    const nodeIndex = findNodeIndex(prefab);
    let prefabInfoIndex = findPrefabInfoIndex(prefab);
    if (nodeIndex < 0 || prefabInfoIndex < 0) {
        return prefab;
    }

    const node = prefab[nodeIndex];
    let changed = true;
    while (changed) {
        changed = false;
        prefabInfoIndex = findPrefabInfoIndex(prefab);

        if (prefabInfoIndex >= 2) {
            const compInfo = prefab[prefabInfoIndex - 1];
            const script = prefab[prefabInfoIndex - 2];
            if (compInfo?.__type__ === 'cc.CompPrefabInfo' && isCustomScriptType(script?.__type__)) {
                const scriptId = prefabInfoIndex - 2;
                node._components = node._components.filter((ref) => ref.__id__ !== scriptId);
                prefab.splice(scriptId, 2);
                changed = true;
            }
        }

        prefabInfoIndex = findPrefabInfoIndex(prefab);
        if (prefab.length > prefabInfoIndex + 1) {
            const last = prefab[prefab.length - 1];
            const secondLast = prefab[prefab.length - 2];
            if (last?.__type__ === 'cc.CompPrefabInfo' && isCustomScriptType(secondLast?.__type__)) {
                const scriptId = prefab.length - 2;
                node._components = node._components.filter((ref) => ref.__id__ !== scriptId);
                prefab.splice(scriptId, 2);
                changed = true;
            } else {
                prefab.splice(prefabInfoIndex + 1);
                changed = true;
            }
        }
    }

    prefabInfoIndex = findPrefabInfoIndex(prefab);
    node._prefab = { __id__: prefabInfoIndex };

    const animationIndex = findAnimationIndex(prefab);
    node._components = node._components.filter((ref) => {
        const item = prefab[ref.__id__];
        if (!item) {
            return false;
        }
        if (ref.__id__ === animationIndex) {
            return true;
        }
        return item.__type__ === 'cc.UITransform' || item.__type__ === 'cc.Sprite';
    });

    return prefab;
}

async function patchAnimPrefab(animAbs, animDb, options) {
    const prefabPath = path.join(animAbs, 'anim.prefab');
    const prefab = repairCorruptedPrefab(JSON.parse(fs.readFileSync(prefabPath, 'utf-8')));
    const animationIndex = findAnimationIndex(prefab);
    if (animationIndex < 0) {
        throw new Error('anim.prefab 中未找到 Animation 组件');
    }

    const clipRefs = [options.highClipUuid, options.midClipUuid, options.lowClipUuid]
        .filter(Boolean)
        .map((uuid) => ({
            __uuid__: uuid,
            __expectedType__: 'cc.AnimationClip',
        }));

    prefab[animationIndex]._clips = clipRefs;
    prefab[animationIndex]._defaultClip = {
        __uuid__: options.highClipUuid,
        __expectedType__: 'cc.AnimationClip',
    };

    fs.writeFileSync(prefabPath, `${JSON.stringify(prefab, null, 2)}\n`, 'utf-8');
    await refreshAsset(`${animDb}/anim.prefab`);
}

module.exports = {
    patchAnimPrefab,
    repairCorruptedPrefab,
};
