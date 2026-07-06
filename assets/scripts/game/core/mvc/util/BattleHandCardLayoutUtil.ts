import { Layout, Node } from 'cc';
import { BattleUtil } from './BattleUtil';

export interface IHandCardLayoutSlot {
    x: number;
    y: number;
    rotZ: number;
}

/** 手牌 ≤8 用 Layout；9/10 张读 ConfigValue 对称坐标 */
export class BattleHandCardLayoutUtil {
    static readonly LAYOUT_MAX_COUNT = 8;

    /**
     * 将配表半侧 5 个点对称展开为 count 张牌位（9 或 10）。
     * 前 half 张用原值；其余 mirror：x 取反，y 不变，角度取反。
     */
    static expandSymmetric(
        count: number,
        posHalf: readonly (readonly [number, number])[],
        rotHalf: readonly number[],
    ): IHandCardLayoutSlot[] {
        const half = posHalf.length;
        const slots: IHandCardLayoutSlot[] = [];
        for (let i = 0; i < count; i++) {
            if (i < half) {
                const p = posHalf[i];
                slots.push({ x: p[0], y: p[1], rotZ: rotHalf[i] ?? 0 });
            } else {
                const j = count - 1 - i;
                const p = posHalf[j];
                slots.push({ x: -p[0], y: p[1], rotZ: -(rotHalf[j] ?? 0) });
            }
        }
        return slots;
    }

    static resolveLayout(count: number): { useLayout: boolean; slots: IHandCardLayoutSlot[] | null } {
        const n = Math.max(0, Math.min(count, BattleUtil.maxCardNum));
        if (n <= this.LAYOUT_MAX_COUNT) {
            return { useLayout: true, slots: null };
        }
        if (n === 9) {
            return {
                useLayout: false,
                slots: this.expandSymmetric(9, BattleUtil.cardPos9, BattleUtil.cardRot9),
            };
        }
        return {
            useLayout: false,
            slots: this.expandSymmetric(10, BattleUtil.cardPos10, BattleUtil.cardRot10),
        };
    }

    /** 对手牌节点应用布局（需传入 card/Layout 上的 Layout 组件） */
    static apply(container: Node, layout: Layout | null, cardNodes: readonly Node[], count: number): void {
        const plan = this.resolveLayout(count);
        if (layout != null) {
            layout.enabled = plan.useLayout;
        }

        if (plan.useLayout) {
            for (const node of cardNodes) {
                node.setRotationFromEuler(0, 0, 0);
            }
            layout?.updateLayout(true);
            return;
        }

        const slots = plan.slots;
        if (slots == null) {
            return;
        }
        for (let i = 0; i < cardNodes.length; i++) {
            const slot = slots[i];
            const node = cardNodes[i];
            if (slot == null || node == null) {
                continue;
            }
            node.setPosition(slot.x, slot.y, 0);
            node.setRotationFromEuler(0, 0, slot.rotZ);
        }
    }
}
