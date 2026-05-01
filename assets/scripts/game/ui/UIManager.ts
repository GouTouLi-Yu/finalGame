import { Canvas, director, instantiate, Node, Prefab, UITransform, view } from 'cc';
import { Injector } from '../../frame/Injector/Injector';
import { ClassConfig } from '../../frame/Injector/ClassConfig';
import { logPrefabConventionMismatch, resolveViewPathForViewId } from '../config/ViewPathResolver';
import { ResManager } from '../manager/ResManager';
import { MediatorMap } from '../map/MediatorMap';
import { initUiFramework } from './UIFramework';

const NAME_AREA_LAYER = '__UIAreaLayer';
const NAME_POPUP_LAYER = '__UIPopupLayer';

/**
 * UI 入口：
 * - gotoView **只接受字符串**，且必须以 **View** 结尾，例如 `MainMenuView`
 * - 对应 Mediator 注册名约定：`MainMenuView` → `MainMenuMediator`
 */
export class UIManager {
    private static _inited = false;
    private static _canvas: Node | null = null;
    private static _areaLayer: Node | null = null;
    private static _popupLayer: Node | null = null;

    static init() {
        if (this._inited) return;
        initUiFramework();
        this._inited = true;
    }

    static setupLayers(areaLayer?: Node | null, popupLayer?: Node | null) {
        if (areaLayer) this._areaLayer = areaLayer;
        if (popupLayer) this._popupLayer = popupLayer;
    }

    private static findCanvasInScene(): Node | null {
        const scene = director.getScene();
        if (!scene) return null;
        const direct = scene.getChildByName('Canvas');
        if (direct) return direct;
        return this.findNodeWithCanvasComponent(scene);
    }

    private static findNodeWithCanvasComponent(node: Node): Node | null {
        if (node.getComponent(Canvas)) return node;
        for (const c of node.children) {
            const r = this.findNodeWithCanvasComponent(c);
            if (r) return r;
        }
        return null;
    }

    private static ensureBuiltinLayers(): boolean {
        const canvas = this.findCanvasInScene();
        if (!canvas) {
            console.warn('[UIManager] 当前场景未找到 Canvas，无法挂载 UI');
            return false;
        }
        this._canvas = canvas;

        if (!this._areaLayer || !this._areaLayer.isValid) {
            let n = canvas.getChildByName(NAME_AREA_LAYER);
            if (!n) {
                n = new Node(NAME_AREA_LAYER);
                n.layer = canvas.layer;
                canvas.addChild(n);
            }
            this._fitLayerToCanvas(n, canvas);
            this._areaLayer = n;
        }

        if (!this._popupLayer || !this._popupLayer.isValid) {
            let n = canvas.getChildByName(NAME_POPUP_LAYER);
            if (!n) {
                n = new Node(NAME_POPUP_LAYER);
                n.layer = canvas.layer;
                canvas.addChild(n);
            }
            this._fitLayerToCanvas(n, canvas);
            this._popupLayer = n;
        }

        if (this._areaLayer && this._popupLayer) {
            this._popupLayer.setSiblingIndex(canvas.children.length - 1);
        }

        return true;
    }

    private static _fitLayerToCanvas(layer: Node, canvas: Node) {
        let ut = layer.getComponent(UITransform);
        if (!ut) ut = layer.addComponent(UITransform);
        const cut = canvas.getComponent(UITransform);
        if (cut) {
            ut.setContentSize(cut.contentSize);
        } else {
            const vs = view.getVisibleSize();
            ut.setContentSize(vs.width, vs.height);
        }
        layer.setPosition(0, 0, 0);
    }

    /**
     * @param viewId 必须以 View 结尾，如 MainMenuView（禁止传入 Mediator 类）
     */
    static async gotoView(viewId: string, data?: unknown, overrideParent?: Node | null): Promise<Node | null> {
        this.init();

        if (!this.ensureBuiltinLayers() && overrideParent == null) {
            return null;
        }

        const resolved = resolveViewPathForViewId(viewId);
        if (!resolved) return null;

        const MediatorClass = ClassConfig.getClass(resolved.mediatorKey);

        const mm = Injector.shared.getInstanceOnlyRead('MediatorMap') as MediatorMap;
        mm.mapView(resolved.viewId, resolved.mediatorKey, true, true);

        let prefabAsset: Prefab;
        try {
            prefabAsset = (await ResManager.loadAsset(resolved.bundle, resolved.prefab, Prefab)) as Prefab;
        } catch (e) {
            logPrefabConventionMismatch(viewId, MediatorClass ?? null, resolved, e);
            return null;
        }

        const root = instantiate(prefabAsset);
        (root as any).getViewName = () => resolved.viewId;

        const layerParent = resolved.kind === 'area' ? this._areaLayer : this._popupLayer;
        const target = overrideParent != null ? overrideParent : layerParent;

        if (target) {
            target.addChild(root);
        } else {
            console.error(`[UIManager] 无法确定父节点 viewId=${resolved.viewId}`);
            return null;
        }

        const mediator = mm.createMediator(root);
        mediator?.enterWithData?.(data);

        return root;
    }

    static get mediatorMap(): MediatorMap {
        this.init();
        return Injector.shared.getInstanceOnlyRead('MediatorMap') as MediatorMap;
    }

    static get canvas(): Node | null {
        return this._canvas;
    }
}
