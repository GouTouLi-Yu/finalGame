import type { EBundleType } from '../manager/ResManager';

/**
 * 仅当「默认规则找不到预制体」或路径/名字例外时，在此覆盖。
 *
 * 默认规则（无需注册）：
 * - Mediator：`XxxMediator` → 预制体 `XxxLayer`
 * - 路径：`ui` bundle 内 `prefab/{子路径}/XxxLayer`，子路径默认 = Xxx（与 mvc/view 下单层文件夹一致）
 * - 多级目录：在 Mediator 上设静态 `mvcViewSubPath = 'shop/gift'`
 *
 * 查找覆盖条目的 key（任一命中即可）：ClassConfig 注册名、`类名`、`XxxView`
 */
export interface IViewConfigOverride {
    /** 仅当与默认规则不一致时填写；bundle 内路径，不要扩展名 */
    prefab?: string;
    bundle?: EBundleType;
    kind?: 'popup' | 'area';
    /**
     * 与 k 项目 UIManager._enterFunction 一致：主界面打开时会按 switch 处理（替换区域层）。
     */
    isMain?: boolean;
    /**
     * area 界面：`switch` 替换内容区、`push` 叠在当前区域之上（需场景/框架配合栈逻辑）。
     * 本工程未接 k 的全套 ViewEvent，默认仅在 switch/isMain 或默认替换时清空 __UIAreaLayer。
     */
    viewType?: 'switch' | 'push';
}

export const ViewConfig: Record<string, IViewConfigOverride> = {
    /** 进入主玩法等全屏主界面：替换区域层（对齐 k 的 isMain + switch） */
    MainView: { isMain: true, viewType: 'switch' },
};
