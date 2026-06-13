import { Player } from '../core/mvc/model/Player/Player';
import { SaveGameService } from '../manager/SaveGameService';
import { GMCheatActionRegistry } from './GMCheatActionRegistry';
import { GMCheatService } from './GMCheatService';

/** 注册表里 action 列对应的函数（须在 ConfigReader.init 之后调用） */
export function initGMCheatActions(): void {
    /** 打印秘籍 */
    GMCheatActionRegistry.register('printHelp', () => GMCheatService.printHelp());
    /** 局外：获取全部道具 */
    GMCheatActionRegistry.register('grantAll_out', () => {
        Player.instance.grantAllItems();
        SaveGameService.save();
        console.log('[GM] 已发放局外道具');
    });
    /** 局内：获取冒险全部道具（目前：CardConfig 全部卡牌） */
    GMCheatActionRegistry.register('grantAll_in', () => {
        const result = Player.instance.adventureModel.grantAllAdventureItems();
        SaveGameService.save();
        console.log(`[GM] 已发放冒险道具：新增卡牌 ${result.cards} 张`);
    });
    /** 打印玩家全部数据（内存 + 即将写入存档的结构） */
    GMCheatActionRegistry.register('printPlayerData', () => {
        Player.instance.printPlayerData();
    });
    /** 清空玩家全部数据并重置存档 */
    GMCheatActionRegistry.register('clearPlayerData', () => {
        Player.instance.resetToDefault();
        SaveGameService.save();
        console.log('[GM] 已清空玩家数据');
    });
}
