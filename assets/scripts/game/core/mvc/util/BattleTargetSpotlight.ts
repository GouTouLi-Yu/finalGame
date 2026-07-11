import {
    _decorator,
    Color,
    Component,
    Graphics,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import { AnimQualityLevel } from '../../../anim/AnimQualityLevel';
import { AnimQualityService } from '../../../anim/AnimQualityService';
import { EBattleSide } from '../model/battle/BattleEnums';
import { getAimFxBudget, type IAimFxBudget } from './BattleAimFxQuality';

const { ccclass } = _decorator;

/** 非亮起单位压暗（单位在暗幕之上，可略压暗以拉开对比） */
const UNIT_DIM_OPACITY = 110;
const UNIT_HOST_NAME = /^(character|enemy)\d+$/;

interface IFairyMote {
    u: number; // 0顶→1底
    side: number;
    speed: number;
    size: number;
    phase: number;
    hue: number;
    kind: number; // 0星芒 1碎晶 2花粉 3花瓣 4飘带点
    spin: number;
}

/**
 * 舞台追光：
 * - 暗幕 + 光带/雾/光池：anim 之下（不压住角色）
 * - 准星标记/星尘：anim 之上
 * - 非目标降透明；绝不 setParent 抬单位
 * - 随 AnimQuality 高/中/低三档调节密度与三角形量
 */
@ccclass('BattleTargetSpotlight')
export class BattleTargetSpotlight extends Component {
    private _gVeil!: Graphics;
    private _gFog!: Graphics;
    private _gMark!: Graphics;
    private _gBeam!: Graphics;
    private _gPool!: Graphics;
    private _gSpark!: Graphics;
    /** anim 之下：暗幕 + 光带/雾/光池 */
    private _underRoot: Node | null = null;

    private _active = false;
    private _t = 0;
    private _veilDrop = 0;
    private _beamDrop = 0;
    private _focusTouch: Node | null = null;
    private _focusSide: EBattleSide | null = null;
    private _casterTouch: Node | null = null;
    private _quality: AnimQualityLevel = AnimQualityLevel.High;
    private _budget: IAimFxBudget = getAimFxBudget(AnimQualityLevel.High);
    private readonly _eligibleTouches: Node[] = [];
    private readonly _dimmedHosts: Node[] = [];
    private readonly _motes: IFairyMote[] = [];
    /** 上次亮起名单签名，避免每帧重复 setOpacity */
    private _brightSig = '';

    private readonly _tmp = new Color();
    private readonly _cA = new Color();
    private readonly _cB = new Color();
    private readonly _world = new Vec3();
    private readonly _local = new Vec3();
    private readonly _touchLocal = new Vec3();

    static ensure(viewRoot: Node): BattleTargetSpotlight {
        const existing = viewRoot.getChildByName('StageSpotlight');
        const comp = existing?.getComponent(BattleTargetSpotlight);
        if (comp != null) {
            return comp;
        }
        const n = new Node('StageSpotlight');
        n.layer = viewRoot.layer;
        const vut = viewRoot.getComponent(UITransform);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(vut?.width ?? 2560, vut?.height ?? 1440);
        ut.setAnchorPoint(vut?.anchorX ?? 0.5, vut?.anchorY ?? 0.5);
        n.setPosition(0, 0, 0);
        viewRoot.addChild(n);
        const fx = n.addComponent(BattleTargetSpotlight);
        fx.buildLayers();
        fx.pinLayers();
        n.active = false;
        return fx;
    }

    /**
     * 下层（暗幕/光带）：anim 之前；上层（标记）：anim 之后、手牌之前。
     * 仅在层级不对时改 sibling，避免拖牌每帧闪烁。
     */
    private pinLayers(): void {
        const viewRoot = this.node.parent;
        if (viewRoot == null) {
            return;
        }
        const anim = viewRoot.getChildByName('anim');
        const card = viewRoot.getChildByName('card');
        const layer = viewRoot.getChildByName('Layer');
        const underRoot = this.ensureUnderRoot();

        if (anim != null) {
            if (underRoot.getSiblingIndex() !== anim.getSiblingIndex() - 1) {
                underRoot.setSiblingIndex(anim.getSiblingIndex());
            }
            if (this.node.getSiblingIndex() !== anim.getSiblingIndex() + 1) {
                this.node.setSiblingIndex(anim.getSiblingIndex() + 1);
            }
            return;
        }
        const cardIdx = card?.getSiblingIndex();
        const layerIdx = layer?.getSiblingIndex();
        const handIdx = cardIdx != null && layerIdx != null
            ? Math.min(cardIdx, layerIdx)
            : (cardIdx ?? layerIdx);
        if (handIdx != null) {
            const wantUnder = Math.max(0, handIdx - 1);
            if (underRoot.getSiblingIndex() !== wantUnder) {
                underRoot.setSiblingIndex(wantUnder);
            }
            if (this.node.getSiblingIndex() !== handIdx) {
                this.node.setSiblingIndex(handIdx);
            }
        }
    }

    private ensureUnderRoot(): Node {
        const viewRoot = this.node.parent!;
        // 兼容旧名 StageVeil
        let underRoot = viewRoot.getChildByName('StageAimUnder')
            ?? viewRoot.getChildByName('StageVeil');
        if (underRoot == null || !underRoot.isValid) {
            underRoot = new Node('StageAimUnder');
            underRoot.layer = viewRoot.layer;
            const vut = viewRoot.getComponent(UITransform);
            const ut = underRoot.addComponent(UITransform);
            ut.setContentSize(vut?.width ?? 2560, vut?.height ?? 1440);
            ut.setAnchorPoint(vut?.anchorX ?? 0.5, vut?.anchorY ?? 0.5);
            underRoot.setPosition(0, 0, 0);
            viewRoot.addChild(underRoot);
        } else if (underRoot.name === 'StageVeil') {
            underRoot.name = 'StageAimUnder';
        }
        this._underRoot = underRoot;
        this.reparentUnder(this._gVeil?.node);
        this.reparentUnder(this._gFog?.node);
        this.reparentUnder(this._gBeam?.node);
        this.reparentUnder(this._gPool?.node);
        return underRoot;
    }

    private reparentUnder(node: Node | null | undefined): void {
        const underRoot = this._underRoot;
        if (node == null || underRoot == null || !node.isValid) {
            return;
        }
        if (node.parent !== underRoot) {
            node.setParent(underRoot);
            node.setPosition(0, 0, 0);
        }
    }

    private buildLayers(): void {
        this._gVeil = this.makeGfx('veil');
        this._gFog = this.makeGfx('fog');
        this._gMark = this.makeGfx('mark');
        this._gBeam = this.makeGfx('beam');
        this._gPool = this.makeGfx('pool');
        this._gSpark = this.makeGfx('spark');
        this.ensureUnderRoot();
        this.ensureLayerOrder();
        this.syncQuality(true);
    }

    private syncQuality(force = false): void {
        const level = AnimQualityService.getCurrent();
        if (!force && level === this._quality) {
            return;
        }
        this._quality = level;
        this._budget = getAimFxBudget(level);
        this.seedMotes(this._budget.motes);
    }

    private seedMotes(count: number): void {
        this._motes.length = 0;
        for (let i = 0; i < count; i++) {
            this._motes.push({
                u: (i * 0.097 + 0.03) % 1,
                side: (i % 2 === 0 ? 1 : -1) * (0.15 + (i % 5) * 0.08),
                speed: 0.08 + (i % 7) * 0.025,
                size: 1.1 + (i % 5) * 0.45,
                phase: i * 1.31,
                hue: (i * 17) % 100 / 100,
                kind: i % 5,
                spin: ((i % 5) - 2) * 1.1,
            });
        }
    }

    private makeGfx(name: string): Graphics {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.addComponent(UITransform).setContentSize(1, 1);
        this.node.addChild(n);
        return n.addComponent(Graphics);
    }

    /**
     * @param raiseHosts 未锁定时常亮的单位（合法目标 + 施法者）
     * @param eligibleTouches 合法目标 touchLayer：未锁定时画可选标记
     * @param casterTouch 施法者 touchLayer：未锁定时画施法标记
     * @param focusTouchLayer 当前指中的目标；有则只亮他并打追光，其余压暗
     * @param focusSide 当前目标阵营：己方翅膀光带 / 敌人闪电光带
     */
    setAim(
        raiseHosts: Node[],
        eligibleTouches: Node[],
        casterTouch: Node | null,
        focusTouchLayer: Node | null,
        focusSide: EBattleSide | null = null,
    ): void {
        if (!this._active) {
            this._active = true;
            this.node.active = true;
            this._t = 0;
            this._veilDrop = 0;
            this._beamDrop = 0;
            this.pinLayers();
            if (this._underRoot != null) {
                this._underRoot.active = true;
            }
            this.syncQuality(true);
        }
        this.syncSize();

        this._eligibleTouches.length = 0;
        for (const t of eligibleTouches) {
            if (t != null && t.isValid) {
                this._eligibleTouches.push(t);
            }
        }
        this._casterTouch = casterTouch != null && casterTouch.isValid ? casterTouch : null;
        this._focusSide = focusTouchLayer != null ? focusSide : null;

        if (this._focusTouch !== focusTouchLayer) {
            this._focusTouch = focusTouchLayer;
            this._beamDrop = 0;
            if (focusTouchLayer == null) {
                this._gFog?.clear();
                this._gBeam.clear();
                this._gPool.clear();
                this._gSpark.clear();
            }
        }

        // 未选中：合法目标+施法者常亮；已选中：亮当前目标+施法者（施法者始终不暗），其余压暗
        const brightNow: Node[] = [];
        const pushBright = (host: Node | null | undefined): void => {
            if (host == null || !host.isValid) {
                return;
            }
            if (brightNow.indexOf(host) < 0) {
                brightNow.push(host);
            }
        };
        if (this._focusTouch != null && this._focusTouch.isValid) {
            pushBright(this._focusTouch.parent);
        } else {
            for (const host of raiseHosts) {
                pushBright(host);
            }
        }
        if (this._casterTouch != null && this._casterTouch.isValid) {
            pushBright(this._casterTouch.parent);
        }
        this.syncHostDim(brightNow);
    }

    hide(): void {
        this.clearHostDim();
        this._active = false;
        this._focusTouch = null;
        this._focusSide = null;
        this._casterTouch = null;
        this._eligibleTouches.length = 0;
        this._veilDrop = 0;
        this._beamDrop = 0;
        this.node.active = false;
        if (this._underRoot != null && this._underRoot.isValid) {
            this._underRoot.active = false;
        }
        this._gVeil?.clear();
        this._gFog?.clear();
        this._gMark?.clear();
        this._gBeam?.clear();
        this._gPool?.clear();
        this._gSpark?.clear();
    }

    update(dt: number): void {
        if (!this._active) {
            return;
        }
        this._t += dt;
        this.syncQuality();
        this._veilDrop = Math.min(1, this._veilDrop + dt * 4.5);
        if (this._focusTouch != null && this._focusTouch.isValid) {
            this._beamDrop = Math.min(1, this._beamDrop + dt * 3.2);
        } else {
            this._beamDrop = 0;
        }
        this.syncSize();

        const ut = this.node.getComponent(UITransform);
        if (ut == null) {
            return;
        }
        const w = ut.width;
        const h = ut.height;
        const left = -ut.anchorX * w;
        const bottom = -ut.anchorY * h;
        const top = bottom + h;

        this.drawVeil(left, bottom, w, h);
        this.drawRoleMarks(ut);

        if (this._focusTouch == null || !this._focusTouch.isValid) {
            this._gFog.clear();
            this._gBeam.clear();
            this._gPool.clear();
            this._gSpark.clear();
            return;
        }

        const base = this.getTouchLayerBaseLocal(ut, this._focusTouch);
        const breathe = 0.88 + 0.12 * Math.sin(this._t * 3.6);
        this.drawDreamFog(base.x, base.y, top, breathe);
        this.drawHeavenBeam(base.x, base.y, top, breathe);
        this.drawFairyPool(base.x, base.y, breathe, base.poolRx);
        this.drawFairyMotes(base.x, base.y, top, dt);
    }

    /**
     * 角色标记（画在单位之上）：
     * - 未锁定：队友青蓝准星 / 施法者暖金法阵
     * - 已锁定：队友标记收起；施法者标记保留（若不是当前选中）
     */
    private drawRoleMarks(stageUt: UITransform): void {
        const g = this._gMark;
        g.clear();
        const aMul = this._veilDrop;
        const pulse = 0.7 + 0.3 * Math.sin(this._t * 3.4);
        const spin = this._t * 1.8;
        const focused = this._focusTouch != null && this._focusTouch.isValid;

        if (!focused) {
            for (const touch of this._eligibleTouches) {
                if (!touch.isValid) {
                    continue;
                }
                if (touch === this._casterTouch) {
                    continue;
                }
                this.drawAllySelectMark(g, stageUt, touch, pulse, spin, aMul);
            }
        }

        // 施法者标记：选中别人时仍显示，方便辨认谁在出牌
        if (this._casterTouch != null && this._casterTouch.isValid && this._casterTouch !== this._focusTouch) {
            this.drawCasterMark(g, stageUt, this._casterTouch, pulse, spin, aMul);
        }
    }

    /** 队友：青蓝准星，偏「可选」 */
    private drawAllySelectMark(
        g: Graphics,
        stageUt: UITransform,
        touch: Node,
        pulse: number,
        spin: number,
        aMul: number,
    ): void {
        const base = this.getTouchLayerBaseLocal(stageUt, touch);
        const touchUt = touch.getComponent(UITransform);
        const th = touchUt?.height ?? 200;
        const cx = base.x;
        const cy = base.y;
        const midY = cy + th * 0.42;
        const rx = base.poolRx * 0.95;
        const ry = rx * 0.36;

        // 脚下淡青光垫
        this._tmp.set(80, 220, 255, Math.floor(55 * aMul * pulse));
        g.fillColor = this._tmp;
        this.fillEllipse(g, cx, cy, rx, ry);

        // 虚线轨道点（绕脚）
        for (let i = 0; i < 10; i++) {
            const ang = spin * 0.7 + (i / 10) * Math.PI * 2;
            const x = cx + Math.cos(ang) * rx * 1.05;
            const y = cy + Math.sin(ang) * ry * 1.05;
            const on = (Math.sin(ang * 2 + this._t * 4) + 1) * 0.5;
            this._tmp.set(140, 245, 255, Math.floor((90 + on * 100) * aMul));
            g.fillColor = this._tmp;
            g.circle(x, y, 1.6 + on * 1.2);
            g.fill();
        }

        // 四角准星括号（身体两侧）
        const arm = Math.max(28, th * 0.22);
        const gap = Math.max(36, base.poolRx * 0.55);
        const bracket = 12 + pulse * 3;
        this._tmp.set(100, 240, 255, Math.floor(200 * aMul * pulse));
        g.strokeColor = this._tmp;
        g.lineWidth = 2.6;
        // 左上
        g.moveTo(cx - gap, midY + arm);
        g.lineTo(cx - gap, midY + arm - bracket);
        g.moveTo(cx - gap, midY + arm);
        g.lineTo(cx - gap + bracket, midY + arm);
        // 左下
        g.moveTo(cx - gap, midY - arm);
        g.lineTo(cx - gap, midY - arm + bracket);
        g.moveTo(cx - gap, midY - arm);
        g.lineTo(cx - gap + bracket, midY - arm);
        // 右上
        g.moveTo(cx + gap, midY + arm);
        g.lineTo(cx + gap, midY + arm - bracket);
        g.moveTo(cx + gap, midY + arm);
        g.lineTo(cx + gap - bracket, midY + arm);
        // 右下
        g.moveTo(cx + gap, midY - arm);
        g.lineTo(cx + gap, midY - arm + bracket);
        g.moveTo(cx + gap, midY - arm);
        g.lineTo(cx + gap - bracket, midY - arm);
        g.stroke();

        // 中心小菱（可选提示）
        const d = 5 + pulse * 2;
        this._tmp.set(200, 255, 255, Math.floor(160 * aMul * pulse));
        g.fillColor = this._tmp;
        g.moveTo(cx, midY + d);
        g.lineTo(cx + d * 0.7, midY);
        g.lineTo(cx, midY - d);
        g.lineTo(cx - d * 0.7, midY);
        g.close();
        g.fill();
    }

    /** 施法者：脚下暖金法阵，偏「我在出牌」 */
    private drawCasterMark(
        g: Graphics,
        stageUt: UITransform,
        touch: Node,
        pulse: number,
        spin: number,
        aMul: number,
    ): void {
        const base = this.getTouchLayerBaseLocal(stageUt, touch);
        const touchUt = touch.getComponent(UITransform);
        const th = touchUt?.height ?? 200;
        const cx = base.x;
        const footY = base.y;
        const rx = base.poolRx * 1.05;

        // 脚下暖色光池（比队友更实）
        for (let i = 0; i < 4; i++) {
            const k = 1 + i * 0.18;
            this._tmp.set(255, 160, 40, Math.floor((70 - i * 12) * aMul * pulse));
            g.fillColor = this._tmp;
            this.fillEllipse(g, cx, footY, rx * k * 0.85, rx * 0.3 * k);
        }

        // 六角法阵
        const hexR = rx * 0.72;
        this._tmp.set(255, 210, 90, Math.floor(210 * aMul * pulse));
        g.strokeColor = this._tmp;
        g.lineWidth = 2.8;
        this.strokePolygon(g, cx, footY, hexR, hexR * 0.38, 6, spin * 0.15);
        this._tmp.set(255, 240, 160, Math.floor(140 * aMul));
        g.strokeColor = this._tmp;
        g.lineWidth = 1.5;
        this.strokePolygon(g, cx, footY, hexR * 0.62, hexR * 0.24, 6, -spin * 0.25);

        // 法阵节点
        for (let i = 0; i < 6; i++) {
            const ang = spin * 0.15 + (i / 6) * Math.PI * 2;
            const x = cx + Math.cos(ang) * hexR;
            const y = footY + Math.sin(ang) * hexR * 0.38;
            this._tmp.set(255, 230, 120, Math.floor(220 * aMul * pulse));
            g.fillColor = this._tmp;
            g.circle(x, y, 2.8);
            g.fill();
        }

        // 身侧短暖光柱（不是全屏追光，只提示施法者）
        const beamH = th * 0.85;
        this._tmp.set(255, 180, 60, Math.floor(35 * aMul * pulse));
        g.fillColor = this._tmp;
        g.moveTo(cx - 16, footY + 8);
        g.lineTo(cx + 16, footY + 8);
        g.lineTo(cx + 7, footY + beamH);
        g.lineTo(cx - 7, footY + beamH);
        g.close();
        g.fill();
        this._tmp.set(255, 245, 200, Math.floor(50 * aMul * pulse));
        g.fillColor = this._tmp;
        g.moveTo(cx - 5, footY + 12);
        g.lineTo(cx + 5, footY + 12);
        g.lineTo(cx + 2, footY + beamH);
        g.lineTo(cx - 2, footY + beamH);
        g.close();
        g.fill();
    }

    private strokePolygon(
        g: Graphics,
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        sides: number,
        rot: number,
    ): void {
        for (let i = 0; i <= sides; i++) {
            const a = rot + (i / sides) * Math.PI * 2;
            const px = cx + Math.cos(a) * rx;
            const py = cy + Math.sin(a) * ry;
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.stroke();
    }

    private drawTinyStar(g: Graphics, x: number, y: number, r: number, rot: number): void {
        for (let i = 0; i < 8; i++) {
            const a = rot + (i * Math.PI) / 4;
            const rad = i % 2 === 0 ? r : r * 0.4;
            const px = x + Math.cos(a) * rad;
            const py = y + Math.sin(a) * rad;
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.close();
        g.fill();
    }

    /** 亮起名单内常亮，其余 character/enemy 挂点降透明（不挪父节点） */
    private syncHostDim(brightHosts: Node[]): void {
        const bright = new Set(brightHosts.filter((n) => n != null && n.isValid));
        const sig = [...bright].map((n) => n.uuid).sort().join('|');
        if (sig === this._brightSig) {
            return;
        }
        this._brightSig = sig;

        const anim = this.node.parent?.getChildByName('anim');
        if (anim == null || !anim.isValid) {
            this.clearHostDim();
            return;
        }

        const nextDimmed: Node[] = [];
        for (const child of anim.children) {
            if (child == null || !child.isValid || !UNIT_HOST_NAME.test(child.name)) {
                continue;
            }
            if (bright.has(child)) {
                child.setOpacity(255);
            } else {
                child.setOpacity(UNIT_DIM_OPACITY);
                nextDimmed.push(child);
            }
        }

        for (const host of this._dimmedHosts) {
            if (!host.isValid) {
                continue;
            }
            if (nextDimmed.indexOf(host) < 0 && !bright.has(host)) {
                host.setOpacity(255);
            }
        }
        this._dimmedHosts.length = 0;
        for (const host of nextDimmed) {
            this._dimmedHosts.push(host);
        }
    }

    private clearHostDim(): void {
        this._brightSig = '';
        for (const host of this._dimmedHosts) {
            if (host.isValid) {
                host.setOpacity(255);
            }
        }
        this._dimmedHosts.length = 0;

        const anim = this.node.parent?.getChildByName('anim');
        if (anim == null || !anim.isValid) {
            return;
        }
        for (const child of anim.children) {
            if (child != null && child.isValid && UNIT_HOST_NAME.test(child.name)) {
                child.setOpacity(255);
            }
        }
    }

    private ensureLayerOrder(): void {
        // 下层：暗幕 → 雾 → 光带 → 光池；上层：标记 → 星尘
        this._gVeil.node.setSiblingIndex(0);
        this._gFog.node.setSiblingIndex(1);
        this._gBeam.node.setSiblingIndex(2);
        this._gPool.node.setSiblingIndex(3);
        this._gMark.node.setSiblingIndex(0);
        this._gSpark.node.setSiblingIndex(1);
    }

    private getTouchLayerBaseLocal(stageUt: UITransform, touchLayer: Node): {
        x: number;
        y: number;
        poolRx: number;
    } {
        const touchUt = touchLayer.getComponent(UITransform);
        const tw = touchUt?.width ?? 120;
        const th = touchUt?.height ?? 200;
        const tax = touchUt?.anchorX ?? 0.5;
        const tay = touchUt?.anchorY ?? 0;

        this._touchLocal.set((0.5 - tax) * tw, (0 - tay) * th, 0);
        if (touchUt != null) {
            touchUt.convertToWorldSpaceAR(this._touchLocal, this._world);
        } else {
            touchLayer.getWorldPosition(this._world);
        }
        stageUt.convertToNodeSpaceAR(this._world, this._local);
        return {
            x: this._local.x,
            y: this._local.y,
            poolRx: Math.max(48, tw * 0.55),
        };
    }

    private syncSize(): void {
        const parent = this.node.parent;
        const put = parent?.getComponent(UITransform);
        const ut = this.node.getComponent(UITransform);
        if (put == null || ut == null) {
            return;
        }
        ut.setContentSize(put.width, put.height);
        ut.setAnchorPoint(put.anchorX, put.anchorY);
        const underUt = this._underRoot?.getComponent(UITransform);
        if (underUt != null) {
            underUt.setContentSize(put.width, put.height);
            underUt.setAnchorPoint(put.anchorX, put.anchorY);
        }
    }

    private drawVeil(left: number, bottom: number, w: number, h: number): void {
        const g = this._gVeil;
        g.clear();
        // 轻暗幕（单位不再抬到幕上，过浓会把目标一并压黑；亮暗靠单位透明度区分）
        this._tmp.set(10, 8, 28, Math.floor(100 * this._veilDrop));
        g.fillColor = this._tmp;
        g.rect(left, bottom, w, h);
        g.fill();
    }

    /**
     * 追光：己方细丝带+小翅膀；敌人闪电折线。略粗于上一版。
     */
    private drawHeavenBeam(tx: number, ty: number, screenTop: number, breathe: number): void {
        const g = this._gBeam;
        g.clear();
        const skyY = screenTop + 36;
        const fullLen = skyY - ty;
        const len = fullLen * this._beamDrop;
        if (len < 8) {
            return;
        }
        const topY = skyY;
        const botY = skyY - len;
        const aMul = this._beamDrop * breathe;

        if (this._focusSide === EBattleSide.Enemy) {
            this.drawLightningBeam(g, tx, topY, botY, aMul, breathe);
            return;
        }

        this.drawAllyRibbonBeam(g, tx, topY, botY, aMul, breathe);
        // 翅膀挂在光带中上段
        if (this._beamDrop > 0.35) {
            const wingY = topY + (botY - topY) * 0.26;
            const appear = Math.min(1, (this._beamDrop - 0.35) / 0.5);
            this.drawFairyWings(g, tx, wingY, aMul * appear, breathe);
        }
    }

    /** 己方：柔光丝带（比上一版略粗一点点） */
    private drawAllyRibbonBeam(
        g: Graphics,
        tx: number,
        topY: number,
        botY: number,
        aMul: number,
        breathe: number,
    ): void {
        const segs = this._budget.beamSegs;
        const passN = this._budget.ribbonPasses;
        const widths = [28, 18, 10, 6].map((w) => w * breathe);
        const alphas = [80, 125, 175, 210].map((a) => a * aMul);
        for (let pass = 0; pass < passN; pass++) {
            const passW = widths[pass] ?? 5;
            const passA = alphas[pass] ?? 100;
            for (let i = 0; i < segs; i++) {
                const t0 = i / segs;
                const t1 = (i + 1) / segs;
                const y0 = topY + (botY - topY) * t0;
                const y1 = topY + (botY - topY) * t1;
                const x0 = tx + Math.sin(this._t * 1.2 + t0 * 2.2) * 1.6;
                const x1 = tx + Math.sin(this._t * 1.2 + t1 * 2.2) * 1.6;
                const wave = 0.85 + 0.15 * Math.sin(t0 * 8 + this._t * 2);
                this.fairyColor(t0, 0.45, this._tmp, passA * (0.8 + 0.2 * t0));
                g.strokeColor = this._tmp;
                g.lineWidth = passW * wave;
                g.moveTo(x0, y0);
                g.lineTo(x1, y1);
                g.stroke();
            }
        }
        for (let i = 0; i < segs; i++) {
            const t0 = i / segs;
            const t1 = (i + 1) / segs;
            const y0 = topY + (botY - topY) * t0;
            const y1 = topY + (botY - topY) * t1;
            const x0 = tx + Math.sin(this._t * 1.2 + t0 * 2.2) * 0.8;
            const x1 = tx + Math.sin(this._t * 1.2 + t1 * 2.2) * 0.8;
            const wave = 0.7 + 0.3 * Math.abs(Math.sin(t0 * 10 + this._t * 2.5));
            this.fairyColor(t0, 0.75, this._tmp, 235 * aMul);
            this._tmp.r = Math.min(255, this._tmp.r + 50);
            this._tmp.g = Math.min(255, this._tmp.g + 40);
            this._tmp.b = Math.min(255, this._tmp.b + 50);
            g.strokeColor = this._tmp;
            g.lineWidth = 3.4 * wave * breathe;
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
        }
        if (this._beamDrop > 0.15) {
            const burst = 0.85 + 0.15 * Math.sin(this._t * 3.8);
            this.fairyColor(0.2, 0.6, this._tmp, Math.floor(200 * aMul * burst));
            this.drawStarBurst(g, tx, topY, 10 * burst, this._t, this._tmp, burst);
            this._tmp.set(255, 255, 255, Math.floor(230 * aMul * burst));
            this.drawStarBurst(g, tx, topY, 6 * burst, -this._t * 0.8, this._tmp, burst);
        }
    }

    /** 己方光带上的小翅膀（左右一对，轻扇动） */
    private drawFairyWings(g: Graphics, cx: number, cy: number, aMul: number, breathe: number): void {
        if (!this._budget.drawWings) {
            return;
        }
        const flap = Math.sin(this._t * 5.2) * 0.14;
        const scale = (0.96 + 0.04 * Math.sin(this._t * 2.8)) * breathe;
        this.drawOneWing(g, cx, cy, -1, flap, scale, aMul);
        this.drawOneWing(g, cx, cy, 1, -flap, scale, aMul);
        this.fairyColor(0.85, 0.9, this._tmp, Math.floor(230 * aMul));
        this.drawStarBurst(g, cx, cy + 4, 9 * scale, this._t, this._tmp, 1);
        this._tmp.set(255, 255, 255, Math.floor(245 * aMul));
        g.fillColor = this._tmp;
        this.drawTinyStar(g, cx, cy + 4, 3.4 * scale, this._t * 0.5);
    }

    private drawOneWing(
        g: Graphics,
        cx: number,
        cy: number,
        side: number,
        flap: number,
        scale: number,
        aMul: number,
    ): void {
        const lift = flap * 16;
        const feathers = Math.max(1, this._budget.wingFeathers);
        const specs = [
            { t: 0.12, len: 58, thick: 28, y: 0, tilt: 0.18 },
            { t: 0.42, len: 46, thick: 21, y: -2, tilt: -0.04 },
            { t: 0.72, len: 32, thick: 15, y: -10, tilt: -0.24 },
            { t: 0.9, len: 22, thick: 10, y: -16, tilt: -0.35 },
        ];
        for (let i = 0; i < feathers && i < specs.length; i++) {
            const s = specs[i];
            this.fairyColor(s.t, 0.35 + i * 0.12, this._tmp, Math.floor((160 + i * 12) * aMul));
            this.fillWingPetal(
                g,
                cx,
                cy + s.y + lift * (0.3 - i * 0.05),
                s.len * scale,
                s.thick * scale,
                side,
                s.tilt,
            );
        }
        this._tmp.set(255, 255, 255, Math.floor(175 * aMul));
        this.fillSoftBlobColor(
            g,
            cx + side * 46 * scale,
            cy + 8 * scale + lift,
            7.5 * scale,
            4.5 * scale,
            0,
            this._tmp,
        );
    }

    /** 侧向羽翼：根部贴光带，尖端外展 */
    private fillWingPetal(
        g: Graphics,
        x: number,
        y: number,
        len: number,
        thick: number,
        side: number,
        tilt: number,
    ): void {
        g.fillColor = this._tmp;
        const tipX = x + side * len;
        const tipY = y + tilt * len + thick * 0.15;
        const topX = x + side * len * 0.52;
        const topY = y + thick * 0.9 + tilt * len * 0.4;
        const midX = x + side * len * 0.78;
        const midY = y + thick * 0.1 + tilt * len * 0.7;
        const botX = x + side * len * 0.42;
        const botY = y - thick * 0.55 + tilt * len * 0.25;
        g.moveTo(x + side * 2, y);
        g.lineTo(topX, topY);
        g.lineTo(tipX, tipY);
        g.lineTo(midX, midY);
        g.lineTo(botX, botY);
        g.close();
        g.fill();
        // 内层亮羽
        const innerA = Math.floor((this._tmp.a || 150) * 0.5);
        this._tmp.a = innerA;
        g.fillColor = this._tmp;
        g.moveTo(x + side * 3, y);
        g.lineTo(x + side * len * 0.4, y + thick * 0.35);
        g.lineTo(x + side * len * 0.72, y + thick * 0.05);
        g.lineTo(x + side * len * 0.36, y - thick * 0.22);
        g.close();
        g.fill();
    }

    /** 敌人：闪电折线光带 */
    private drawLightningBeam(
        g: Graphics,
        tx: number,
        topY: number,
        botY: number,
        aMul: number,
        breathe: number,
    ): void {
        const pts: Array<{ x: number; y: number }> = [];
        const zigN = this._budget.zigN;
        // 折线形态刷新放慢（约 0.45s 换一次），别闪太快
        const seed = Math.floor(this._t * 2.2);
        for (let i = 0; i <= zigN; i++) {
            const t = i / zigN;
            const y = topY + (botY - topY) * t;
            let x = tx;
            if (i > 0 && i < zigN) {
                const amp = (10 + (i % 3) * 6) * breathe;
                const dir = (i + seed) % 2 === 0 ? 1 : -1;
                const jag = ((i * 37 + seed * 13) % 10) / 10;
                x = tx + dir * amp * (0.55 + jag * 0.45);
            }
            pts.push({ x, y });
        }

        const passN = Math.min(3, this._budget.ribbonPasses);
        for (let pass = 0; pass < passN; pass++) {
            const w = [16, 9, 4.5][pass] * breathe;
            const a = [70, 120, 190][pass] * aMul;
            for (let i = 0; i < pts.length - 1; i++) {
                const t = i / (pts.length - 1);
                this.boltColor(t, this._tmp, a);
                g.strokeColor = this._tmp;
                g.lineWidth = w;
                g.moveTo(pts[i].x, pts[i].y);
                g.lineTo(pts[i + 1].x, pts[i + 1].y);
                g.stroke();
            }
        }
        for (let i = 0; i < pts.length - 1; i++) {
            this._tmp.set(240, 250, 255, Math.floor(230 * aMul));
            g.strokeColor = this._tmp;
            g.lineWidth = 2.2 * breathe;
            g.moveTo(pts[i].x, pts[i].y);
            g.lineTo(pts[i + 1].x, pts[i + 1].y);
            g.stroke();
        }

        const forkStep = this._budget.forkStep;
        if (forkStep > 0) {
            for (let i = 2; i < pts.length - 2; i += forkStep) {
                const p = pts[i];
                const side = i % 4 === 0 ? 1 : -1;
                const len = (14 + (i % 3) * 5) * breathe;
                const ang = side * (0.9 + ((i + seed) % 5) * 0.08);
                const ex = p.x + Math.cos(ang) * len;
                const ey = p.y + Math.sin(ang) * len * 0.55;
                this.boltColor(i / pts.length, this._tmp, 150 * aMul);
                g.strokeColor = this._tmp;
                g.lineWidth = 3.2 * breathe;
                g.moveTo(p.x, p.y);
                g.lineTo(ex, ey);
                g.stroke();
                this._tmp.set(255, 255, 255, Math.floor(200 * aMul));
                g.strokeColor = this._tmp;
                g.lineWidth = 1.4;
                g.moveTo(p.x, p.y);
                g.lineTo(ex, ey);
                g.stroke();
            }
        }

        // 天口电火花
        if (this._beamDrop > 0.15) {
            const burst = 0.85 + 0.15 * Math.sin(this._t * 3.2);
            this.boltColor(0.1, this._tmp, 210 * aMul * burst);
            this.drawStarBurst(g, tx, topY, 11 * burst, this._t * 1.2, this._tmp, burst);
            this._tmp.set(255, 255, 255, Math.floor(240 * aMul * burst));
            this.drawStarBurst(g, tx, topY, 6 * burst, -this._t * 1.5, this._tmp, burst);
        }
    }

    /** 沿细光带两侧的轻梦雾（同弧光雾团尺度） */
    private drawDreamFog(tx: number, ty: number, screenTop: number, breathe: number): void {
        const g = this._gFog;
        g.clear();
        if (this._beamDrop < 0.1 || !this._budget.drawFog) {
            return;
        }
        const skyY = screenTop + 20;
        const h = (skyY - ty) * this._beamDrop;
        const fogN = this._budget.fogCount;
        for (let i = 0; i < fogN; i++) {
            const u = (i / fogN + this._t * 0.03) % 1;
            const y = skyY - u * h;
            const sway = Math.sin(this._t * 1.1 + i * 1.7) * (8 + u * 10);
            const x = tx + sway * (i % 2 === 0 ? 1 : -1);
            const rx = (10 + (i % 4) * 3) * breathe;
            const ry = rx * (0.45 + (i % 3) * 0.1);
            this.fairyColor(u, i / fogN, this._tmp, Math.floor(55 * this._beamDrop));
            this.fillSoftBlobColor(g, x, y, rx, ry, this._t * 0.4 + i, this._tmp);
        }
    }

    /** 脚下小光池：对齐锁敌碎星环气质，不要大饼 */
    private drawFairyPool(tx: number, ty: number, breathe: number, baseRx: number): void {
        const g = this._gPool;
        g.clear();
        if (this._beamDrop < 0.35) {
            return;
        }
        const appear = Math.min(1, (this._beamDrop - 0.35) / 0.65);
        const rx0 = Math.max(36, baseRx * 0.72) * breathe;

        for (let i = 0; i < 4; i++) {
            this.fairyColor(0.25 + i * 0.15, 0.5, this._tmp, Math.floor((90 - i * 14) * appear));
            this.fillSoftBlobColor(
                g,
                tx + Math.sin(this._t + i) * 1.5,
                ty,
                rx0 * (1 + i * 0.12),
                rx0 * 0.32 * (1 + i * 0.1),
                this._t * 0.3 + i,
                this._tmp,
            );
        }
        this._tmp.set(255, 255, 255, Math.floor(180 * appear));
        this.fillSoftBlobColor(g, tx, ty, rx0 * 0.35, rx0 * 0.12, 0, this._tmp);

        if (!this._budget.drawPoolDecor) {
            return;
        }
        const n = this._budget.poolStars;
        for (let i = 0; i < n; i++) {
            const ang = this._t * 1.4 + (i / n) * Math.PI * 2;
            const jag = 0.9 + 0.1 * Math.sin(ang * 3 + this._t);
            const x = tx + Math.cos(ang) * rx0 * 0.95 * jag;
            const y = ty + Math.sin(ang) * rx0 * 0.34 * jag;
            const tw = 0.4 + 0.6 * Math.abs(Math.sin(this._t * 5 + i));
            this.fairyColor(i / n, 0.7, this._tmp, Math.floor(220 * tw * appear));
            if (i % 2 === 0) {
                this.drawStarBurst(g, x, y, 4.5 * tw, ang, this._tmp, tw);
            } else {
                this.drawCrystal(g, x, y, 3.2 * tw, ang, this._tmp);
            }
        }
    }

    /** 沿细光带的星尘（贴近中线，别铺满半屏） */
    private drawFairyMotes(tx: number, ty: number, screenTop: number, dt: number): void {
        const g = this._gSpark;
        g.clear();
        if (this._beamDrop < 0.1 || !this._budget.drawDust) {
            return;
        }
        const skyY = screenTop + 28;
        const span = Math.max(50, (skyY - ty) * this._beamDrop);

        for (const m of this._motes) {
            m.u = (m.u + m.speed * dt * 0.45) % 1;
            const y = skyY - m.u * span;
            if (y < ty - 10) {
                continue;
            }
            const progress = m.u;
            const sway = Math.sin(this._t * 2 + m.phase) * 4;
            const x = tx + m.side * (6 + progress * 10) + sway;
            const tw = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(this._t * 5.5 + m.phase * 2), 2);
            if (tw < 0.22) {
                continue;
            }
            this.fairyColor(progress, m.hue, this._tmp, Math.floor(220 * tw * this._beamDrop));
            const size = m.size * tw * 0.85;
            const rot = m.phase + this._t * m.spin;

            switch (m.kind) {
                case 0:
                    this.drawStarBurst(g, x, y, size * 2.6, rot, this._tmp, tw);
                    break;
                case 1:
                    this.drawCrystal(g, x, y, size * 2.0, rot, this._tmp);
                    break;
                case 2:
                    this.drawPollen(g, x, y, size * 1.3, this._tmp, tw);
                    break;
                case 3:
                    this.drawPetal(g, x, y, size * 1.8, rot, this._tmp);
                    break;
                default:
                    this.drawSparkSlash(g, x, y, size * 2.2, rot, this._tmp, tw);
                    break;
            }
        }

        if (!this._budget.drawSparks) {
            return;
        }
        const burstN = Math.min(16, this._budget.sparkBurst);
        for (let i = 0; i < burstN; i++) {
            const burst = 0.5 + 0.5 * Math.sin(this._t * 3.2 + i * 2.1);
            if (burst < 0.62) {
                continue;
            }
            const tw = (burst - 0.62) / 0.38;
            const u = (0.1 + i * 0.1) % 1;
            const y = skyY - u * span;
            const x = tx + Math.sin(this._t + i) * 8 * (i % 2 === 0 ? 1 : -1);
            this.fairyColor(u, 0.85, this._tmp, Math.floor(240 * tw * this._beamDrop));
            this.drawStarBurst(g, x, y, 7 * tw, i + this._t, this._tmp, tw);
        }
    }

    /**
     * 色带：己方暖童话；敌人电光青紫
     */
    private fairyColor(t: number, hueJitter: number, out: Color, alpha: number): Color {
        if (this._focusSide === EBattleSide.Enemy) {
            return this.boltColor(t + (hueJitter - 0.5) * 0.12, out, alpha);
        }
        const u = Math.max(0, Math.min(1, t + (hueJitter - 0.5) * 0.16));
        if (u < 0.35) {
            this._cA.set(255, 90, 180, 255);
            this._cB.set(255, 140, 100, 255);
            this.lerpColor(this._cA, this._cB, u / 0.35, out);
        } else if (u < 0.7) {
            this._cA.set(255, 140, 100, 255);
            this._cB.set(255, 210, 110, 255);
            this.lerpColor(this._cA, this._cB, (u - 0.35) / 0.35, out);
        } else {
            this._cA.set(255, 210, 110, 255);
            this._cB.set(255, 255, 240, 255);
            this.lerpColor(this._cA, this._cB, (u - 0.7) / 0.3, out);
        }
        const shimmer = 1.1 + 0.14 * Math.sin(this._t * 2.8 + t * 8 + hueJitter * 5);
        out.r = Math.min(255, out.r * shimmer);
        out.g = Math.min(255, out.g * shimmer);
        out.b = Math.min(255, out.b * shimmer);
        out.a = Math.floor(Math.max(0, Math.min(255, alpha)));
        return out;
    }

    /** 闪电色：靛紫 → 电青 → 亮白 */
    private boltColor(t: number, out: Color, alpha: number): Color {
        const u = Math.max(0, Math.min(1, t));
        if (u < 0.4) {
            this._cA.set(140, 90, 255, 255);
            this._cB.set(80, 200, 255, 255);
            this.lerpColor(this._cA, this._cB, u / 0.4, out);
        } else if (u < 0.75) {
            this._cA.set(80, 200, 255, 255);
            this._cB.set(180, 255, 255, 255);
            this.lerpColor(this._cA, this._cB, (u - 0.4) / 0.35, out);
        } else {
            this._cA.set(180, 255, 255, 255);
            this._cB.set(255, 255, 255, 255);
            this.lerpColor(this._cA, this._cB, (u - 0.75) / 0.25, out);
        }
        const flash = 1.06 + 0.12 * Math.sin(this._t * 4.5 + u * 9);
        out.r = Math.min(255, out.r * flash);
        out.g = Math.min(255, out.g * flash);
        out.b = Math.min(255, out.b * flash);
        out.a = Math.floor(Math.max(0, Math.min(255, alpha)));
        return out;
    }

    private lerpColor(a: Color, b: Color, t: number, out: Color): void {
        const k = Math.max(0, Math.min(1, t));
        out.set(
            a.r + (b.r - a.r) * k,
            a.g + (b.g - a.g) * k,
            a.b + (b.b - a.b) * k,
            a.a + (b.a - a.a) * k,
        );
    }

    private fillSoftBlobColor(
        g: Graphics,
        x: number,
        y: number,
        rx: number,
        ry: number,
        rot: number,
        color: Color,
    ): void {
        g.fillColor = color;
        const steps = this._budget.blobSteps;
        for (let i = 0; i <= steps; i++) {
            const a = rot + (i / steps) * Math.PI * 2;
            // 多层起伏，边缘更像云团/花瓣，不像椭圆
            const jag = 0.72
                + 0.2 * Math.sin(a * 2 + rot * 1.3)
                + 0.14 * Math.sin(a * 5 + rot * 0.7)
                + 0.08 * Math.sin(a * 9 + this._t);
            const px = x + Math.cos(a) * rx * jag;
            const py = y + Math.sin(a) * ry * jag;
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.close();
        g.fill();
    }

    private drawStarBurst(g: Graphics, x: number, y: number, r: number, rot: number, c: Color, tw: number): void {
        g.strokeColor = c;
        g.lineWidth = 1.2;
        const arms = 5;
        for (let i = 0; i < arms; i++) {
            const a = rot + (i * Math.PI * 2) / arms;
            const len = r * (0.55 + (i % 2) * 0.35) * tw;
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
            g.stroke();
        }
        this._tmp.set(255, 255, 255, Math.floor((c.a || 180) * 0.85));
        g.fillColor = this._tmp;
        this.drawTinyStar(g, x, y, Math.max(1.2, r * 0.22), rot);
    }

    private drawCrystal(g: Graphics, x: number, y: number, r: number, rot: number, c: Color): void {
        g.fillColor = c;
        const c0 = Math.cos(rot);
        const s0 = Math.sin(rot);
        const pts = [
            { x: 0, y: r },
            { x: r * 0.45, y: 0 },
            { x: 0, y: -r * 0.7 },
            { x: -r * 0.45, y: 0 },
        ];
        g.moveTo(x + pts[0].x * c0 - pts[0].y * s0, y + pts[0].x * s0 + pts[0].y * c0);
        for (let i = 1; i < pts.length; i++) {
            g.lineTo(x + pts[i].x * c0 - pts[i].y * s0, y + pts[i].x * s0 + pts[i].y * c0);
        }
        g.close();
        g.fill();
    }

    private drawPollen(g: Graphics, x: number, y: number, r: number, c: Color, tw: number): void {
        g.fillColor = c;
        this.fillSoftBlobColor(g, x, y, r * 1.2, r * 0.7, this._t, c);
        this._tmp.set(255, 255, 255, Math.floor(140 * tw));
        g.fillColor = this._tmp;
        g.circle(x, y, r * 0.35);
        g.fill();
    }

    private drawPetal(g: Graphics, x: number, y: number, r: number, rot: number, c: Color): void {
        g.fillColor = c;
        const c0 = Math.cos(rot);
        const s0 = Math.sin(rot);
        const local = [
            { x: 0, y: r },
            { x: r * 0.55, y: r * 0.2 },
            { x: 0, y: -r * 0.35 },
            { x: -r * 0.55, y: r * 0.2 },
        ];
        g.moveTo(x + local[0].x * c0 - local[0].y * s0, y + local[0].x * s0 + local[0].y * c0);
        for (let i = 1; i < local.length; i++) {
            g.lineTo(x + local[i].x * c0 - local[i].y * s0, y + local[i].x * s0 + local[i].y * c0);
        }
        g.close();
        g.fill();
    }

    private drawSparkSlash(g: Graphics, x: number, y: number, r: number, rot: number, c: Color, tw: number): void {
        g.strokeColor = c;
        g.lineWidth = 1.4;
        const dx = Math.cos(rot) * r;
        const dy = Math.sin(rot) * r;
        g.moveTo(x - dx, y - dy);
        g.lineTo(x + dx, y + dy);
        g.stroke();
        this._tmp.set(255, 255, 255, Math.floor(180 * tw));
        g.fillColor = this._tmp;
        g.circle(x, y, 1.1);
        g.fill();
    }

    private fillEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number): void {
        const steps = 22;
        for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            const px = cx + Math.cos(a) * rx;
            const py = cy + Math.sin(a) * ry;
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.close();
        g.fill();
    }

    private strokeEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number): void {
        const steps = 22;
        for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            const px = cx + Math.cos(a) * rx;
            const py = cy + Math.sin(a) * ry;
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.close();
        g.stroke();
    }

    private fillSoftBlob(
        g: Graphics,
        x: number,
        y: number,
        rx: number,
        ry: number,
        r: number,
        gv: number,
        b: number,
        a: number,
    ): void {
        this._tmp.set(r, gv, b, Math.max(0, Math.min(255, a)));
        this.fillSoftBlobColor(g, x, y, rx, ry, 0, this._tmp);
    }
}
