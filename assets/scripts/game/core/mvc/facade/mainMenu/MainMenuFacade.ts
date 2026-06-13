import Facade from 'db://assets/scripts/frame/base/Facade';
import { ClassConfig } from 'db://assets/scripts/frame/Injector/ClassConfig';
import { GameManager } from '../../../../manager/GameManager';
import { SaveGameService } from '../../../../manager/SaveGameService';
import { Player } from '../../model/Player/Player';

export class MainMenuFacade extends Facade {
    opStartNewGame(): void {
        SaveGameService.deleteSave();
        Player.instance.resetToDefault();
        SaveGameService.save();
        Player.instance.printPlayerData();
        GameManager.instance.enterGameplay();
    }

    opStartContinue(): void {
        const data = SaveGameService.load();
        if (data == null) {
            console.warn('[MainMenuFacade] 无存档或存档损坏');
            return;
        }
        Player.instance.synchronize(data);
        Player.instance.printPlayerData();
        GameManager.instance.enterGameplay();
    }
}

ClassConfig.addClass('MainMenuFacade', MainMenuFacade);
