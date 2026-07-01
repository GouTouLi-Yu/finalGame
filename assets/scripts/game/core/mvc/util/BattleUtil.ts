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

    /** 进冒险选角：initRandAttrs.speed 范围内均匀随机整数 */
    static rollInitSpeed(): number {
        const content = this.get("initRandAttrs") as { speed?: [number, number] } | undefined;
        const range = content?.speed;
        if (range == null || range.length < 2) {
            return 100;
        }
        const min = Math.min(range[0], range[1]);
        const max = Math.max(range[0], range[1]);
        return Math.floor(min + Math.random() * (max - min + 1));
    }
}


