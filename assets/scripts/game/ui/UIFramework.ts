import { EventDispatcher } from '../../frame/event/EventDispatcher';
import { Injector } from '../../frame/Injector/Injector';
import { LocalizedTextBinder } from '../i18n/LocalizedTextBinder';
import { MediatorMap } from '../map/MediatorMap';

/**
 * 注册 UI 框架依赖的全局对象到 Injector（对齐 k：SharedEventDispatcher + MediatorMap）
 * 必须在创建任何 Mediator 之前调用。
 */
export function initUiFramework() {
    const ed = new EventDispatcher();
    Injector.shared.mapValue('SharedEventDispatcher', ed);

    const mm = new MediatorMap();
    mm.injector = Injector.shared;
    Injector.shared.mapValue('MediatorMap', mm);

    LocalizedTextBinder.init();
}
