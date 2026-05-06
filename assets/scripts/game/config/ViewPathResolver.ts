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
    /** 预制体文件名（无路径、无扩展名），如 MainMenuLayer */
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
 * 当 Mediator 未设置 fullPath 时，用作 prefab 子路径默认：Pascal 首字母小写（MainMenu → mainMenu），
 * 得到 `prefab/mainMenu/MainMenuLayer`。
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
 * MainMenuView → MainMenuMediator → `Mediator.fullPath` + `MainMenuLayer`（bundle 默认 ui）。
 */
export function resolveViewPathForViewId(viewId: string): IResolvedViewPath | null {
    if (!viewId || !viewId.endsWith('View')) {
        console.error(`[ViewPathResolver] gotoView 只允许传入以 View 结尾的界面 id，例如 MainMenuView，当前: ${viewId}`);
        return null;
    }

    const base = stripViewSuffix(viewId);
    const mediatorKey = `${base}Mediator`;
    const layerName = `${base}Layer`;

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

    const fullPathRaw = ctor.fullPath as string | undefined;
    let defaultPrefab: string;
    if (fullPathRaw != null && String(fullPathRaw).trim() !== '') {
        defaultPrefab = joinFullPathAndLayerName(fullPathRaw, layerName);
    } else {
        defaultPrefab = normalizePrefabPath(`prefab/${subPath}/${layerName}`);
    }

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
            `  • 预制体文件名: ${resolved.layerName}（界面 id 去 View 后缀 + Layer，如 MainMenuView → MainMenuLayer）`,
            `  • 在「${resolved.bundle}」bundle 内路径: ${resolved.prefab}`,
            `  • 请在对应 Mediator 上设置 static fullPath = 'prefab/...'（目录前缀）；若 fullPath 为空则用 prefab/${resolved.mvcSubPath}/`,
            `  • 脚本侧目录习惯对齐: assets/scripts/game/core/mvc/view/${resolved.mvcSubPath}/`,
            `  • 预制体侧: （${resolved.bundle} bundle 根）${resolved.prefab}.prefab`,
            '',
            '若目录更深，可设置 static fullPath 或 static mvcViewSubPath（仅 fullPath 为空时参与默认路径）；',
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

/** fullPath 为 bundle 内目录（如 prefab/mainMenu/），与预制体名（如 MainMenuLayer）拼接 */
function joinFullPathAndLayerName(fullPath: string, layerName: string): string {
    const dir = normalizePrefabPath(fullPath).replace(/\/+$/, '');
    return `${dir}/${layerName}`;
}
