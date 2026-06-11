import { DEV } from 'cc/env';
import { GameConfig } from './GameConfig';

/**
 * 开发者能力开关。正式发布包（BUILD）下 GM 等调试功能默认关闭。
 */
export const DevConfig = {
    /**
     * 是否允许使用 GM（~ 快捷键、秘籍界面与执行）。
     * - 编辑器 / 浏览器预览：DEV === true，可用
     * - 正式发布包：DEV === false，不可用
     * - 本地调试 release 包：可临时设 GameConfig.forceEnableGM = true
     */
    isGMAllowed(): boolean {
        if (GameConfig.forceEnableGM === true) return true;
        return DEV;
    },
};
