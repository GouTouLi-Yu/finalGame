/** 事件号生成（对齐 k 项目 EventType.eventTypeFromString 的思路） */
class EventTypeUtil {
    private static _n = 10000;
    private static readonly _used = new Set<string>();

    static id(name: string): number {
        if (this._used.has(name)) {
            throw new Error(`[PCEventType] repeated: ${name}`);
        }
        this._used.add(name);
        return ++this._n;
    }
}

/** 数值与 k 无关，仅保证进程内唯一；业务按常量名使用即可 */
export const PCEventType = {
    EVT_PUSH_VIEW: EventTypeUtil.id('EVT_PUSH_VIEW'),
    EVT_SWITCH_VIEW: EventTypeUtil.id('EVT_SWITCH_VIEW'),
    EVT_POPUP_VIEW: EventTypeUtil.id('EVT_POPUP_VIEW'),
    EVT_UP_VIEW: EventTypeUtil.id('EVT_UP_VIEW'),

    EVT_CLOSE_POPUP: EventTypeUtil.id('EVT_CLOSE_POPUP'),
    EVT_DISMISS_VIEW: EventTypeUtil.id('EVT_DISMISS_VIEW'),

    EVT_WILL_OPEN_VIEW: EventTypeUtil.id('EVT_WILL_OPEN_VIEW'),
    EVT_DID_OPEN_VIEW: EventTypeUtil.id('EVT_DID_OPEN_VIEW'),
    EVT_WILL_CLOSE_VIEW: EventTypeUtil.id('EVT_WILL_CLOSE_VIEW'),
    EVT_DID_CLOSE_VIEW: EventTypeUtil.id('EVT_DID_CLOSE_VIEW'),

    EVT_SCENE_ADD_MASKLAYER: EventTypeUtil.id('EVT_SCENE_ADD_MASKLAYER'),
    EVT_SCENE_DEL_MASKLAYER: EventTypeUtil.id('EVT_SCENE_DEL_MASKLAYER'),

    /** 语言切换后派发，payload: { language: ELanguage } */
    EVT_LANGUAGE_CHANGED: EventTypeUtil.id('EVT_LANGUAGE_CHANGED'),

    /** 战斗手牌变更（增删/出牌后）；BattleView 监听刷新 */
    EVT_BATTLE_HAND_CHANGED: EventTypeUtil.id('EVT_BATTLE_HAND_CHANGED'),

    /** 战斗玩家可操作回合变更；payload: { unitId: string | null, slotIndex: number | null } */
    EVT_BATTLE_PLAYER_TURN_CHANGED: EventTypeUtil.id('EVT_BATTLE_PLAYER_TURN_CHANGED'),

    /** 敌人头顶信息变更（HP/脆弱/Buff/元素印记）；BattleView 监听刷新 */
    EVT_BATTLE_ENEMY_INFO_CHANGED: EventTypeUtil.id('EVT_BATTLE_ENEMY_INFO_CHANGED'),

    /** 动画画质切换；payload: { level: AnimQualityLevel } */
    EVT_ANIM_QUALITY_CHANGED: EventTypeUtil.id('EVT_ANIM_QUALITY_CHANGED'),
};
