/**
 * auto-atlas.pac.meta 模板（4096×4096）
 */
'use strict';

function buildAutoAtlasMeta(uuid) {
    return {
        ver: '1.0.8',
        importer: 'auto-atlas',
        imported: true,
        uuid,
        files: ['.json'],
        subMetas: {},
        userData: {
            maxWidth: 4096,
            maxHeight: 4096,
            padding: 2,
            allowRotation: true,
            forceSquared: false,
            powerOfTwo: false,
            algorithm: 'MaxRects',
            format: 'png',
            quality: 80,
            contourBleed: true,
            paddingBleed: true,
            filterUnused: true,
            removeTextureInBundle: true,
            removeImageInBundle: true,
            removeSpriteAtlasInBundle: true,
            compressSettings: {
                useCompressTexture: true,
            },
            textureSetting: {
                wrapModeS: 'repeat',
                wrapModeT: 'repeat',
                minfilter: 'linear',
                magfilter: 'linear',
                mipfilter: 'none',
                anisotropy: 0,
            },
        },
    };
}

module.exports = {
    buildAutoAtlasMeta,
};
