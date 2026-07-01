import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';
import { EChooseTarget } from '../model/battle/EChooseTarget';

const TABLE = 'ActionConfig';

export class ActionUtil {
    static getCfg(actionId: string) {
        return ConfigReader.getDataById(TABLE, actionId);
    }

    static getChooseTarget(actionId: string): EChooseTarget {
        const raw = String(this.getCfg(actionId)?.chooseTarget ?? 'none').trim().toLowerCase();
        if (raw === EChooseTarget.Enemy) {
            return EChooseTarget.Enemy;
        }
        if (raw === EChooseTarget.Self) {
            return EChooseTarget.Self;
        }
        return EChooseTarget.None;
    }

    static getChooseTargetForCard(cardId: string, actionId: string): EChooseTarget {
        if (!actionId) {
            return EChooseTarget.None;
        }
        return this.getChooseTarget(actionId);
    }
}
