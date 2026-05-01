import { PCEventType } from '../../../frame/event/PCEventType';
import { LuaEvent } from '../../../frame/event/PCEvent';
import { EMediatorType } from './Mediator';
import { ViewEvent } from '../../event/ViewEvent';
import { BaseViewMediator } from './BaseViewMediator';

/**
 * 区域（主界面内容区）Mediator（精简自 k）
 */
export class AreaViewMediator extends BaseViewMediator {
    public static MediatorType: EMediatorType = EMediatorType.AreaView;

    public willBeCovered() {}

    public didFinishCoverTransition() {}

    public resumeWithData(_payload: any) {}

    public popViewCleaned() {}

    public didFinishResumeTransition() {}

    public dismiss(data?: any, options?: any) {
        if (this._dismissed) return;
        this._dismissed = true;
        const viewName = this.getViewName();
        const payload = { viewName };
        this.dispatch(new LuaEvent(PCEventType.EVT_WILL_CLOSE_VIEW, payload));
        this.willBeClosed(data);
        this.dispatch(new ViewEvent(PCEventType.EVT_DISMISS_VIEW, this.getView(), options, data));
        (this as any)._dismissCallback?.();
        this.dispatch(new LuaEvent(PCEventType.EVT_DID_CLOSE_VIEW, payload));
    }
}
