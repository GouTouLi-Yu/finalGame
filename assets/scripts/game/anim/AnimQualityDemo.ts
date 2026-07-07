import { assetManager, instantiate, Node, Prefab } from 'cc';
import { AnimQualityService } from './AnimQualityService';

/** liYin / usingMagic1 演示用帧动画 prefab */
const DEMO_BATTLE_ANIM_PREFAB_UUID = '22a3a57b-008a-4912-99b8-7ecf29c75e88';

function loadPrefabByUuid(uuid: string): Promise<Prefab> {
    return new Promise((resolve, reject) => {
        assetManager.loadAny({ uuid }, Prefab, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`[AnimQualityDemo] 加载 prefab 失败: ${uuid}`));
                return;
            }
            resolve(asset as Prefab);
        });
    });
}

/**
 * 在战斗界面挂一个演示角色动画，便于验证画质三档切换。
 * 若 parent 下已有名为 anim 的子节点则跳过。
 */
export async function mountBattleDemoAnim(parent: Node): Promise<Node | null> {
    if (!parent?.isValid) {
        return null;
    }
    const existing = parent.getChildByName('anim');
    if (existing?.isValid) {
        AnimQualityService.refreshAll();
        return existing;
    }

    try {
        const prefab = await loadPrefabByUuid(DEMO_BATTLE_ANIM_PREFAB_UUID);
        const node = instantiate(prefab);
        node.name = 'anim';
        node.setPosition(0, 0, 0);
        parent.addChild(node);
        AnimQualityService.refreshAll();
        console.log('[AnimQualityDemo] 已挂载 usingMagic1 演示动画，可在设置中切换画质');
        return node;
    } catch (error) {
        console.warn('[AnimQualityDemo] 演示动画加载失败，画质切换将仅作用于场景中已有 anim', error);
        return null;
    }
}
