import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { EGraphicsQuality, getGraphicsQualityLabel } from '../../../../render/GraphicsQualityLevel';
import { GraphicsQualityService } from '../../../../render/GraphicsQualityService';
import { PopupViewMediator } from '../../../view/PopupViewMediator';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';

/**
 * 设置弹窗（UILayer / __UIPopupLayer，不经过 RenderTexture）。
 */
export class SettingMediator extends PopupViewMediator {
    public static fullPath = 'prefab/setting';

    BtnHandles: Record<string, string> = {
        btn1: 'onClickHighQuality',
        btn2: 'onClickMediumQuality',
        btn3: 'onClickLowQuality',
        closeBtn: 'onClickClose',
    };

    public initialize(..._any: any[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.mapEventListeners();
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {
        const current = GraphicsQualityService.getCurrent();
        const scale = GraphicsQualityService.getCurrentScale();
        console.log(`[Setting] 当前画质: ${getGraphicsQualityLabel(current)} (${scale}x)`);
    }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
    }

    onClickHighQuality(): void {
        this._selectQuality(EGraphicsQuality.High);
    }

    onClickMediumQuality(): void {
        this._selectQuality(EGraphicsQuality.Medium);
    }

    onClickLowQuality(): void {
        this._selectQuality(EGraphicsQuality.Low);
    }

    onClickClose(): void {
        this.dismiss();
    }

    private _selectQuality(quality: EGraphicsQuality): void {
        // 先关弹窗，下一帧再切画质，避免弹窗 UILayer 与 RT 绑定同帧导致缩放拉伸
        this.dismiss();
        GraphicsQualityService.setQualityFromSetting(quality);
        const scale = GraphicsQualityService.getCurrentScale();
        console.log(`[Setting] 已切换画质: ${getGraphicsQualityLabel(quality)} (${scale}x)`);
    }
}

ClassConfig.addClass('SettingMediator', SettingMediator);
