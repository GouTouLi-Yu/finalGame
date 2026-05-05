import { Player } from '../core/mvc/model/Player/Player';
import { PlayerSaveData, SAVE_VERSION } from '../save/PlayerSaveData';
import { DataStoreUtil } from '../utils/DataStoreUtil';

/** 与 DataStoreUtil 使用的本地存储键一致 */
export const PLAYER_SAVE_STORAGE_KEY = 'game_Endless_Dark_Dungeon_player_save';

/**
 * 玩家存档（静态类）：读写磁盘 JSON，内部委托 {@link DataStoreUtil}。
 * 示例：`SaveGameService.save(Player.instance.toSaveData())`
 */
export class SaveGameService {
    private constructor() { }

    static hasSave(): boolean {
        return this.load() != null;
    }

    /**
     * 解析失败、缺少合法 version、或与 {@link SAVE_VERSION} 不一致时移除本地条目并返回 null。
     */
    static load(): PlayerSaveData | null {
        const raw = DataStoreUtil.loadData<PlayerSaveData>(PLAYER_SAVE_STORAGE_KEY);
        if (raw == null) {
            if (DataStoreUtil.hasData(PLAYER_SAVE_STORAGE_KEY)) {
                DataStoreUtil.removeData(PLAYER_SAVE_STORAGE_KEY);
                console.warn('[SaveGameService] 已移除无法解析的存档');
            }
            return null;
        }
        if (typeof raw.version !== 'number' || raw.version !== SAVE_VERSION) {
            DataStoreUtil.removeData(PLAYER_SAVE_STORAGE_KEY);
            console.log('[SaveGameService] 已清理与当前版本不符的旧存档');
            return null;
        }
        return raw;
    }

    static save(): void {
        const data = Player.instance.getSaveData();
        DataStoreUtil.saveData(PLAYER_SAVE_STORAGE_KEY, data);
    }

    static deleteSave(): void {
        DataStoreUtil.removeData(PLAYER_SAVE_STORAGE_KEY);
    }
}
