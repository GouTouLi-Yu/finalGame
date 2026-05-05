import { ClassConfig } from "db://assets/scripts/frame/Injector/ClassConfig";
import { EComponentType, IComponent } from "./ComponentType";

export class HpComponent implements IComponent {
    readonly type: EComponentType.hp = EComponentType.hp;
    private _maxHp: number;
    get maxHp(): number {
        return this._maxHp;
    }

    private _currentHp: number;
    get currentHp(): number {
        return this._currentHp;
    }

    private _isAlive: boolean;
    get isAlive(): boolean {
        return this._isAlive;
    }

    constructor(maxHp: number) {
        this._maxHp = maxHp;
        this._currentHp = maxHp;
        this._isAlive = true;
    }

    /** 掉血 */
    takeDamage(damage: number) {
        let actualDamage = Math.max(damage, 0);
        this._currentHp -= actualDamage;
        if (this._currentHp <= 0) {
            this._currentHp = 0;
            this._isAlive = false;
        }
        return {
            damageValue: actualDamage,
            isAlive: this._isAlive,
            remainHp: this._currentHp,
        }
    }

    /** 回血 */
    heal(healValue: number) {
        let actualAmount = Math.max(healValue, 0);
        this._currentHp += healValue;
        return {
            healValue: actualAmount,
            isAlive: this._isAlive,
            remainHp: this._currentHp,
        };
    }

    /** 死亡 */
    die() {
        if (!this._isAlive) {
            return;
        }
        this._isAlive = false;
        this._currentHp = 0;
    }

    /** 复活 */
    revive(hpRecoverPercentage: number = 1) {
        if (this._isAlive) {
            return;
        }
        this._currentHp = this._maxHp * Math.min(Math.max(hpRecoverPercentage, 0), 1);
        this._isAlive = true;
    }

    serialize(): any {
        /*return {
            maxHp: this._maxHp,
            currentHp: this._currentHp,
            isAlive: this._isAlive,
        };*/
        return null;
    }

    deserialize(): any {
        /*return {
            maxHp: this._maxHp,
            currentHp: this._currentHp,
            isAlive: this._isAlive,
        };*/
        return null;
    }
}
ClassConfig.addClass("HpComponent", HpComponent);