import { Director, Node, ProgressBar, director } from 'cc';
import { BattleFieldModel, IBattleUnitRuntime } from '../model/battle/BattleFieldModel';
import { EBattleSide } from '../model/battle/BattleEnums';
import { EElementType } from '../model/element/ElementType';
import { BuffUtil } from './BuffUtil';
import { ElementUtil } from './ElementUtil';
import { EnemyUtil } from './EnemyUtil';

const ENEMY_SLOT_COUNT = 4;
const BUFF_SHOW_MAX = 4;
const ELEM_SHOW_MAX = 3;
/** 预制体血条节点名 */
const HP_BAR_NAME = 'hpBar';

interface IEnemyInfoSlotNodes {
    slotIndex: number;
    animRoot: Node | null;
    imgRoot: Node | null;
    labelRoot: Node | null;
    dynRoot: Node | null;
    hpBar: ProgressBar | null;
    weakBar: ProgressBar | null;
    buffsImg: Node | null;
    buffDi: Node[];
    buffMoreImg: Node | null;
    elemsImg: Node | null;
    elemMoreImg: Node | null;
    labelBuffs: Node | null;
    buffMoreLabel: Node | null;
    labelElems: Node | null;
    elemMoreLabel: Node | null;
    hpLabel: Node | null;
    buffsDyn: Node | null;
    buffIcon: Node[];
    elemsDyn: Node | null;
    elemIcon: Node[];
}

/**
 * 敌人头顶 UI：img2（静态）/ Label2（文本）/ img3（动态图标）。
 * - Y：buffs = height + touchLayerPos.y；weakBar=+25；hpBar=+10；elems/hp=+16
 * - 槽位根节点 XY 每帧跟随 anim/enemyN
 */
export class BattleEnemyInfoBinder {
    private _slots: IEnemyInfoSlotNodes[] = [];
    private _followBound = false;

    bind(viewRoot: Node): void {
        this.disposeFollow();
        this._slots = [];
        if (viewRoot == null) {
            return;
        }

        const img2 = viewRoot.getChildByName('img2');
        const label2 = viewRoot.getChildByName('Label2');
        const img3 = viewRoot.getChildByName('img3');
        const anim = viewRoot.getChildByName('anim');
        if (img2 == null || label2 == null || img3 == null) {
            console.warn('[敌人信息] 未找到 img2 / Label2 / img3');
            return;
        }

        const imgInfo = img2.getChildByName('enemyInfo');
        const labelInfo = label2.getChildByName('enemyInfo');
        const dynInfo = img3.getChildByName('enemyInfo');
        if (imgInfo == null || labelInfo == null || dynInfo == null) {
            console.warn('[敌人信息] 未找到 enemyInfo');
            return;
        }

        for (let i = 0; i < ENEMY_SLOT_COUNT; i++) {
            const name = `enemy${i + 1}`;
            const imgRoot = imgInfo.getChildByName(name);
            const labelRoot = labelInfo.getChildByName(name);
            const dynRoot = dynInfo.getChildByName(name);
            if (imgRoot == null || labelRoot == null || dynRoot == null) {
                console.warn(`[敌人信息] 缺少节点 ${name}`);
                continue;
            }

            const buffsImg = imgRoot.getChildByName('buffs');
            const elemsImg = imgRoot.getChildByName('elems');
            const labelBuffs = labelRoot.getChildByName('buffs');
            const labelElems = labelRoot.getChildByName('elems');
            const buffsDyn = dynRoot.getChildByName('buffs');
            const elemsDyn = dynRoot.getChildByName('elems');

            const slot: IEnemyInfoSlotNodes = {
                slotIndex: i,
                animRoot: anim?.getChildByName(name) ?? null,
                imgRoot,
                labelRoot,
                dynRoot,
                hpBar: this.getProgress(imgRoot, HP_BAR_NAME),
                weakBar: this.getProgress(imgRoot, 'weakBar'),
                buffsImg,
                buffDi: this.collectNamed(buffsImg, 'di', BUFF_SHOW_MAX),
                buffMoreImg: buffsImg?.getChildByName('more') ?? null,
                elemsImg,
                elemMoreImg: elemsImg?.getChildByName('more') ?? null,
                labelBuffs,
                buffMoreLabel: labelBuffs?.getChildByName('more') ?? null,
                labelElems,
                elemMoreLabel: labelElems?.getChildByName('more') ?? null,
                hpLabel: labelRoot.getChildByName('hp'),
                buffsDyn,
                buffIcon: this.collectNamed(buffsDyn, 'icon', BUFF_SHOW_MAX),
                elemsDyn,
                elemIcon: this.collectNamed(elemsDyn, 'icon', ELEM_SHOW_MAX),
            };
            this.bindMoreClicks(slot);
            this._slots.push(slot);
        }

        this.bindFollow();
    }

    refresh(field: BattleFieldModel | null): void {
        if (this._slots.length === 0) {
            return;
        }
        const bySlot = new Map<number, IBattleUnitRuntime>();
        if (field != null) {
            for (const u of field.units.values()) {
                if (u.side === EBattleSide.Enemy) {
                    bySlot.set(u.slotIndex, u);
                }
            }
        }

        for (const slot of this._slots) {
            const unit = bySlot.get(slot.slotIndex) ?? null;
            this.setSlotActive(slot, unit != null);
            if (unit == null) {
                continue;
            }
            this.layoutVertical(slot, unit.unitId);
            this.applyHpWeak(slot, unit);
            this.applyBuffs(slot, unit);
            this.applyElems(slot, unit);
        }
        this.syncFollowPositions();
    }

    dispose(): void {
        this.disposeFollow();
        this._slots = [];
    }

    private bindFollow(): void {
        if (this._followBound) {
            return;
        }
        director.on(Director.EVENT_AFTER_UPDATE, this.syncFollowPositions, this);
        this._followBound = true;
    }

    private disposeFollow(): void {
        if (!this._followBound) {
            return;
        }
        director.off(Director.EVENT_AFTER_UPDATE, this.syncFollowPositions, this);
        this._followBound = false;
    }

    private syncFollowPositions = (): void => {
        for (const slot of this._slots) {
            const src = slot.animRoot;
            if (src == null || !src.isValid) {
                continue;
            }
            const { x, y, z } = src.position;
            this.setPos(slot.imgRoot, x, y, z);
            this.setPos(slot.labelRoot, x, y, z);
            this.setPos(slot.dynRoot, x, y, z);
        }
    };

    private layoutVertical(slot: IEnemyInfoSlotNodes, unitId: string): void {
        const height = EnemyUtil.getHeight(unitId);
        const touchY = EnemyUtil.getTouchLayerPos(unitId)?.[1] ?? 0;
        const buffsY = height + touchY;
        const weakY = buffsY + 25;
        const hpY = weakY + 10;
        const topY = hpY + 16;

        this.setLocalY(slot.buffsImg, buffsY);
        this.setLocalY(slot.buffsDyn, buffsY);
        this.setLocalY(slot.labelBuffs, buffsY);
        this.setLocalY(slot.weakBar?.node ?? null, weakY);
        this.setLocalY(slot.hpBar?.node ?? null, hpY);
        this.setLocalY(slot.elemsImg, topY);
        this.setLocalY(slot.elemsDyn, topY);
        this.setLocalY(slot.labelElems, topY);
        this.setLocalY(slot.hpLabel, topY);
    }

    private applyHpWeak(slot: IEnemyInfoSlotNodes, unit: IBattleUnitRuntime): void {
        if (slot.hpBar != null) {
            slot.hpBar.progress = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;
        }
        if (slot.weakBar != null) {
            slot.weakBar.progress = unit.maxWeak > 0 ? unit.currentWeak / unit.maxWeak : 0;
        }
        if (slot.hpLabel != null) {
            const pct = unit.maxHp > 0
                ? Math.max(0, Math.round((unit.currentHp / unit.maxHp) * 100))
                : 0;
            slot.hpLabel.setString(`${pct}%`);
        }
    }

    private applyBuffs(slot: IEnemyInfoSlotNodes, unit: IBattleUnitRuntime): void {
        const ids = unit.buffIds;
        const count = ids.length;
        const hasAny = count > 0;
        this.setActive(slot.buffsImg, hasAny);
        this.setActive(slot.buffsDyn, hasAny);
        this.setActive(slot.labelBuffs, hasAny);
        if (!hasAny) {
            return;
        }

        for (let i = 0; i < BUFF_SHOW_MAX; i++) {
            const buffId = ids[i];
            const show = buffId != null;
            this.setActive(slot.buffDi[i] ?? null, show);
            const icon = slot.buffIcon[i];
            this.setActive(icon ?? null, show);
            if (show && icon != null) {
                const path = BuffUtil.getIconPath(buffId);
                if (path != null) {
                    icon.loadTexture(path);
                }
            }
        }

        const moreN = count - BUFF_SHOW_MAX;
        const showMore = moreN > 0;
        this.setActive(slot.buffMoreImg, showMore);
        this.setActive(slot.buffMoreLabel, showMore);
        if (showMore && slot.buffMoreLabel != null) {
            slot.buffMoreLabel.setString(`+${moreN}`);
        }
    }

    private applyElems(slot: IEnemyInfoSlotNodes, unit: IBattleUnitRuntime): void {
        const marks = unit.elementMarks;
        const count = marks.length;
        const hasAny = count > 0;
        this.setActive(slot.elemsImg, hasAny);
        this.setActive(slot.elemsDyn, hasAny);
        this.setActive(slot.labelElems, hasAny);
        if (!hasAny) {
            return;
        }

        for (let i = 0; i < ELEM_SHOW_MAX; i++) {
            const elem = marks[i] as EElementType | undefined;
            const show = elem != null;
            const icon = slot.elemIcon[i];
            this.setActive(icon ?? null, show);
            if (show && icon != null) {
                icon.loadTexture(ElementUtil.getIconPath(elem));
            }
        }

        const moreN = count - ELEM_SHOW_MAX;
        const showMore = moreN > 0;
        this.setActive(slot.elemMoreImg, showMore);
        this.setActive(slot.elemMoreLabel, showMore);
        if (showMore && slot.elemMoreLabel != null) {
            slot.elemMoreLabel.setString(`+${moreN}`);
        }
    }

    private bindMoreClicks(slot: IEnemyInfoSlotNodes): void {
        const onBuffMore = (): void => {
            console.log(`[敌人信息] 点击 buffs/more：enemy${slot.slotIndex + 1}（弹窗待做）`);
        };
        const onElemMore = (): void => {
            console.log(`[敌人信息] 点击 elems/more：enemy${slot.slotIndex + 1}（弹窗待做）`);
        };
        slot.buffMoreImg?.addClickListener(onBuffMore);
        slot.buffMoreLabel?.addClickListener(onBuffMore);
        slot.elemMoreImg?.addClickListener(onElemMore);
        slot.elemMoreLabel?.addClickListener(onElemMore);
    }

    private setSlotActive(slot: IEnemyInfoSlotNodes, active: boolean): void {
        this.setActive(slot.imgRoot, active);
        this.setActive(slot.labelRoot, active);
        this.setActive(slot.dynRoot, active);
    }

    private getProgress(parent: Node, barName: string): ProgressBar | null {
        return parent.getChildByName(barName)?.getComponent(ProgressBar) ?? null;
    }

    private collectNamed(parent: Node | null, prefix: string, max: number): Node[] {
        const out: Node[] = [];
        if (parent == null) {
            return out;
        }
        for (let i = 1; i <= max; i++) {
            const n = parent.getChildByName(`${prefix}${i}`);
            if (n != null) {
                out.push(n);
            }
        }
        return out;
    }

    private setActive(node: Node | null | undefined, active: boolean): void {
        if (node != null && node.isValid) {
            node.active = active;
        }
    }

    private setPos(node: Node | null | undefined, x: number, y: number, z: number): void {
        if (node == null || !node.isValid) {
            return;
        }
        const p = node.position;
        if (p.x === x && p.y === y && p.z === z) {
            return;
        }
        node.setPosition(x, y, z);
    }

    private setLocalY(node: Node | null | undefined, y: number): void {
        if (node == null || !node.isValid) {
            return;
        }
        const p = node.position;
        if (p.y === y) {
            return;
        }
        node.setPosition(p.x, y, p.z);
    }
}
