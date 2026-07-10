/** {@link PCEventType.EVT_BATTLE_PLAYER_TURN_CHANGED} payload */
export interface IBattlePlayerTurnChangedPayload {
    unitId: string | null;
    slotIndex: number | null;
}
