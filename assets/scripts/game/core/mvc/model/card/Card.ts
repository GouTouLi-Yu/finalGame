
/** 冒险/战斗中的卡牌实例（配置见 CardConfig；instanceId 仅运行时，不存档） */
export class Card {
    private _id: string;
    get id(): string {
        return this._id;
    }
    private _level: number;
    get level(): number {
        return this._level;
    }

    constructor(id: string, level: number) {
        this._id = id;
        this._level = level;
    }
}
