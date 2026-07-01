import { BattleActionBarModel } from '../../model/battle/BattleActionBarModel';

/** 跑条经典验算用（不放在生产 Model API 里） */
export class BattleActionBarTestUtil {
    static createCanonicalBar(): BattleActionBarModel {
        const bar = new BattleActionBarModel();
        bar.initForTest(
            [
                { slotIndex: 0, unitId: 'hero_1', speed: 200 },
                { slotIndex: 1, unitId: 'hero_2', speed: 100 },
                { slotIndex: 2, unitId: 'hero_3', speed: 150 },
                { slotIndex: 3, unitId: 'hero_4', speed: 120 },
            ],
            [{ slotIndex: 0, unitId: 'enemy_1', speed: 90 }],
        );
        return bar;
    }
}
