import { Layout, Node, Tween, UITransform, Vec3, tween } from 'cc';
import {
    IBattleSeqBarEntry,
} from '../model/battle/BattleActionBarModel';
import { BattleSession } from '../model/battle/BattleSession';
import { EBattleSide } from '../model/battle/BattleEnums';
import { EnemyUtil } from './EnemyUtil';
import { HeroUtil } from './HeroUtil';

const SEQ_SLOT_COUNT = 8;
const SEQ_LAYOUT_PATH = 'img/seqBar/seqLayout';
const SHIFT_DURATION = 0.34;

/**
 * 战斗跑条 UI：img/seqBar/seqLayout/seq1~8。
 * - 单位行动：显示 di/icon，隐藏 round
 * - 新轮次：显示 round，隐藏 di
 * - 行动推进时：左侧滑出，右侧整体左挤，新头像从右边补入
 */
export class BattleSeqBarBinder {
    private _layoutNode: Node | null = null;
    private _slots: Node[] = [];
    private _restX: number[] = [];
    private _restY = 0;
    private _step = 115;
    private _lastEntries: IBattleSeqBarEntry[] = [];
    private _animating = false;
    private _queuedSession: BattleSession | null | undefined = undefined;

    bind(viewRoot: Node): void {
        this.stopAllTweens();
        this._slots = [];
        this._restX = [];
        this._lastEntries = [];
        this._animating = false;
        this._queuedSession = undefined;
        if (viewRoot == null) {
            return;
        }
        const layout = viewRoot.getChildByFullName(SEQ_LAYOUT_PATH);
        this._layoutNode = layout;
        if (layout == null) {
            console.warn(`[跑条] 未找到节点 ${SEQ_LAYOUT_PATH}`);
            return;
        }
        for (let i = 1; i <= SEQ_SLOT_COUNT; i++) {
            const slot = layout.getChildByName(`seq${i}`);
            if (slot == null) {
                console.warn(`[跑条] 未找到节点 ${SEQ_LAYOUT_PATH}/seq${i}`);
                continue;
            }
            this._slots.push(slot);
            this._restX.push(slot.position.x);
        }
        this._restY = this._slots[0]?.position.y ?? 0;
        if (this._restX.length >= 2) {
            this._step = this._restX[1] - this._restX[0];
        } else {
            const ut = this._slots[0]?.getComponent(UITransform);
            this._step = (ut?.width ?? 106) + 9;
        }
        // 关掉 Layout，避免和位移动画抢位置
        const layoutComp = layout.getComponent(Layout);
        if (layoutComp != null) {
            layoutComp.enabled = false;
        }
    }

    /** 按 Session 跑条状态刷新；animate=true 时播左挤动画 */
    refresh(session: BattleSession | null, animate = false): void {
        if (this._slots.length === 0) {
            return;
        }
        if (this._animating) {
            this._queuedSession = session;
            return;
        }
        if (session == null) {
            this.clear();
            this._lastEntries = [];
            return;
        }

        const entries = this.buildEntries(session);
        if (!animate || this._lastEntries.length === 0) {
            this.applyAllInstant(entries);
            return;
        }

        const shift = this.detectLeftShift(this._lastEntries, entries);
        if (shift <= 0) {
            this.applyAllInstant(entries);
            return;
        }

        this.playShiftAnim(Math.min(shift, this._slots.length), entries);
    }

    clear(): void {
        this.stopAllTweens();
        for (const slot of this._slots) {
            this.applySlot(slot, null);
            const idx = this._slots.indexOf(slot);
            if (idx >= 0 && this._restX[idx] != null) {
                slot.setPosition(this._restX[idx], this._restY, 0);
            }
            slot.setOpacity?.(255);
        }
    }

    private buildEntries(session: BattleSession): IBattleSeqBarEntry[] {
        const pending = session.pendingPlayerTurn;
        return session.actionBar.forecastSeqBar(SEQ_SLOT_COUNT, {
            currentRound: session.roundNumber,
            pendingActor: pending != null
                ? {
                    side: EBattleSide.Ally,
                    slotIndex: pending.slotIndex,
                    unitId: pending.unitId,
                }
                : null,
        });
    }

    private applyAllInstant(entries: IBattleSeqBarEntry[]): void {
        this.stopAllTweens();
        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            slot.setPosition(this._restX[i] ?? slot.position.x, this._restY, 0);
            slot.setOpacity?.(255);
            this.applySlot(slot, entries[i] ?? null);
        }
        this._lastEntries = entries.slice();
        this._animating = false;
        this.flushQueue();
    }

    /**
     * 检测 new 是否为 old 左移 shift 格后的结果（前缀对齐）。
     * @returns shift 格数；对不上返回 -1
     */
    private detectLeftShift(oldE: IBattleSeqBarEntry[], newE: IBattleSeqBarEntry[]): number {
        if (oldE.length === 0 || newE.length === 0) {
            return -1;
        }
        const max = Math.min(oldE.length, SEQ_SLOT_COUNT);
        for (let s = 1; s <= max; s++) {
            let ok = true;
            const compareLen = Math.min(oldE.length - s, newE.length);
            if (compareLen <= 0) {
                continue;
            }
            for (let i = 0; i < compareLen; i++) {
                if (this.entryKey(oldE[i + s]) !== this.entryKey(newE[i])) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                return s;
            }
        }
        // 完全相同
        if (oldE.length === newE.length
            && oldE.every((e, i) => this.entryKey(e) === this.entryKey(newE[i]))) {
            return 0;
        }
        return -1;
    }

    private entryKey(e: IBattleSeqBarEntry): string {
        if (e.kind === 'round') {
            return `round:${e.roundNumber}`;
        }
        return `unit:${e.side}:${e.unitId}:${e.slotIndex}`;
    }

    private playShiftAnim(shift: number, newEntries: IBattleSeqBarEntry[]): void {
        this._animating = true;
        this.stopAllTweens();

        const slots = this._slots;
        const exiting = slots.slice(0, shift);
        const staying = slots.slice(shift);
        const step = this._step;
        const dur = SHIFT_DURATION;

        let remain = exiting.length + staying.length;
        const onOneDone = (): void => {
            remain -= 1;
            if (remain > 0) {
                return;
            }
            // 重排：留下的在前，滑出的接到末尾（已带新内容）
            this._slots = staying.concat(exiting);
            for (let i = 0; i < this._slots.length; i++) {
                const node = this._slots[i];
                Tween.stopAllByTarget(node);
                node.setPosition(this._restX[i], this._restY, 0);
                node.setOpacity?.(255);
                this.applySlot(node, newEntries[i] ?? null);
            }
            this._lastEntries = newEntries.slice();
            this._animating = false;
            this.flushQueue();
        };

        // 右侧保留的：整体左挤
        for (let i = 0; i < staying.length; i++) {
            const node = staying[i];
            Tween.stopAllByTarget(node);
            node.setOpacity?.(255);
            tween(node)
                .to(dur, { position: new Vec3(this._restX[i], this._restY, 0) }, { easing: 'sineOut' })
                .call(onOneDone)
                .start();
        }

        // 左侧结束的：先滑出，再从右侧带新头像补入
        for (let i = 0; i < exiting.length; i++) {
            const node = exiting[i];
            const newIdx = slots.length - shift + i;
            Tween.stopAllByTarget(node);
            const outX = this._restX[i] - step * shift - 36;
            tween(node)
                .to(dur * 0.55, { position: new Vec3(outX, this._restY, 0) }, { easing: 'sineIn' })
                .call(() => {
                    this.applySlot(node, newEntries[newIdx] ?? null);
                    node.setOpacity?.(0);
                    const enterFrom = (this._restX[newIdx] ?? 0) + step * shift + 36;
                    node.setPosition(enterFrom, this._restY, 0);
                })
                .to(dur * 0.55, { position: new Vec3(this._restX[newIdx], this._restY, 0) }, { easing: 'sineOut' })
                .call(onOneDone)
                .start();

            this.tweenOpacity(node, 0, dur * 0.45);
            // 补入阶段淡入：在 call 里重置后另开一条
            tween(node)
                .delay(dur * 0.55)
                .call(() => this.tweenOpacity(node, 255, dur * 0.45))
                .start();
        }
    }

    private tweenOpacity(node: Node, to: number, dur: number): void {
        const proxy = { v: node.getOpacity?.() ?? 255 };
        tween(proxy)
            .to(dur, { v: to }, {
                onUpdate: () => {
                    if (node.isValid) {
                        node.setOpacity?.(Math.round(proxy.v));
                    }
                },
            })
            .start();
    }

    private flushQueue(): void {
        if (this._queuedSession === undefined) {
            return;
        }
        const next = this._queuedSession;
        this._queuedSession = undefined;
        this.refresh(next, true);
    }

    private stopAllTweens(): void {
        for (const slot of this._slots) {
            Tween.stopAllByTarget(slot);
        }
    }

    private applySlot(slot: Node, entry: IBattleSeqBarEntry | null): void {
        if (slot == null || !slot.isValid) {
            return;
        }
        if (entry == null) {
            slot.active = false;
            return;
        }

        slot.active = true;
        const di = slot.getChildByName('di');
        const round = slot.getChildByName('round');

        if (entry.kind === 'round') {
            if (di != null) {
                di.active = false;
            }
            if (round != null) {
                round.active = true;
                const label = round.getChildByName('Label') ?? round;
                label.setString(String(entry.roundNumber));
            }
            return;
        }

        if (round != null) {
            round.active = false;
        }
        if (di != null) {
            di.active = true;
            const icon = di.getChildByName('icon');
            const path = this.resolveAvatarPath(entry.side, entry.unitId);
            if (icon != null && path != null) {
                icon.loadTexture(path);
            }
        }
    }

    private resolveAvatarPath(side: EBattleSide, unitId: string): string | null {
        return side === EBattleSide.Ally
            ? HeroUtil.getBattleSeqAvatarPath(unitId)
            : EnemyUtil.getBattleSeqAvatarPath(unitId);
    }
}
