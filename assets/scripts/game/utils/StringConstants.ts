/**
 * 集中维护界面与提示文案（直接写死字符串，不做多语言、不导出 Excel）。
 * 按 key 取文案请用 `Strings.get("KEY")`，见同目录 `Strings.ts`。
 */

export let StringConstants = {
    /** 弹窗点遮罩关闭时的底部提示（对齐 k：点击任意区域关闭） */
    TEXT_POPUP_CLICK_MASK_TO_CLOSE: "点击任意区域可关闭当前界面",

    // 主菜单
    TEXT_MAIN_MENU_001: "新游戏",
    TEXT_MAIN_MENU_002: "继续游戏",
    TEXT_MAIN_MENU_003: "养成",
    TEXT_MAIN_MENU_004: "设置",
    TEXT_MAIN_MENU_005: "退出游戏",
};
