import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';

const TABLE = 'EnemyConfig';
const BATTLE_SEQ_AVATAR_DIR = 'asset/avatar/enemy';

export interface IEnemyTouchLayer {
    width: number;
    height: number;
    x: number;
    y: number;
}

export class EnemyUtil {
    /** 实例 ID（enemy_1#0）→ 配置 ID（enemy_1） */
    static toConfigId(unitId: string): string {
        const i = unitId.lastIndexOf('#');
        return i >= 0 ? unitId.slice(0, i) : unitId;
    }

    static getCfg(id: string) {
        return ConfigReader.getDataById(TABLE, this.toConfigId(id));
    }

    static getSpeed(id: string): number {
        return this.getCfg(id)?.speed ?? 0;
    }

    /** 最大生命（EnemyConfig.hp） */
    static getHp(id: string): number {
        const n = Number(this.getCfg(id)?.hp);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    /** 最大脆弱值（EnemyConfig.weak）；满条 progress=1 */
    static getWeak(id: string): number {
        const n = Number(this.getCfg(id)?.weak);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    /** 身高（EnemyConfig.height）；头顶 UI：buffs.y = height + touchLayerPos.y */
    static getHeight(id: string): number {
        const n = Number(this.getCfg(id)?.height);
        return Number.isFinite(n) ? n : 0;
    }

    /** 战斗动画目录名：character|enemy/{animPath}/battle/...；unitId 可为实例 ID */
    static getAnimPath(id: string): string {
        const raw = this.getCfg(id)?.animPath;
        const path = raw != null ? String(raw).trim() : '';
        return path !== '' ? path : id;
    }

    /** 跑条头像资源名（EnemyConfig.battleSeqAvatar） */
    static getBattleSeqAvatar(id: string): string {
        const raw = this.getCfg(id)?.battleSeqAvatar;
        return raw != null ? String(raw).trim() : '';
    }

    /** ui bundle：asset/avatar/enemy/{battleSeqAvatar} */
    static getBattleSeqAvatarPath(id: string): string | null {
        const name = this.getBattleSeqAvatar(id);
        return name !== '' ? `${BATTLE_SEQ_AVATAR_DIR}/${name}` : null;
    }

    static getTouchLayerSize(id: string): readonly [number, number] | null {
        return this.parseVec2(this.getCfg(id)?.touchLayerSize);
    }

    static getTouchLayerPos(id: string): readonly [number, number] | null {
        return this.parseVec2(this.getCfg(id)?.touchLayerPos);
    }

    static getTouchLayer(id: string): IEnemyTouchLayer | null {
        const size = this.getTouchLayerSize(id);
        const pos = this.getTouchLayerPos(id);
        if (size == null && pos == null) {
            return null;
        }
        return {
            width: size?.[0] ?? 0,
            height: size?.[1] ?? 0,
            x: pos?.[0] ?? 0,
            y: pos?.[1] ?? 0,
        };
    }

    private static parseVec2(raw: unknown): readonly [number, number] | null {
        if (!Array.isArray(raw) || raw.length < 2) {
            return null;
        }
        const x = Number(raw[0]);
        const y = Number(raw[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        return [x, y];
    }
}
