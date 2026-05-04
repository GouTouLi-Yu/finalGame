import { Color, Label, Node, NodeEventType, UITransform } from 'cc';
import { PCEventType } from '../../../frame/event/PCEventType';
import { LuaEvent } from '../../../frame/event/PCEvent';
import Strings from '../../utils/Strings';
import {
    UI_POPUP_LAYER_NODE_NAME,
    UI_POPUP_MASK_HINT_NODE_NAME,
    UI_POPUP_MASK_NODE_NAME,
    UIManager,
} from '../../ui/UIManager';
import { EMediatorType } from './Mediator';
import { ViewEvent } from '../../event/ViewEvent';
import { BaseViewMediator } from './BaseViewMediator';

/**
 * 弹层 Mediator（精简自 k：去掉引导/活动/计时器等，保留关闭流程与事件）
 */
export class PopupViewMediator extends BaseViewMediator {
    public static MediatorType: EMediatorType = EMediatorType.PopupView;

    protected _useCommonOpenAnim = false;
    get useCommonOpenAnim() {
        return this._useCommonOpenAnim;
    }

    protected _isCloseWhenClickMaskLayer = true;
    get isCloseWhenClickMaskLayer() {
        return this._isCloseWhenClickMaskLayer;
    }
    set isCloseWhenClickMaskLayer(v: boolean) {
        this._isCloseWhenClickMaskLayer = v;
    }

    public onRegister(): void {
        super.onRegister();
        this.setupClickMaskCloseHint();
    }

    /**
     * k：点遮罩关闭时，底部提示「点击任意区域…」；文案走 Strings / StringConstants。
     */
    protected setupClickMaskCloseHint(): void {
        if (!this._isCloseWhenClickMaskLayer) {
            this.hideMaskCloseHint();
            return;
        }
        const layer = this.view.parent;
        if (!layer?.isValid || layer.name !== UI_POPUP_LAYER_NODE_NAME) return;

        const mask = layer.getChildByName(UI_POPUP_MASK_NODE_NAME);
        if (!mask?.isValid) return;

        const maskUt = mask.getComponent(UITransform);
        const maskH = maskUt ? maskUt.height : 0;
        const maskW = maskUt ? maskUt.width : 720;

        let hint = mask.getChildByName(UI_POPUP_MASK_HINT_NODE_NAME);
        const text = Strings.get('TEXT_POPUP_CLICK_MASK_TO_CLOSE');

        if (!hint?.isValid) {
            hint = new Node(UI_POPUP_MASK_HINT_NODE_NAME);
            hint.layer = mask.layer;
            const ut = hint.addComponent(UITransform);
            ut.setAnchorPoint(0.5, 0);
            const maxW = Math.min(maskW * 0.92, 920);
            ut.setContentSize(maxW, 72);
            const lab = hint.addComponent(Label);
            lab.string = text;
            lab.fontSize = 22;
            lab.lineHeight = 26;
            lab.color = new Color(220, 220, 220, 255);
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
            lab.overflow = Label.Overflow.RESIZE_HEIGHT;
            hint.setPosition(0, -maskH * 0.5 + 40, 0);
            hint.setParent(mask);
            hint.on(NodeEventType.TOUCH_END, () => UIManager.onPopupMaskAreaClicked());
        } else {
            const lab = hint.getComponent(Label);
            if (lab) lab.string = text;
        }
        hint.active = true;
    }

    protected hideMaskCloseHint(): void {
        const layer = this.view.parent;
        if (!layer?.isValid || layer.name !== UI_POPUP_LAYER_NODE_NAME) return;
        const mask = layer.getChildByName(UI_POPUP_MASK_NODE_NAME);
        const hint = mask?.getChildByName(UI_POPUP_MASK_HINT_NODE_NAME);
        if (hint?.isValid) hint.active = false;
    }

    private _inShowAnim = false;
    set inShowAnim(v: boolean) {
        if (this._inShowAnim === v) return;
        this._inShowAnim = v;
        if (this._inShowAnim) {
            this.dispatch(new LuaEvent(PCEventType.EVT_SCENE_ADD_MASKLAYER, null));
        } else {
            this.dispatch(new LuaEvent(PCEventType.EVT_SCENE_DEL_MASKLAYER, null));
        }
    }

    protected _canClose = true;
    getCanClose() {
        return this._canClose;
    }
    setCanClose(value: boolean) {
        this._canClose = value;
    }

    public dismissByClick() {
        if (this.getCanClose()) {
            this.dismiss();
        }
    }

    public dismiss(data?: any) {
        if (this._dismissed) return;
        this._dismissed = true;
        const viewNode = this.getView();
        const viewName = this.getViewName();
        const payload = { viewName };
        this.dispatch(new LuaEvent(PCEventType.EVT_WILL_CLOSE_VIEW, payload));
        this.willBeClosed(data);
        this.dispatch(new ViewEvent(PCEventType.EVT_CLOSE_POPUP, viewNode, null, data));
        this._dismissCallback?.();
        this.dispatch(new LuaEvent(PCEventType.EVT_DID_CLOSE_VIEW, payload));
        // k 侧常见由 Scene 回收；本工程无统一监听关闭弹窗时销毁节点，此处销毁否则界面仍留在树上
        if (viewNode?.isValid) {
            viewNode.destroy();
        }
    }

    public close(data?: any) {
        this.dismiss(data);
    }

    public didFinishEnterTransition(isAnim = false) {
        void isAnim;
        // k：通用打开动画后可接「点空白关闭」提示等，此处留空
    }

    setPopupDelegate(delegate: any) {
        (this as any)._popupDelegate = delegate;
    }

    getPopupDelegate() {
        return (this as any)._popupDelegate;
    }

    public willBeClosed(data: any) {
        super.willBeClosed(data);
        (this as any)._popupDelegate?.willClose?.(this, data);
    }

    public resumeAgain() {}
}
