import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';

const TABLE = 'ArmyConfig';

export class ArmyUtil {
    static getCfg(id: string) {
        return ConfigReader.getDataById(TABLE, id);
    }

    /** ArmyConfig.enemyIds（配置 ID，可重复；兼容导表多余的方括号） */
    static getEnemyIds(armyId: string): string[] {
        const raw = this.getCfg(armyId)?.enemyIds;
        return this.normalizeIdList(raw);
    }

    /** 战场实例 ID：同配置多只怪用 configId#slotIndex 区分 */
    static makeEnemyInstanceId(configId: string, slotIndex: number): string {
        return `${configId}#${slotIndex}`;
    }

    private static normalizeIdList(raw: unknown): string[] {
        if (!Array.isArray(raw)) {
            return [];
        }
        const ids: string[] = [];
        for (const item of raw) {
            const id = String(item).replace(/^\[+/, '').replace(/\]+$/, '').trim();
            if (id) {
                ids.push(id);
            }
        }
        return ids;
    }
}
