import { Card } from '../model/card/Card';
import { AdventureDeployModel } from '../model/adventure/AdventureDeployModel';

/** 冒险层 ↔ 战斗层 卡牌/编队端口（解耦 Facade 与 Player 单例） */
export interface IAdventureBattlePort {
    takeCardsForBattle(): Card[];
    restoreCardsFromBattle(cards: Card[]): void;
    getDeployModel(): AdventureDeployModel;
}
