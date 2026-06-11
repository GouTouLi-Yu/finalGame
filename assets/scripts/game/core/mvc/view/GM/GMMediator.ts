import { EditBox } from 'cc';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { DevConfig } from '../../../../config/DevConfig';
import { GMCheatService } from '../../../../gm/GMCheatService';
import { PopupViewMediator } from '../../../view/PopupViewMediator';

/** 预制体中 EditBox 节点名（与 Creator 中保持一致） */
const GM_EDITBOX_NODE_NAMES = ['editBox', 'EditBox', 'input'];

/**
 * GM 秘籍弹窗 Mediator。
 * 约定：界面 id `GMView` → `prefab/GMLayer`（ui bundle，由 fullPath + GMLayer）。
 */
export class GMMediator extends PopupViewMediator {
    public static fullPath = 'prefab/';

    private _editBox: EditBox | null = null;

    public initialize(..._any: any[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
    }

    registerUI(): void {
        this._editBox = this.findEditBox();
        if (!this._editBox) {
            console.warn('[GMMediator] 未找到 EditBox，请在 GMLayer 下添加名为 editBox 的输入框');
            return;
        }

        this._editBox.node.on(EditBox.EventType.EDITING_RETURN, this.onSubmit, this);
    }

    public onRemove(): void {
        if (this._editBox?.node?.isValid) {
            this._editBox.node.off(EditBox.EventType.EDITING_RETURN, this.onSubmit, this);
        }
        super.onRemove();
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        if (!DevConfig.isGMAllowed()) {
            this.dismiss();
            return;
        }
        this.setupView();
    }

    public setupView(_data?: any): void {
        if (!this._editBox) {
            this._editBox = this.findEditBox();
        }
        if (this._editBox) {
            this._editBox.string = '';
            this._editBox.focus();
        }
    }

    private findEditBox(): EditBox | null {
        for (const name of GM_EDITBOX_NODE_NAMES) {
            const node = this.view.getChildByName(name);
            const box = node?.getComponent(EditBox);
            if (box) return box;
        }
        return this.view.getComponentInChildren(EditBox);
    }

    /** 回车提交秘籍：命中则执行并关闭；未命中也关闭。 */
    private onSubmit(): void {
        const raw = this._editBox?.string ?? '';
        const matched = GMCheatService.execute(raw);
        if (!matched && raw.trim()) {
            console.log(`[GM] 未知秘籍: ${raw.trim()}`);
        }
        this.dismiss();
    }
}

ClassConfig.addClass('GMMediator', GMMediator);
