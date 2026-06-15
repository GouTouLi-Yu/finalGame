import { ConfigReader } from "db://assets/scripts/frame/Data/ConfigReader";

export class BattleUtil {
    private static get(id: string): any {
        return ConfigReader.getValue(id);
    }

    /** 跑道长度 10000米 */
    static get battleTrackLength(): number {
        return this.get("battleTrackLength");
    }

    /** 初始手牌数量 */
    static get battleInitialHandSize(): number {
        return this.get("battleInitialHandSize");
    }

    /** 角色每回合摸牌数量 */
    static get battleDrawPerUnitTurn(): number {
        return this.get("battleDrawPerUnitTurn");
    }

    /** 轮次结束补牌数量 */
    static get battleRoundStartHandSize(): number {
        return this.get("battleRoundStartHandSize");
    }

    /** 每回合重发的魔力点 */
    static get battleManaPerRound(): number {
        return this.get("battleManaPerRound");
    }

    /** 最大手牌数量 */
    static get maxCardNum(): number {
        return this.get("maxCardNum");
    }
}


