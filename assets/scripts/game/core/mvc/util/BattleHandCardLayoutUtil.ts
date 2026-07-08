import { Node } from 'cc';
import { BattleUtil } from './BattleUtil';

export interface IHandCardLayoutSlot {
    x: number;
    y: number;
    rotZ: number;
}

/** 手牌 1~10 张均读 ConfigValue cardPosN / cardRotN，半侧对称展开 */
export class BattleHandCardLayoutUtil {
    /**
     * 将配表半侧 N 个点对称展开为 count 张牌位。
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

    static resolveSlots(count: number): IHandCardLayoutSlot[] {
        const n = Math.max(0, Math.min(count, BattleUtil.maxCardNum));
        if (n <= 0) {
            return [];
        }
        return this.expandSymmetric(
            n,
            BattleUtil.getCardPosByCount(n),
            BattleUtil.getCardRotByCount(n),
        );
    }

    /** 对手牌节点应用 ConfigValue 坐标（直接挂在 card 节点下） */
    static apply(_container: Node, cardNodes: readonly Node[], count: number): void {
        const slots = this.resolveSlots(count);
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
