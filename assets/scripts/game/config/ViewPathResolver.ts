import { ClassConfig } from '../../frame/Injector/ClassConfig';
import { EMediatorType } from '../core/view/Mediator';
import { EBundleType } from '../manager/ResManager';
import { ViewConfig, type IViewConfigOverride } from './ViewConfig';

export interface IResolvedViewPath {
    /** 传入的界面 id，如 MainMenuView（与节点 getViewName 一致） */
    viewId: string;
    bundle: EBundleType;
    /** bundle 内路径，无扩展名 */
    prefab: string;
    /** ClassConfig / Injector 使用的 Mediator 注册名，如 MainMenuMediator */
    mediatorKey: string;
    kind: 'popup' | 'area';
    layerName: string;
    mvcSubPath: string;
    usedDefaultPrefabPath: boolean;
}

/** MainMenuView -> MainMenu */
export function stripViewSuffix(viewId: string): string {
    return viewId.replace(/View$/, '');
}

/** 从类名去掉 Mediator 后缀 */
export function stripMediatorSuffix(className: string): string {
    return className.replace(/Mediator$/, '');
}

/**
 * 资源目录名与 mvc/view 下父文件夹一致：Pascal 前缀首字母小写（MainMenu -> mainMenu），
 * 以匹配常见脚本/预制体目录如 mainMenu/MainMenuLayer。
 */
function defaultResourceFolderName(pascalBase: string): string {
    if (!pascalBase) return pascalBase;
    return pascalBase.charAt(0).toLowerCase() + pascalBase.slice(1);
}

function inferKindFromMediatorClass(mediatorClass: Function): 'popup' | 'area' {
    const mt = (mediatorClass as any).MediatorType;
    if (mt === EMediatorType.AreaView) return 'area';
    return 'popup';
}

/**
 * 仅通过「以 View 结尾」的界面 id 解析路径（不再接受 Mediator 类）。
 * MainMenuView → Mediator 注册名 MainMenuMediator → Layer MainMenuLayer
 */
export function resolveViewPathForViewId(viewId: string): IResolvedViewPath | null {
    if (!viewId || !viewId.endsWith('View')) {
        console.error(`[ViewPathResolver] gotoView 只允许传入以 View 结尾的界面 id，例如 MainMenuView，当前: ${viewId}`);
        return null;
    }

    const base = stripViewSuffix(viewId);
    const mediatorKey = `${base}Mediator`;

    const MediatorClass = ClassConfig.getClass(mediatorKey);
    if (!MediatorClass) {
        console.error(
            `[ViewPathResolver] 界面 ${viewId} 应对应已注册的 Mediator「${mediatorKey}」，请在 ClassConfig.addClass('${mediatorKey}', ...)`
        );
        return null;
    }

    const ctor = MediatorClass as any;
    const subPathRaw = ctor.mvcViewSubPath as string | undefined;
    const subPath =
        subPathRaw != null && subPathRaw !== '' ? subPathRaw : defaultResourceFolderName(base);
    const layerName = `${base}Layer`;
    const defaultPrefab = `prefab/${subPath}/${layerName}`;

    const override: IViewConfigOverride | undefined = ViewConfig[viewId] || ViewConfig[mediatorKey];

    const prefabPath = normalizePrefabPath(override?.prefab ?? defaultPrefab);
    const usedDefaultPrefabPath = override?.prefab == null || override.prefab === '';

    return {
        viewId,
        bundle: override?.bundle ?? EBundleType.ui,
        prefab: prefabPath,
        mediatorKey,
        kind: override?.kind ?? inferKindFromMediatorClass(MediatorClass),
        layerName,
        mvcSubPath: subPath,
        usedDefaultPrefabPath,
    };
}

/**
 * 预制体加载失败时的排查说明（viewId 以 View 结尾）
 */
export function logPrefabConventionMismatch(
    viewId: string,
    mediatorClass: Function | null,
    resolved: IResolvedViewPath,
    loadError: unknown
) {
    const errMsg = loadError instanceof Error ? loadError.message : String(loadError);
    const className = mediatorClass ? (mediatorClass as any).name : resolved.mediatorKey;

    const lines: string[] = [
        '[UIManager] 预制体加载失败。',
        `引擎报错: ${errMsg}`,
        '',
        `界面 id（gotoView 传入）: ${viewId}`,
        `应对应 Mediator 注册名: ${resolved.mediatorKey}`,
        `Mediator 类名: ${className}`,
    ];

    if (resolved.usedDefaultPrefabPath) {
        lines.push(
            '',
            '当前未使用 ViewConfig.prefab 覆盖，按默认约定推断应为：',
            `  • Layer 预制体名: ${resolved.layerName}（「MainMenuView」去 View 得 MainMenu，再加 Layer）`,
            `  • 在「${resolved.bundle}」bundle 内路径: ${resolved.prefab}`,
            `  • 脚本侧目录应对齐: assets/scripts/game/core/mvc/view/${resolved.mvcSubPath}/（与 Mediator 类同名的 .ts）`,
            `  • 预制体侧: （${resolved.bundle} bundle 根）prefab/${resolved.mvcSubPath}/${resolved.layerName}.prefab`,
            '  • 默认目录名为 View 前缀去 View 后首字母小写（如 MainMenuView → mainMenu），与 mvcViewSubPath 可覆盖',
            '',
            '若目录更深，请在对应 Mediator 上设置 static mvcViewSubPath = "父/子";',
            '若仍不一致，请在 ViewConfig[' + `'${viewId}'` + '] 中配置 prefab 覆盖。'
        );
    } else {
        lines.push(
            '',
            '当前使用了 ViewConfig 中的 prefab 覆盖，请检查：',
            `  • bundle: ${resolved.bundle}`,
            `  • prefab 路径: ${resolved.prefab}`,
            '路径、bundle 名是否与 Creator 中一致。'
        );
    }

    console.error(lines.join('\n'));
}

function normalizePrefabPath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\/+/, '');
}
