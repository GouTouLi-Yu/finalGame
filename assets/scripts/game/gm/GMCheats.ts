import { Player } from '../core/mvc/model/Player/Player';
import { GMCheatActionRegistry } from './GMCheatActionRegistry';
import { GMCheatService } from './GMCheatService';

/** 注册表里 action 列对应的函数（须在 ConfigReader.init 之后调用） */
export function initGMCheatActions(): void {
    /** 打印秘籍 */
    GMCheatActionRegistry.register('printHelp', () => GMCheatService.printHelp());
    /** 获取全部物品 */
    GMCheatActionRegistry.register('grantAll', () => Player.instance.grantAll());
}
