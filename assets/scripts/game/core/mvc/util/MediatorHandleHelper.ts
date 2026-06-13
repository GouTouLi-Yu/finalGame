import type { Node } from 'cc';

/** 节点路径 → Mediator 方法名 */
export type BtnHandleMap = Record<string, string>;

/**
 * Mediator 界面交互绑定辅助（精简自 k 项目 MediatorHandleHelper）。
 * BtnHandles 的 key 为预制体节点路径（支持 `/` 分隔），value 为 Mediator 上的方法名。
 */
export class MediatorHandleHelper {
    static setUpBtnHandle(mediator: { view: Node }, btnHandles: BtnHandleMap): void {
        if (mediator?.view == null || btnHandles == null) {
            return;
        }

        for (const nodePath in btnHandles) {
            const handlerName = btnHandles[nodePath];
            const node = mediator.view.getChildByFullName(nodePath);
            if (node == null) {
                console.warn(`[MediatorHandleHelper] 未找到按钮节点: ${nodePath}`);
                continue;
            }

            const handler = (mediator as any)[handlerName];
            if (typeof handler !== 'function') {
                console.warn(`[MediatorHandleHelper] 未找到回调方法: ${handlerName}`);
                continue;
            }

            node.addClickListener([mediator, handler]);
        }
    }
}
