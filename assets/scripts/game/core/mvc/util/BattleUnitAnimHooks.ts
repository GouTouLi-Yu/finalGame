import { EBattleAnimAction } from '../../../anim/BattleAnimCatalog';
import type { BattleUnitAnimPlayer } from './BattleUnitAnimPlayer';

/**
 * 战斗单位施法动画钩子。
 * 绑定 {@link BattleUnitAnimPlayer} 后真正播；未绑定则只打日志。
 */
export class BattleUnitAnimHooks {
    private static _player: BattleUnitAnimPlayer | null = null;

    static bindPlayer(player: BattleUnitAnimPlayer | null): void {
        this._player = player;
    }

    /** 预备抬手：对敌 1 / 对己 2（资源名未齐前仍走日志） */
    static playPrepRaise(unitId: string, slotIndex: number, towardEnemy: boolean): void {
        const action = towardEnemy ? 'prepRaise1' : 'prepRaise2';
        console.log(`[战场动画] TODO ${action} unit=${unitId} slot=${slotIndex}`);
    }

    static playPrepIdle(unitId: string, slotIndex: number, towardEnemy: boolean = true): void {
        const action = towardEnemy ? 'prepIdle1' : 'prepIdle2';
        console.log(`[战场动画] TODO ${action} unit=${unitId} slot=${slotIndex}`);
    }

    static playPrepCancel(unitId: string, slotIndex: number, towardEnemy: boolean = true): void {
        const action = towardEnemy ? 'prepCancel1' : 'prepCancel2';
        console.log(`[战场动画] TODO ${action} unit=${unitId} slot=${slotIndex}`);
    }

    static playHurt(unitId: string, slotIndex: number): void {
        void this._player?.play(unitId, EBattleAnimAction.Hurt);
    }

    static playDie(unitId: string, slotIndex: number): void {
        void this._player?.play(unitId, EBattleAnimAction.Die);
    }

    static playIdle(unitId: string, _slotIndex: number): void {
        void this._player?.play(unitId, EBattleAnimAction.Idle);
    }
}
