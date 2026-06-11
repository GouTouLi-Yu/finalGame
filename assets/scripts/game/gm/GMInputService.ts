import { EventKeyboard, game, input, Input, KeyCode, sys } from 'cc';
import { DevConfig } from '../config/DevConfig';
import { UIManager } from '../ui/UIManager';

const GM_VIEW_ID = 'GMView';
/** 防止 input 与 canvas 监听重复触发 */
const TOGGLE_DEBOUNCE_MS = 250;

/**
 * 全局 GM 快捷键：按 `~`（或键盘左上角 `~/\`` 物理键）切换 GM 界面。
 */
export class GMInputService {
    private static _inited = false;
    private static _lastToggleAt = 0;
    private static _onBrowserKeyDown: ((e: KeyboardEvent) => void) | null = null;

    static init(): void {
        if (!DevConfig.isGMAllowed()) return;
        if (this._inited) return;
        this._inited = true;

        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        this.bindBrowserCanvasKeyDown();
    }

    private static handleKeyDown(event: EventKeyboard): void {
        if (!this.isGMToggleKey(event)) return;
        this.tryToggleGMView('input');
    }

    private static bindBrowserCanvasKeyDown(): void {
        if (!sys.isBrowser) return;

        const tryBind = () => {
            const canvas = game.canvas;
            if (!canvas) return false;

            if (canvas.tabIndex < 0) {
                canvas.tabIndex = 0;
            }

            if (this._onBrowserKeyDown) {
                canvas.removeEventListener('keydown', this._onBrowserKeyDown);
            }

            this._onBrowserKeyDown = (e: KeyboardEvent) => {
                if (!this.isBrowserGMToggleKey(e)) return;
                e.preventDefault();
                this.tryToggleGMView('canvas');
            };
            canvas.addEventListener('keydown', this._onBrowserKeyDown);
            return true;
        };

        if (!tryBind()) {
            game.onPostProjectInitDelegate.add(() => {
                tryBind();
            });
        }
    }

    private static tryToggleGMView(_source: string): void {
        if (!DevConfig.isGMAllowed()) return;

        const now = Date.now();
        if (now - this._lastToggleAt < TOGGLE_DEBOUNCE_MS) return;
        this._lastToggleAt = now;

        UIManager.togglePopupView(GM_VIEW_ID);
    }

    /** 键盘左上角 `~/\`` 物理键，或实际输入字符为 ~ / ` */
    private static isGMToggleKey(event: EventKeyboard): boolean {
        if (event.keyCode === KeyCode.BACK_QUOTE) return true;

        const raw = event.rawEvent;
        if (raw && this.isToggleKeyChar(raw.key)) return true;

        return false;
    }

    private static isBrowserGMToggleKey(e: KeyboardEvent): boolean {
        if (e.keyCode === 192) return true;
        return this.isToggleKeyChar(e.key);
    }

    private static isToggleKeyChar(key: string): boolean {
        return key === '~' || key === '`' || key === '·';
    }
}
