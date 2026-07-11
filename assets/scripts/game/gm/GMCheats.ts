import { Player } from '../core/mvc/model/Player/Player';
import { LanguageService } from '../i18n/LanguageService';
import { getLanguageNativeName } from '../i18n/LanguageType';
import { SaveGameService } from '../manager/SaveGameService';
import { BattleGMCheatService } from './BattleGMCheatService';
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
    /** 切换语言（循环：简中 → 繁中 → 英 → 日 → 韩） */
    GMCheatActionRegistry.register('cycleLang', () => {
        const next = LanguageService.cycleLanguage();
        console.log(`[GM] 当前语言: ${next} (${getLanguageNativeName(next)})`);
    });

    /** 战斗手牌（GMConfig 首词 + 空格参数；需在 BattleView） */
    GMCheatActionRegistry.register('addHandCard', (args) => BattleGMCheatService.addHandCard(args));
    GMCheatActionRegistry.register('addRandHandCard', (args) => BattleGMCheatService.addRandHandCard(args));
    GMCheatActionRegistry.register('delRandCardByPos', (args) => BattleGMCheatService.delRandCardByPos(args));
    GMCheatActionRegistry.register('delAllRandCard', () => BattleGMCheatService.delAllRandCard());
    GMCheatActionRegistry.register('delRndCardById', (args) => BattleGMCheatService.delRndCardById(args));

    /** 战斗抽牌堆 / 摸牌 / 弃牌 / 魔力 */
    GMCheatActionRegistry.register('addDrawCard', (args) => BattleGMCheatService.addDrawCard(args));
    GMCheatActionRegistry.register('addRandDrawCard', (args) => BattleGMCheatService.addRandDrawCard(args));
    GMCheatActionRegistry.register('clearDrawPile', () => BattleGMCheatService.clearDrawPile());
    GMCheatActionRegistry.register('drawCards', (args) => BattleGMCheatService.drawCards(args));
    GMCheatActionRegistry.register('addDiscardCard', (args) => BattleGMCheatService.addDiscardCard(args));
    GMCheatActionRegistry.register('recycleDiscard', () => BattleGMCheatService.recycleDiscard());
    GMCheatActionRegistry.register('shuffleDraw', () => BattleGMCheatService.shuffleDraw());
    GMCheatActionRegistry.register('setMana', (args) => BattleGMCheatService.setMana(args));
    GMCheatActionRegistry.register('addMana', (args) => BattleGMCheatService.addMana(args));
    GMCheatActionRegistry.register('printDeck', () => BattleGMCheatService.printDeck());
}
