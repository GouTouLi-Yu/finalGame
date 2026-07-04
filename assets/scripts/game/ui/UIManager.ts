import {
    BlockInputEvents,
    Canvas,
    Color,
    director,
    Graphics,
    instantiate,
    Node,
    NodeEventType,
    Prefab,
    UITransform,
    view,
} from 'cc';
import { Injector } from '../../frame/Injector/Injector';
import { ClassConfig } from '../../frame/Injector/ClassConfig';
import { ViewConfig } from '../config/ViewConfig';
import { logPrefabConventionMismatch, resolveViewPathForViewId } from '../config/ViewPathResolver';
import { ResManager } from '../manager/ResManager';
import { MediatorMap } from '../map/MediatorMap';
import { LocalizedTextBinder } from '../i18n/LocalizedTextBinder';
import { initUiFramework } from './UIFramework';

const NAME_AREA_LAYER = '__UIAreaLayer';
const NAME_POPUP_LAYER = '__UIPopupLayer';
/** 弹窗层底部半透明遮罩（对齐 k：打开弹窗时压暗下层界面） */
const NAME_POPUP_MASK = '__UIPopupMask';

export const UI_POPUP_LAYER_NODE_NAME = NAME_POPUP_LAYER;
export const UI_POPUP_MASK_NODE_NAME = NAME_POPUP_MASK;
/** 遮罩上底部提示文案节点（由 PopupViewMediator 创建） */
export const UI_POPUP_MASK_HINT_NODE_NAME = '__PopupMaskCloseHint';

/**
 * UI 入口：
 * - gotoView **只接受字符串**，且必须以 **View** 结尾，例如 `MainMenuView`
 * - 对应 Mediator：`MainMenuView` → `MainMenuMediator`；预制体路径 = `Mediator.fullPath` + `MainMenuLayer`（默认 ui bundle）
 *
 * 区域（area）打开策略对齐 k 项目思路：
 * - `viewType: 'switch'` 或 `ViewConfig.isMain`：替换 `__UIAreaLayer` 内已有界面（对应 k 的 EVT_SWITCH_VIEW / 主界面 switch）
 * - `viewType: 'push'`：不先清空区域层（对应 k 默认 area 走 push；本工程若未实现栈式逻辑，慎用）
 */
export interface IUIManagerGotoOptions {
    overrideParent?: Node | null;
    viewType?: 'switch' | 'push';
    isMain?: boolean;
    /**
     * 仅 kind===popup 且挂到内置 `__UIPopupLayer` 时生效：是否显示压暗遮罩（默认 true）。
     * 自定义 overrideParent 时不自动加遮罩（避免未知层级结构）。
     */
    showPopupMask?: boolean;
    /** 遮罩不透明度 0–255，默认 160 */
    popupMaskAlpha?: number;
}

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

    /**
     * 是否在本次打开前替换整块区域层（k：switch / isMain；与 push 相对）。
     */
    private static shouldReplaceAreaLayer(viewId: string, options?: IUIManagerGotoOptions): boolean {
        const cfg = ViewConfig[viewId];
        const vt = options?.viewType ?? cfg?.viewType;
        const isMain = options?.isMain ?? cfg?.isMain;
        if (vt === 'push') return false;
        if (vt === 'switch' || isMain === true) return true;
        // 未配置：本工程仅一层 area 容器，默认替换避免叠层（k 侧 area 默认多为 push，由 Scene 消费事件处理）
        return true;
    }

    /**
     * 切换区域界面前清空内容区：先 dismiss（派发关闭事件），再销毁节点，
     * 这样会触发 MediatorMap 里 NODE_DESTROYED → onRemove（对齐 k 里 removeView / cleanMediator + destroy 的效果）。
     */
    private static clearAreaLayer() {
        if (!this._areaLayer || !this._areaLayer.isValid) return;
        const children = this._areaLayer.children.slice();
        for (const child of children) {
            if (!child || !child.isValid) continue;
            const med = (child as any).mediator;
            try {
                if (med && typeof med.dismiss === 'function' && !med._dismissed) {
                    med.dismiss();
                }
            } catch (e) {
                console.warn('[UIManager] dismiss area view failed', e);
            }
            child.destroy();
        }
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

    private static updatePopupMaskGraphics(maskNode: Node, alpha = 160) {
        const g = maskNode.getComponent(Graphics);
        const ut = maskNode.getComponent(UITransform);
        if (!g || !ut) return;
        const w = ut.width;
        const h = ut.height;
        g.clear();
        g.fillColor = new Color(0, 0, 0, alpha);
        g.rect(-w * 0.5, -h * 0.5, w, h);
        g.fill();
    }

    /**
     * 在弹窗层最底部放置全屏半透明遮罩，阻挡触摸穿透到 area 层（k 中由 Scene 响应 EVT_SCENE_ADD_MASKLAYER，此处由 UIManager 直接维护）。
     */
    private static ensurePopupMask(alpha: number): Node | null {
        if (!this._popupLayer?.isValid) return null;
        let mask = this._popupLayer.getChildByName(NAME_POPUP_MASK);
        if (!mask?.isValid) {
            mask = new Node(NAME_POPUP_MASK);
            mask.layer = this._popupLayer.layer;
            const ut = mask.addComponent(UITransform);
            const canvas = this._canvas;
            if (canvas) {
                const cut = canvas.getComponent(UITransform);
                if (cut) ut.setContentSize(cut.contentSize);
                else {
                    const vs = view.getVisibleSize();
                    ut.setContentSize(vs.width, vs.height);
                }
            }
            mask.setPosition(0, 0, 0);
            mask.addComponent(Graphics);
            mask.addComponent(BlockInputEvents);
            this._popupLayer.insertChild(mask, 0);
        }
        mask.setSiblingIndex(0);
        this.updatePopupMaskGraphics(mask, alpha);
        this.ensurePopupMaskDismissTouch(mask);
        return mask;
    }

    /**
     * 点击遮罩空白处关闭「当前最顶层」且允许点遮罩关闭的弹窗（与 k 一致）。
     */
    static onPopupMaskAreaClicked() {
        this.dismissTopPopupOnMaskTouch();
    }

    private static dismissTopPopupOnMaskTouch() {
        if (!this._popupLayer?.isValid) return;
        for (let i = this._popupLayer.children.length - 1; i >= 0; i--) {
            const c = this._popupLayer.children[i];
            if (c.name === NAME_POPUP_MASK) continue;
            const med = (c as any).mediator;
            if (!med) continue;
            if (med.isCloseWhenClickMaskLayer === false) return;
            if (typeof med.dismissByClick === 'function') {
                med.dismissByClick();
            }
            return;
        }
    }

    private static ensurePopupMaskDismissTouch(mask: Node) {
        if ((mask as any)._popupMaskDismissTouchBound) return;
        (mask as any)._popupMaskDismissTouchBound = true;
        mask.on(Node.EventType.TOUCH_END, () => {
            this.dismissTopPopupOnMaskTouch();
        });
    }

    /** 根据弹窗层除遮罩外的子节点数量，显示/隐藏遮罩（支持多个弹窗叠层） */
    private static refreshPopupMaskVisibility() {
        if (!this._popupLayer?.isValid) return;
        const mask = this._popupLayer.getChildByName(NAME_POPUP_MASK);
        if (!mask?.isValid) return;
        let n = 0;
        for (const c of this._popupLayer.children) {
            if (c.name === NAME_POPUP_MASK) continue;
            if (c.isValid) n++;
        }
        mask.active = n > 0;
    }

    /**
     * @param viewId 必须以 View 结尾，如 MainMenuView（禁止传入 Mediator 类）
     * @param options.overrideParent 指定父节点；不传则按 area/popup 挂到内置层
     */
    static async gotoView(viewId: string, data?: unknown, options?: IUIManagerGotoOptions): Promise<Node | null> {
        this.init();

        const overrideParent = options?.overrideParent;

        if (!this.ensureBuiltinLayers() && overrideParent == null) {
            return null;
        }

        const resolved = resolveViewPathForViewId(viewId);
        if (!resolved) return null;

        if (resolved.kind === 'area' && this.shouldReplaceAreaLayer(viewId, options)) {
            this.clearAreaLayer();
        }

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
        LocalizedTextBinder.bindDeep(root);

        const layerParent = resolved.kind === 'area' ? this._areaLayer : this._popupLayer;
        const target = overrideParent != null ? overrideParent : layerParent;

        if (target) {
            target.addChild(root);
        } else {
            console.error(`[UIManager] 无法确定父节点 viewId=${resolved.viewId}`);
            return null;
        }

        if (
            resolved.kind === 'popup' &&
            target === this._popupLayer &&
            overrideParent == null &&
            options?.showPopupMask !== false
        ) {
            const alpha = options?.popupMaskAlpha != null ? options.popupMaskAlpha : 160;
            this.ensurePopupMask(Math.min(255, Math.max(0, alpha)));
            root.once(NodeEventType.NODE_DESTROYED, () => {
                this.refreshPopupMaskVisibility();
            });
            this.refreshPopupMaskVisibility();
        }

        const mediator = mm.createMediator(root);
        mediator?.enterWithData?.(data);
        // Mediator 可能在 enterWithData 里切换语言，此处再刷一次文案
        LocalizedTextBinder.refreshDeep(root);

        return root;
    }

    static get mediatorMap(): MediatorMap {
        this.init();
        return Injector.shared.getInstanceOnlyRead('MediatorMap') as MediatorMap;
    }

    /** 指定界面是否已有实例挂在场景树上 */
    static isViewOpen(viewId: string): boolean {
        this.init();
        const list = this.mediatorMap.getViewListByViewName(viewId);
        return list != null && list.some((n) => n?.isValid);
    }

    /** 关闭指定界面的全部实例（popup 走 dismiss，area 由 dismiss + destroy 处理） */
    static closeView(viewId: string): void {
        this.init();
        const list = this.mediatorMap.getViewListByViewName(viewId);
        if (!list || list.length === 0) return;

        for (const node of list.slice()) {
            if (!node?.isValid) continue;
            const med = (node as any).mediator;
            if (med && typeof med.dismiss === 'function' && !med._dismissed) {
                med.dismiss();
            } else {
                node.destroy();
            }
        }
    }

    /** 弹窗类界面开关：已打开则关闭，否则打开 */
    static togglePopupView(viewId: string, data?: unknown, options?: IUIManagerGotoOptions): void {
        if (this.isViewOpen(viewId)) {
            this.closeView(viewId);
            return;
        }
        void this.gotoView(viewId, data, options).then((node) => {
            if (!node) {
                console.warn(`[UIManager] 打开 ${viewId} 失败，请检查 ui bundle 中预制体路径与 Mediator.fullPath`);
            }
        });
    }

    static get canvas(): Node | null {
        return this._canvas;
    }
}
