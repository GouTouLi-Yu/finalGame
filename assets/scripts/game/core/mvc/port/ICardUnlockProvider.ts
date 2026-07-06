/** 卡牌是否已解锁（随机加牌等用；正式系统接入后替换实现） */
export interface ICardUnlockProvider {
    isUnlocked(cardId: string): boolean;
    getUnlockedCardIds(): readonly string[];
}

/** 开发期：配表内卡牌均视为已解锁 */
export class DevAllCardUnlockProvider implements ICardUnlockProvider {
    private readonly _ids: () => readonly string[];

    constructor(getIds: () => readonly string[]) {
        this._ids = getIds;
    }

    isUnlocked(cardId: string): boolean {
        return this._ids().includes(cardId);
    }

    getUnlockedCardIds(): readonly string[] {
        return this._ids();
    }
}
