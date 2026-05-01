/**
 * UI 通用辅助（极简版；k 项目 UIHelper 体量极大，此处只保留常用入口，其余按需再搬）
 */
export class UIHelper {
    /** 提示：默认控制台；后续可改为 Toast / 飘字节点 */
    static showTips(msg: string) {
        console.log('[Tips]', msg);
    }
}
