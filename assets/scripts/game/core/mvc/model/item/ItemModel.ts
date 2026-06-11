import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { IItemSaveData } from 'db://assets/scripts/game/save/PlayerSaveData';
import { Model } from '../Model';

/** 玩家道具背包（秘籍 god 等会写入此 Model） */
export class ItemModel extends Model {
    private _ownedIds = new Set<string>();

    get ownedIds(): ReadonlySet<string> {
        return this._ownedIds;
    }

    addItem(id: string): void {
        if (!id) return;
        this._ownedIds.add(id);
    }

    hasItem(id: string): boolean {
        return this._ownedIds.has(id);
    }

    getAllItemIds(): string[] {
        return Array.from(this._ownedIds);
    }

    synchronize(data: IItemSaveData | null | undefined): void {
        this._ownedIds.clear();
        if (data?.items != null) {
            for (const id of data.items) {
                if (id) this._ownedIds.add(id);
            }
        }
    }

    getSaveData(): IItemSaveData {
        return { items: this.getAllItemIds() };
    }

    resetToDefault(): void {
        this._ownedIds.clear();
    }
}

ClassConfig.addClass('ItemModel', ItemModel);
