import { Color, Label } from 'cc';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { PCEventType } from 'db://assets/scripts/frame/event/PCEventType';
import { AnimQualityLevel } from '../../../../anim/AnimQualityLevel';
import { AnimQualityService } from '../../../../anim/AnimQualityService';
import { PopupViewMediator } from '../../../view/PopupViewMediator';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

/**
 * 设置全屏弹层。
 * 约定：界面 id `SettingView` → `prefab/setting/SettingLayer`（ui bundle）。
 */
export class SettingMediator extends PopupViewMediator {
    public static fullPath = 'prefab/setting';

    BtnHandles: Record<string, string> = {
        btn1: 'onClickHighQuality',
        btn2: 'onClickMidQuality',
        btn3: 'onClickLowQuality',
        btn4: 'onClickClose',
    };

    private _onAnimQualityChanged = (): void => {
        this.refreshQualityButtons();
    };

    public onRegister(): void {
        super.onRegister();
        this.isCloseWhenClickMaskLayer = false;
        this.mapEventListeners();
    }

    public onRemove(): void {
        this.unmapEventListener(PCEventType.EVT_ANIM_QUALITY_CHANGED, this, this._onAnimQualityChanged);
        super.onRemove();
    }

    public enterWithData(_data?: unknown): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: unknown): void {
        this.refreshQualityButtons();
    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
        this.mapEventListener(PCEventType.EVT_ANIM_QUALITY_CHANGED, this, this._onAnimQualityChanged);
    }

    onClickHighQuality(): void {
        AnimQualityService.setLevel(AnimQualityLevel.High);
    }

    onClickMidQuality(): void {
        AnimQualityService.setLevel(AnimQualityLevel.Mid);
    }

    onClickLowQuality(): void {
        AnimQualityService.setLevel(AnimQualityLevel.Low);
    }

    onClickClose(): void {
        this.dismiss();
    }

    private refreshQualityButtons(): void {
        const current = AnimQualityService.getCurrent();
        this.setButtonSelected('btn1', current === AnimQualityLevel.High);
        this.setButtonSelected('btn2', current === AnimQualityLevel.Mid);
        this.setButtonSelected('btn3', current === AnimQualityLevel.Low);
    }

    private setButtonSelected(btnName: string, selected: boolean): void {
        const btnNode = this.view.getChildByName(btnName);
        const label = btnNode?.getChildByName('Label')?.getComponent(Label);
        if (!label) {
            return;
        }
        label.color = selected
            ? new Color(255, 220, 120, 255)
            : new Color(255, 255, 255, 255);
    }
}

ClassConfig.addClass('SettingMediator', SettingMediator);
