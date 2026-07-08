import { _decorator, DynamicAtlasManager, macro } from 'cc';
import { ELanguage } from '../i18n/LanguageType';
const { ccclass, property } = _decorator;

/**
 * 动态合图（降低 drawCall）需在项目最早期启用，并关闭贴图缓存清理。
 * @see https://docs.cocos.com/creator/manual/zh/advanced-topics/dynamic-atlas.html
 */
macro.CLEANUP_IMAGE_CACHE = false;
DynamicAtlasManager.instance.enabled = true;
/** 卡牌底图约 200×280，默认 512 足够；更大 UI 图可在编辑器打静态 Auto Atlas */
DynamicAtlasManager.instance.maxFrameSize = 512;

export const GameConfig = {
    test: true,
    /**
     * 强制开启 GM（仅开发者本地调试 release 包时用，正式发布务必保持 false）。
     */
    forceEnableGM: false,
    /** 默认语言；玩家曾在设置中切换过则以本地存储为准 */
    language: ELanguage.CN,
}
