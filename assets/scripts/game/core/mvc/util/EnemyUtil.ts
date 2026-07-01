import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';

const TABLE = 'EnemyConfig';

export class EnemyUtil {
    static getCfg(id: string) {
        return ConfigReader.getDataById(TABLE, id);
    }

    static getSpeed(id: string): number {
        return this.getCfg(id)?.speed ?? 0;
    }
}
