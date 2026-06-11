import { ConfigReader } from '../../frame/Data/ConfigReader';
import { pairs } from '../../frame/luaCompat/pairs';
import { DevConfig } from '../config/DevConfig';
import { GMCheatActionRegistry } from './GMCheatActionRegistry';

const GMCHEAT_TABLE = 'GMCheatConfig';

export interface IGMCheatConfigRow {
    id: string;
    description: string;
    action: string;
    params?: unknown;
}

/**
 * 秘籍执行：表里 id = 玩家输入，action = 要调用的函数名。
 */
export class GMCheatService {
    private static normalizeId(raw: string): string {
        return raw.trim().toLowerCase();
    }

    private static getRowByInput(raw: string): IGMCheatConfigRow | null {
        const id = this.normalizeId(raw);
        if (!id) return null;

        const row = ConfigReader.getDataById(GMCHEAT_TABLE, id);
        if (!row) return null;

        return row as IGMCheatConfigRow;
    }

    static has(raw: string): boolean {
        return this.getRowByInput(raw) != null;
    }

    /**
     * 执行秘籍：按输入查表 id → 取 action → 调用注册函数。命中返回 true。
     */
    static execute(raw: string): boolean {
        if (!DevConfig.isGMAllowed()) return false;

        const row = this.getRowByInput(raw);
        if (!row) return false;

        const action = String(row.action ?? '').trim();
        if (!action) {
            console.warn(`[GMCheatService] 秘籍 ${row.id} 未配置 action`);
            return false;
        }

        const handler = GMCheatActionRegistry.get(action);
        if (!handler) {
            console.warn(`[GMCheatService] 秘籍 ${row.id} 的 action「${action}」未注册`);
            return false;
        }

        handler(row.params);
        return true;
    }

    static printHelp(): void {
        const table = ConfigReader.getDataTable(GMCHEAT_TABLE);
        if (!table) {
            console.warn(`[GMCheatService] 未找到配置表 ${GMCHEAT_TABLE}`);
            return;
        }

        const lines = ['[GM] 可用秘籍：'];
        const rows: IGMCheatConfigRow[] = [];
        for (const [_id, row] of pairs(table)) {
            rows.push(row as IGMCheatConfigRow);
        }
        rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

        for (const row of rows) {
            const id = String(row.id ?? '').trim();
            const desc = String(row.description ?? '').trim();
            if (id) lines.push(`  ${id} - ${desc}`);
        }
        console.log(lines.join('\n'));
    }
}
