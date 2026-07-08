import { ConfigReader } from '../../frame/Data/ConfigReader';
import { pairs } from '../../frame/luaCompat/pairs';
import { DevConfig } from '../config/DevConfig';
import { GMCheatActionRegistry } from './GMCheatActionRegistry';

const GM_TABLE = 'GMConfig';

export interface IGMConfigRow {
    id: string;
    description: string;
    action: string;
    params?: unknown;
}

/**
 * 秘籍执行：查 GMConfig。
 * - 整行与 id 完全一致（如 printHelp、delAllRandCard）
 * - 或以首词查表，其余词作为参数（如 addHandCard card_001 3）
 */
export class GMCheatService {
    private static getRowByInput(raw: string): IGMConfigRow | null {
        const id = raw.trim();
        if (!id) return null;

        const direct = ConfigReader.getDataById(GM_TABLE, id);
        if (direct) return direct as IGMConfigRow;

        const table = ConfigReader.getDataTable(GM_TABLE);
        if (!table) return null;

        const lower = id.toLowerCase();
        for (const [key, row] of pairs(table)) {
            if (String(key).toLowerCase() === lower) {
                return row as IGMConfigRow;
            }
        }
        return null;
    }

    static has(raw: string): boolean {
        return this.resolveRow(raw) != null;
    }

    /**
     * 执行秘籍：命中返回 true。
     */
    static execute(raw: string): boolean {
        if (!DevConfig.isGMAllowed()) return false;

        const resolved = this.resolveRow(raw);
        if (resolved == null) {
            const direct = GMCheatActionRegistry.get(raw.trim());
            if (direct) {
                direct();
                return true;
            }
            return false;
        }

        const { row, args } = resolved;
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

        if (args.length > 0) {
            handler(args);
        } else {
            handler(row.params);
        }
        return true;
    }

    static printHelp(): void {
        const table = ConfigReader.getDataTable(GM_TABLE);
        if (!table) {
            console.warn(`[GMCheatService] 未找到配置表 ${GM_TABLE}`);
            return;
        }

        const lines = ['[GM] 可用秘籍（带参数的命令用空格分隔）：'];
        const rows: IGMConfigRow[] = [];
        for (const [_id, row] of pairs(table)) {
            rows.push(row as IGMConfigRow);
        }
        rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

        for (const row of rows) {
            const id = String(row.id ?? '').trim();
            const desc = String(row.description ?? '').trim();
            if (id) lines.push(`  ${id} - ${desc}`);
        }
        console.log(lines.join('\n'));
    }

    private static resolveRow(raw: string): { row: IGMConfigRow; args: string[] } | null {
        const trimmed = raw.trim();
        if (!trimmed) {
            return null;
        }

        const exact = this.getRowByInput(trimmed);
        if (exact != null) {
            return { row: exact, args: [] };
        }

        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length < 2) {
            return null;
        }

        const head = this.getRowByInput(parts[0]);
        if (head == null) {
            return null;
        }
        return { row: head, args: parts.slice(1) };
    }
}
