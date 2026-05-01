import { PCEventType } from '../../../frame/event/PCEventType';
import { LuaEvent } from '../../../frame/event/PCEvent';
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
        const viewName = this.getViewName();
        const payload = { viewName };
        this.dispatch(new LuaEvent(PCEventType.EVT_WILL_CLOSE_VIEW, payload));
        this.willBeClosed(data);
        this.dispatch(new ViewEvent(PCEventType.EVT_CLOSE_POPUP, this.getView(), null, data));
        this._dismissCallback?.();
        this.dispatch(new LuaEvent(PCEventType.EVT_DID_CLOSE_VIEW, payload));
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
