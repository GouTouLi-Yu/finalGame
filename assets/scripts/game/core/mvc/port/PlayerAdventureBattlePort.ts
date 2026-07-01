import { Card } from '../model/card/Card';
import { Player } from '../model/Player/Player';
import { IAdventureBattlePort } from './IAdventureBattlePort';

/** 默认端口：经 Player 读写冒险卡牌与编队 */
export class PlayerAdventureBattlePort implements IAdventureBattlePort {
    takeCardsForBattle(): Card[] {
        return Player.instance.adventureModel.cardModel.takeAllCardsForBattle();
    }

    restoreCardsFromBattle(cards: Card[]): void {
        Player.instance.adventureModel.cardModel.restoreFromBattle(cards);
    }

    getDeployModel() {
        return Player.instance.adventureModel.deployModel;
    }
}
