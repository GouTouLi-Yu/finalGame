import { ConfigReader } from 'db://assets/scripts/frame/Data/ConfigReader';

const TABLE = 'HeroBase';
const BATTLE_SEQ_AVATAR_DIR = 'asset/avatar/character';

export interface IHeroTouchLayer {
    width: number;
    height: number;
    x: number;
    y: number;
}

export class HeroUtil {
    static getCfg(id: string) {
        return ConfigReader.getDataById(TABLE, id);
    }

    static getNameKey(id: string): string {
        return this.getCfg(id)?.name ?? id;
    }

    /** 战斗动画目录名：character|enemy/{animPath}/battle/... */
    static getAnimPath(id: string): string {
        const raw = this.getCfg(id)?.animPath;
        const path = raw != null ? String(raw).trim() : '';
        return path !== '' ? path : id;
    }

    /** 跑条头像资源名（HeroBase.battleSeqAvatar） */
    static getBattleSeqAvatar(id: string): string {
        const raw = this.getCfg(id)?.battleSeqAvatar;
        return raw != null ? String(raw).trim() : '';
    }

    /** ui bundle：asset/avatar/character/{battleSeqAvatar} */
    static getBattleSeqAvatarPath(id: string): string | null {
        const name = this.getBattleSeqAvatar(id);
        return name !== '' ? `${BATTLE_SEQ_AVATAR_DIR}/${name}` : null;
    }

    /** touchLayer 宽高 [w, h] */
    static getTouchLayerSize(id: string): readonly [number, number] | null {
        return this.parseVec2(this.getCfg(id)?.touchLayerSize);
    }

    /** touchLayer 本地坐标 [x, y] */
    static getTouchLayerPos(id: string): readonly [number, number] | null {
        return this.parseVec2(this.getCfg(id)?.touchLayerPos);
    }

    static getTouchLayer(id: string): IHeroTouchLayer | null {
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
