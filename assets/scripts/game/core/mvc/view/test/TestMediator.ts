import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { LanguageService } from '../../../../i18n/LanguageService';
import { ELanguage } from '../../../../i18n/LanguageType';
import { UIManager } from '../../../../ui/UIManager';
import Strings from '../../../../utils/Strings';
import { AreaViewMediator } from '../../../view/AreaViewMediator';
import { EBattleSide } from 'db://assets/scripts/game/core/mvc/model/battle/EBattleSide';
import { MediatorHandleHelper } from '../../util/MediatorHandleHelper';
import { BattleActionBarTestUtil } from './BattleActionBarTestUtil';
import { BattleSimRunner } from './BattleSimRunner';

/**
 * 测试用区域界面 Mediator。
 * 约定：界面 id `TestView` → `prefab/test/TestLayer`（ui bundle，由 fullPath + TestLayer）。
 */
export class TestMediator extends AreaViewMediator {
    public static fullPath = 'prefab/';

    BtnHandles = {
        ["btn"]: "memoryTest",
    }

    public initialize(..._any: any[]): void { }

    public onRegister(): void {
        super.onRegister();
        this.registerUI();
        this.mapEventListeners();
    }

    registerUI(): void { }

    public mapEventListeners(): void {
        MediatorHandleHelper.setUpBtnHandle(this, this.BtnHandles);
    }

    public enterWithData(_data?: any): void {
        super.enterWithData(_data);
        this.setupView();
    }

    public setupView(_data?: any): void {
        LanguageService.setLanguage(ELanguage.CN);
        console.log(Strings.get("TRANS_HERO_NAME_001"));

        this.testActionBarCanonical();
        BattleSimRunner.run();
    }

    /** 验算 A200/B100/C150/D120/敌90 行动顺序 */
    private testActionBarCanonical(): void {
        const bar = BattleActionBarTestUtil.createCanonicalBar();

        const allyOrder: string[] = [];
        let guard = 0;
        console.log('[ActionBarTest] ========== 经典顺序验算 ==========');
        while (!bar.isAllyRoundComplete() && guard++ < 30) {
            const events = bar.advance();
            if (events.length === 0) {
                break;
            }
            for (const e of events) {
                console.log(`[ActionBarTest] 回合 ${e.side} ${e.unitId} | 剩余 ${bar.debugRemainings()}`);
                if (e.side === EBattleSide.Ally) {
                    if (bar.isAllyRoundComplete()) {
                        break;
                    }
                    bar.markAllyActed(e.slotIndex);
                    allyOrder.push(e.unitId);
                }
            }
        }
        const expected = 'hero_1,hero_3,hero_4,hero_1,hero_2';
        const ok = allyOrder.join(',') === expected;
        console.log(ok ? '[ActionBarTest] ✅ 行动顺序通过' : `[ActionBarTest] ❌ 期望 ${expected} 实际 ${allyOrder.join(',')}`);
    }

    memoryTest() {
        UIManager.gotoView("MainMenuView");
    }
}

ClassConfig.addClass('TestMediator', TestMediator);
