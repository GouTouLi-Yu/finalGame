import { EBattleAnimAction } from '../../../anim/BattleAnimCatalog';
import type { BattleUnitAnimPlayer } from './BattleUnitAnimPlayer';

/**
 * 拖牌：prepStart → prepIdle
 * 打出：usingMagic → idle
 * 收回：prepBack → idle
 */
export class BattleUnitAnimHooks {
    private static _player: BattleUnitAnimPlayer | null = null;

    static bindPlayer(player: BattleUnitAnimPlayer | null): void {
        this._player = player;
    }

    static playPrepStartChain(unitId: string): void {
        if (this._player == null) {
            return;
        }
        void this._player.playThen(unitId, EBattleAnimAction.PrepStart, EBattleAnimAction.PrepIdle);
    }

    static playPrepBack(unitId: string): void {
        if (this._player == null) {
            return;
        }
        void this._player.playThen(unitId, EBattleAnimAction.PrepBack, EBattleAnimAction.Idle);
    }

    static playUsingMagic(unitId: string): void {
        if (this._player == null) {
            return;
        }
        void this._player.playThen(unitId, EBattleAnimAction.UsingMagic, EBattleAnimAction.Idle);
    }

    static playHurt(unitId: string): void {
        void this._player?.play(unitId, EBattleAnimAction.Hurt);
    }

    static playDie(unitId: string): void {
        void this._player?.play(unitId, EBattleAnimAction.Die);
    }

    static playIdle(unitId: string): void {
        void this._player?.play(unitId, EBattleAnimAction.Idle);
    }
}
