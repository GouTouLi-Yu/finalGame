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
}

export const ViewConfig: Record<string, IViewConfigOverride> = {};
