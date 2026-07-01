import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';

const TABLE = 'ArmyConfig';

export class ArmyUtil {
    static getCfg(id: string) {
        return ConfigReader.getDataById(TABLE, id);
    }

    /** ArmyConfig.enemyIds（兼容导表多余的方括号） */
    static getEnemyIds(armyId: string): string[] {
        const raw = this.getCfg(armyId)?.enemyIds;
        return this.normalizeIdList(raw);
    }

    private static normalizeIdList(raw: unknown): string[] {
        if (!Array.isArray(raw)) {
            return [];
        }
        const ids: string[] = [];
        const seen = new Set<string>();
        for (const item of raw) {
            const id = String(item).replace(/^\[+/, '').replace(/\]+$/, '').trim();
            if (id && !seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
        }
        return ids;
    }
}
