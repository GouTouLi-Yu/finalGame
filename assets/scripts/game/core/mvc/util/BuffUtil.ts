import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';

const TABLE = 'BuffConfig';
const BUFF_ASSET_DIR = 'asset/buff';

export interface IBuffConfigRow {
    id: string;
    iconName?: string;
    name?: string;
}

/** BuffConfig 读取与图标路径 */
export class BuffUtil {
    static getCfg(id: string): IBuffConfigRow | null {
        const key = typeof id === 'string' ? id.trim() : '';
        if (!key) {
            return null;
        }
        return ConfigReader.getDataById(TABLE, key) as IBuffConfigRow | null;
    }

    static getIconName(id: string): string {
        const raw = this.getCfg(id)?.iconName;
        const name = raw != null ? String(raw).trim() : '';
        return name !== '' ? name : id;
    }

    /** ui bundle：asset/buff/{iconName} */
    static getIconPath(id: string): string | null {
        const name = this.getIconName(id);
        return name !== '' ? `${BUFF_ASSET_DIR}/${name}` : null;
    }
}
