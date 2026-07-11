import { EBattleAnimAction } from '../../../anim/BattleAnimCatalog';
import type { BattleUnitAnimPlayer } from './BattleUnitAnimPlayer';

/**
 * 拖牌：prepStart（1次）→ prepIdle（循环）
 * 打出成功：usingMagic（1次）→ idle（循环）
 * 收回/失败：prepBack（1次）→ idle（循环）
 */
export class BattleUnitAnimHooks {
    private static _player: BattleUnitAnimPlayer | null = null;

    static bindPlayer(player: BattleUnitAnimPlayer | null): void {
        this._player = player;
    }

    static playPrepStartChain(unitId: string, _slotIndex: number, _towardEnemy: boolean): void {
        if (this._player == null) {
            console.warn('[战场动画] player 未绑定，无法播 prepStart');
            return;
        }
        console.log(`[战场动画] 拖牌 prepStart→prepIdle unit=${unitId}`);
        void this._player.playThen(unitId, EBattleAnimAction.PrepStart, EBattleAnimAction.PrepIdle);
    }

    static playPrepRaise(unitId: string, slotIndex: number, towardEnemy: boolean): void {
        this.playPrepStartChain(unitId, slotIndex, towardEnemy);
    }

    static playPrepIdle(unitId: string, _slotIndex: number, _towardEnemy: boolean = true): void {
        void this._player?.play(unitId, EBattleAnimAction.PrepIdle);
    }

    static playPrepBack(unitId: string, _slotIndex: number, _towardEnemy: boolean = true): void {
        if (this._player == null) {
            console.warn('[战场动画] player 未绑定，无法播 prepBack');
            return;
        }
        console.log(`[战场动画] 收回 prepBack→idle unit=${unitId}`);
        void this._player.playThen(unitId, EBattleAnimAction.PrepBack, EBattleAnimAction.Idle);
    }

    static playPrepCancel(unitId: string, slotIndex: number, towardEnemy: boolean = true): void {
        this.playPrepBack(unitId, slotIndex, towardEnemy);
    }

    static playUsingMagic(unitId: string, _slotIndex: number): void {
        if (this._player == null) {
            console.warn('[战场动画] player 未绑定，无法播 usingMagic');
            return;
        }
        console.log(`[战场动画] 出牌 usingMagic→idle unit=${unitId}`);
        void this._player.playThen(unitId, EBattleAnimAction.UsingMagic, EBattleAnimAction.Idle);
    }

    /** @deprecated 使用 {@link playUsingMagic} */
    static playOther1(unitId: string, slotIndex: number): void {
        this.playUsingMagic(unitId, slotIndex);
    }

    static playHurt(unitId: string, _slotIndex: number): void {
        void this._player?.play(unitId, EBattleAnimAction.Hurt);
    }

    static playDie(unitId: string, _slotIndex: number): void {
        void this._player?.play(unitId, EBattleAnimAction.Die);
    }

    static playIdle(unitId: string, _slotIndex: number): void {
        void this._player?.play(unitId, EBattleAnimAction.Idle);
    }
}
