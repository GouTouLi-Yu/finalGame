import {
    _decorator,
    Color,
    Component,
    Graphics,
    Node,
    UITransform,
} from 'cc';

import { EventDispatcher, EventListener } from '../../../../frame/event/EventDispatcher';
import { LuaEvent } from '../../../../frame/event/PCEvent';
import { PCEventType } from '../../../../frame/event/PCEventType';
import { Injector } from '../../../../frame/Injector/Injector';
import { AnimQualityHide } from '../../../anim/AnimQualityHide';
import { AnimQualityLevel } from '../../../anim/AnimQualityLevel';
import { AnimQualityService } from '../../../anim/AnimQualityService';
import { CardUtil } from './CardUtil';

const { ccclass } = _decorator;

const FX_NAME = 'QualityFx';
/** 中档：Graphics 每帧重建 mesh 很贵，20fps 足够 */
const MID_REDRAW_INTERVAL = 1 / 20;

interface IQualityPalette {
    rim: Color;
    deep: Color;
    glow: Color;
    spark: Color;
    foil: Color;
}

interface IMote {
    u: number;
    speed: number;
    size: number;
    phase: number;
    side: number;
    dist: number;
    kind: number; // 0星 1碎晶 2花粉 3菱片
    spin: number;
}

interface IPt {
    x: number;
    y: number;
}

/** 与 pic_kpd_02~04 边框色对齐 */
const PALETTES: Record<2 | 3 | 4, IQualityPalette> = {
    2: {
        rim: new Color(185, 176, 242, 255),
        deep: new Color(97, 79, 182, 255),
        glow: new Color(150, 130, 255, 255),
        spark: new Color(235, 225, 255, 255),
        foil: new Color(210, 200, 255, 255),
    },
    3: {
        rim: new Color(241, 206, 176, 255),
        deep: new Color(181, 131, 80, 255),
        glow: new Color(255, 190, 110, 255),
        spark: new Color(255, 245, 210, 255),
        foil: new Color(255, 230, 180, 255),
    },
    4: {
        rim: new Color(246, 173, 171, 255),
        deep: new Color(188, 80, 72, 255),
        glow: new Color(255, 110, 100, 255),
        spark: new Color(255, 235, 220, 255),
        foil: new Color(255, 200, 190, 255),
    },
};

type TFxBuild = 'high' | 'mid' | null;

/**
 * 卡牌品质框常驻特效（科技框）：1 档无；2~4 档递进华丽。
 * 跟随 AnimQualityService：
 * - High：6 层 Graphics 全特效
 * - Mid：单 Graphics 降级版
 * - Low：AnimQualityHide 隐藏节点
 */
@ccclass('CardQualityFx')
export class CardQualityFx extends Component {
    private _gAura: Graphics | null = null;
    private _gFoil: Graphics | null = null;
    private _gRim: Graphics | null = null;
    private _gCircuit: Graphics | null = null;
    private _gDust: Graphics | null = null;
    private _gSpark: Graphics | null = null;
    private _gMid: Graphics | null = null;

    private _quality = 1;
    private _t = 0;
    private _accum = 0;
    private _build: TFxBuild = null;
    private _listener: EventListener | null = null;

    private readonly _motes: IMote[] = [];
    private readonly _path: IPt[] = [];
    private readonly _segLen: number[] = [];
    private _pathLen = 0;
    private readonly _tmp = new Color();
    private _cx = 0;
    private _cy = 0;
    private _rw = 98;
    private _rh = 138;

    static ensure(cardNode: Node): CardQualityFx {
        const existing = cardNode.getChildByName(FX_NAME);
        const comp = existing?.getComponent(CardQualityFx);
        if (comp != null) {
            comp.ensureAnimQualityHide();
            comp.applyAnimQuality(AnimQualityService.getCurrent());
            return comp;
        }
        const n = new Node(FX_NAME);
        n.layer = cardNode.layer;
        const cut = cardNode.getComponent(UITransform);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(cut?.width ?? 200, cut?.height ?? 280);
        ut.setAnchorPoint(cut?.anchorX ?? 0.5, cut?.anchorY ?? 0.5);
        n.setPosition(0, 0, 0);
        cardNode.addChild(n);
        const qualityBadge = cardNode.getChildByName('quality');
        if (qualityBadge != null) {
            n.setSiblingIndex(Math.max(1, qualityBadge.getSiblingIndex()));
        } else {
            const di = cardNode.getChildByName('di');
            n.setSiblingIndex(di != null ? di.getSiblingIndex() + 1 : 1);
        }
        const fx = n.addComponent(CardQualityFx);
        fx.ensureAnimQualityHide();
        fx.applyAnimQuality(AnimQualityService.getCurrent());
        return fx;
    }

    static apply(cardNode: Node, quality: unknown): void {
        const q = CardUtil.clampQuality(quality);
        if (q <= 1) {
            const existing = cardNode.getChildByName(FX_NAME);
            if (existing != null) {
                // 先摘树再销毁，避免同帧 UI 兄弟排序读到空 _uiProps
                existing.removeFromParent();
                existing.destroy();
            }
            return;
        }
        this.ensure(cardNode).setQuality(q);
    }

    /** 低档隐藏：qualityLevel=2 仅 Low 隐藏 */
    private ensureAnimQualityHide(): void {
        let hide = this.node.getComponent(AnimQualityHide);
        if (hide == null) {
            hide = this.node.addComponent(AnimQualityHide);
        }
        hide.qualityLevel = 2;
        hide.applyLevel(AnimQualityService.getCurrent());
    }

    onLoad(): void {
        this._registerQualityListener();
    }

    onEnable(): void {
        this.applyAnimQuality(AnimQualityService.getCurrent());
        this._registerQualityListener();
    }

    onDestroy(): void {
        this._unregisterQualityListener();
    }

    private _registerQualityListener(): void {
        const dispatcher = this._getDispatcher();
        if (!dispatcher || this._listener) {
            return;
        }
        const listener = new EventListener();
        listener.fun = (event?: LuaEvent) => {
            const level = (event?.payload as { level?: AnimQualityLevel } | undefined)?.level
                ?? AnimQualityService.getCurrent();
            this.applyAnimQuality(level);
        };
        listener.beDelete = false;
        listener.callthis = null;
        dispatcher.addEventListener(PCEventType.EVT_ANIM_QUALITY_CHANGED, listener);
        this._listener = listener;
    }

    private _unregisterQualityListener(): void {
        const dispatcher = this._getDispatcher();
        if (!dispatcher || !this._listener) {
            return;
        }
        dispatcher.removeEventListener(PCEventType.EVT_ANIM_QUALITY_CHANGED, this._listener);
        this._listener = null;
    }

    private _getDispatcher(): EventDispatcher | null {
        try {
            return Injector.shared.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher;
        } catch {
            return null;
        }
    }

    /** High→全特效；Mid→降级；Low 由 AnimQualityHide 隐藏 */
    applyAnimQuality(level: AnimQualityLevel): void {
        if (level === AnimQualityLevel.Low) {
            this.clearAll();
            return;
        }
        const want: TFxBuild = level === AnimQualityLevel.Mid ? 'mid' : 'high';
        if (this._build !== want) {
            this.rebuildGfx(want);
        }
        if (this._quality >= 2) {
            this.resyncMotes();
            this._accum = MID_REDRAW_INTERVAL;
        }
    }

    setQuality(quality: number): void {
        this._quality = CardUtil.clampQuality(quality);
        this._t = 0;
        this._accum = MID_REDRAW_INTERVAL;
        this._motes.length = 0;
        if (this._quality <= 1) {
            this.clearAll();
            return;
        }
        this.syncSize();
        this.rebuildTechPath();
        this.resyncMotes();
        if (this._build == null && AnimQualityService.getCurrent() !== AnimQualityLevel.Low) {
            this.applyAnimQuality(AnimQualityService.getCurrent());
        }
    }

    private resyncMotes(): void {
        if (this._quality < 2) {
            this._motes.length = 0;
            return;
        }
        const highCounts = { 2: 10, 3: 22, 4: 40 } as const;
        const midCounts = { 2: 6, 3: 12, 4: 20 } as const;
        const counts = this._build === 'mid' ? midCounts : highCounts;
        this.seedMotes(counts[this._quality as 2 | 3 | 4] ?? (this._build === 'mid' ? 6 : 10));
    }

    private rebuildGfx(mode: TFxBuild): void {
        this.clearAll();
        for (let i = this.node.children.length - 1; i >= 0; i--) {
            const child = this.node.children[i];
            if (child == null) {
                continue;
            }
            child.removeFromParent();
            child.destroy();
        }
        this._gAura = null;
        this._gFoil = null;
        this._gRim = null;
        this._gCircuit = null;
        this._gDust = null;
        this._gSpark = null;
        this._gMid = null;

        const rootG = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        rootG.clear();

        this._build = mode;
        if (mode === 'high') {
            // 高档用子节点分层；根 Graphics 关掉避免多 1 次 DrawCall
            rootG.enabled = false;
            this._gAura = this.makeGfxChild('aura');
            this._gFoil = this.makeGfxChild('foil');
            this._gRim = this.makeGfxChild('rim');
            this._gCircuit = this.makeGfxChild('circuit');
            this._gDust = this.makeGfxChild('dust');
            this._gSpark = this.makeGfxChild('spark');
        } else if (mode === 'mid') {
            rootG.enabled = true;
            this._gMid = rootG;
        }
    }

    private makeGfxChild(name: string): Graphics {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.addComponent(UITransform).setContentSize(1, 1);
        this.node.addChild(n);
        return n.addComponent(Graphics);
    }

    private syncSize(): void {
        const host = this.node.parent;
        const hut = host?.getComponent(UITransform);
        const ut = this.node.getComponent(UITransform);
        if (hut != null && ut != null) {
            ut.setContentSize(hut.width, hut.height);
            ut.setAnchorPoint(hut.anchorX, hut.anchorY);
        }
        const w = ut?.width ?? 200;
        const h = ut?.height ?? 280;
        const ax = ut?.anchorX ?? 0.5;
        const ay = ut?.anchorY ?? 0.5;
        this._cx = (0.5 - ax) * w;
        this._cy = (0.5 - ay) * h;
        this._rw = w * 0.5 - 3;
        this._rh = h * 0.5 - 3;
    }

    private rebuildTechPath(): void {
        const cx = this._cx;
        const cy = this._cy;
        const rw = this._rw - 4;
        const rh = this._rh - 4;
        const notchW = rw * 0.42;
        const notchD = 11;
        const sideY = cy - rh * 0.28;
        const sideIn = 7;
        const cornerCut = 10;

        const pts: IPt[] = [
            { x: cx - rw + 8, y: cy + rh },
            { x: cx - notchW, y: cy + rh },
            { x: cx - notchW + 8, y: cy + rh - notchD },
            { x: cx + notchW - 8, y: cy + rh - notchD },
            { x: cx + notchW, y: cy + rh },
            { x: cx + rw - 8, y: cy + rh },
            { x: cx + rw, y: cy + rh - 8 },
            { x: cx + rw, y: sideY + 10 },
            { x: cx + rw - sideIn, y: sideY },
            { x: cx + rw, y: sideY - 10 },
            { x: cx + rw, y: cy - rh + cornerCut + 6 },
            { x: cx + rw - cornerCut, y: cy - rh },
            { x: cx - rw + cornerCut, y: cy - rh },
            { x: cx - rw, y: cy - rh + cornerCut + 6 },
            { x: cx - rw, y: sideY - 10 },
            { x: cx - rw + sideIn, y: sideY },
            { x: cx - rw, y: sideY + 10 },
            { x: cx - rw, y: cy + rh - 8 },
            { x: cx - rw + 8, y: cy + rh },
        ];

        this._path.length = 0;
        this._segLen.length = 0;
        this._pathLen = 0;
        for (let i = 0; i < pts.length; i++) {
            this._path.push(pts[i]);
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            this._segLen.push(len);
            this._pathLen += len;
        }
    }

    private seedMotes(count: number): void {
        this._motes.length = 0;
        for (let i = 0; i < count; i++) {
            this._motes.push({
                u: (i * 0.137 + 0.07) % 1,
                speed: 0.06 + (i % 7) * 0.025 + (this._quality === 4 ? 0.04 : 0),
                size: 1.1 + (i % 5) * 0.7 + (this._quality >= 4 ? 0.6 : 0),
                phase: i * 1.37,
                side: (i % 2 === 0 ? 1 : -1) * (0.4 + (i % 5) * 0.18),
                dist: 4 + (i % 6) * 3.5,
                kind: i % 4,
                spin: ((i % 5) - 2) * 1.1,
            });
        }
    }

    private clearAll(): void {
        this._gAura?.clear();
        this._gFoil?.clear();
        this._gRim?.clear();
        this._gCircuit?.clear();
        this._gDust?.clear();
        this._gSpark?.clear();
        this._gMid?.clear();
    }

    update(dt: number): void {
        if (this._quality <= 1 || !this.node.active || this._build == null) {
            return;
        }
        if (AnimQualityService.getCurrent() === AnimQualityLevel.Low) {
            return;
        }
        this._t += dt;
        const pal = PALETTES[this._quality as 2 | 3 | 4];
        if (pal == null) {
            return;
        }

        if (this._build === 'mid') {
            for (const m of this._motes) {
                m.u = (m.u + m.speed * dt) % 1;
            }
            this._accum += dt;
            if (this._accum < MID_REDRAW_INTERVAL) {
                return;
            }
            this._accum = 0;
            this.syncSize();
            this.rebuildTechPath();
            const g = this._gMid;
            if (g == null) {
                return;
            }
            g.clear();
            this.drawAura(g, pal, true);
            this.drawFoil(g, pal, true);
            this.drawRimFlow(g, pal, true);
            this.drawCircuit(g, pal, true);
            this.drawDust(g, pal, 0, true);
            this.drawSparks(g, pal, true);
            return;
        }

        // High：每帧全量
        this.syncSize();
        this.rebuildTechPath();
        this.drawAura(this._gAura!, pal, false);
        this.drawFoil(this._gFoil!, pal, false);
        this.drawRimFlow(this._gRim!, pal, false);
        this.drawCircuit(this._gCircuit!, pal, false);
        this.drawDust(this._gDust!, pal, dt, false);
        this.drawSparks(this._gSpark!, pal, false);
    }

    private drawAura(g: Graphics, pal: IQualityPalette, mid: boolean): void {
        if (!mid) {
            g.clear();
        }
        const q = this._quality;
        const breathe = 0.72 + 0.28 * Math.sin(this._t * (q === 2 ? 1.8 : q === 3 ? 2.4 : 3.1));
        const layers = mid
            ? (q === 2 ? 3 : q === 3 ? 4 : 5)
            : (q === 2 ? 4 : q === 3 ? 6 : 8);
        for (let i = 0; i < layers; i++) {
            const expand = 2 + i * (q === 4 ? 3.8 : q === 3 ? 3.0 : 2.2);
            const a = Math.floor((q === 2 ? 28 : q === 3 ? 36 : 48) * breathe * (1 - i / layers));
            this._tmp.set(pal.glow.r, pal.glow.g, pal.glow.b, Math.max(0, a));
            g.strokeColor = this._tmp;
            g.lineWidth = (q === 4 ? 7 : q === 3 ? 5.5 : 4) - i * 0.45;
            g.roundRect(
                this._cx - this._rw - expand * 0.4,
                this._cy - this._rh - expand * 0.4,
                (this._rw + expand * 0.4) * 2,
                (this._rh + expand * 0.4) * 2,
                12 + expand * 0.25,
            );
            g.stroke();
        }

        const cornerN = q === 2 ? 2 : 4;
        const corners: IPt[] = [
            { x: this._cx - this._rw + 6, y: this._cy + this._rh - 6 },
            { x: this._cx + this._rw - 6, y: this._cy + this._rh - 6 },
            { x: this._cx - this._rw + 8, y: this._cy - this._rh + 8 },
            { x: this._cx + this._rw - 8, y: this._cy - this._rh + 8 },
        ];
        for (let i = 0; i < cornerN; i++) {
            const c = corners[i];
            const pulse = 0.55 + 0.45 * Math.sin(this._t * 2.6 + i * 1.4);
            const base = q === 4 ? 16 : q === 3 ? 12 : 8;
            this.fillSoftBlob(g, c.x, c.y, base * pulse, base * 0.55 * pulse, this._t * 0.4 + i, pal.glow, Math.floor((q === 4 ? 55 : 35) * pulse), mid);
            if (q >= 3) {
                this.fillSoftBlob(g, c.x, c.y, base * 0.35 * pulse, base * 0.2 * pulse, 0, pal.spark, Math.floor(90 * pulse), mid);
            }
        }
    }

    private drawFoil(g: Graphics, pal: IQualityPalette, mid: boolean): void {
        if (!mid) {
            g.clear();
        }
        const q = this._quality;
        const sweeps = q === 4 ? 2 : 1;
        for (let s = 0; s < sweeps; s++) {
            const speed = q === 4 ? 0.28 : q === 3 ? 0.2 : 0.14;
            const u = (this._t * speed + s * 0.55) % 1;
            const band = q === 4 ? 22 : q === 3 ? 16 : 12;
            const center = -this._rw - this._rh + u * (this._rw * 2 + this._rh * 2 + 80);
            const steps = mid ? (q === 4 ? 20 : 14) : (q === 4 ? 28 : 18);
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const x = this._cx - this._rw + 8 + t * (this._rw * 2 - 16);
                const y = this._cy - this._rh + 10 + t * (this._rh * 2 - 20);
                const along = x + y;
                const d = Math.abs(along - (this._cx + this._cy + center));
                if (d > band) {
                    continue;
                }
                const fade = 1 - d / band;
                const edgeFade = Math.sin(t * Math.PI);
                const a = Math.floor((q === 2 ? 28 : q === 3 ? 48 : 70) * fade * fade * edgeFade);
                if (a < 4) {
                    continue;
                }
                this._tmp.set(pal.foil.r, pal.foil.g, pal.foil.b, a);
                g.fillColor = this._tmp;
                const w = (q === 4 ? 5.5 : 3.8) * fade;
                g.circle(x, y, w);
                g.fill();
                if (q >= 3 && fade > 0.7) {
                    this._tmp.set(255, 255, 255, Math.floor(a * 0.55));
                    g.fillColor = this._tmp;
                    g.circle(x, y, w * 0.35);
                    g.fill();
                }
            }
        }
    }

    private drawRimFlow(g: Graphics, pal: IQualityPalette, mid: boolean): void {
        if (!mid) {
            g.clear();
        }
        const q = this._quality;

        const breathe = 0.65 + 0.35 * Math.sin(this._t * 2.1);
        this._tmp.set(pal.rim.r, pal.rim.g, pal.rim.b, Math.floor((q === 2 ? 55 : q === 3 ? 85 : 120) * breathe));
        g.strokeColor = this._tmp;
        g.lineWidth = q === 4 ? 2.4 : q === 3 ? 1.8 : 1.3;
        this.strokePath(g);

        const streakN = q === 2 ? 1 : q === 3 ? 2 : 3;
        const speed = q === 2 ? 0.22 : q === 3 ? 0.35 : 0.52;
        const trail = q === 2 ? 0.12 : q === 3 ? 0.16 : 0.2;
        const steps = mid ? (q === 4 ? 18 : 14) : (q === 4 ? 26 : 20);

        for (let s = 0; s < streakN; s++) {
            const head = (this._t * speed + s / streakN) % 1;
            for (let i = 0; i < steps; i++) {
                const u = (head - (i / steps) * trail + 1) % 1;
                const p = this.pointOnPath(u);
                const fade = 1 - i / steps;
                const a = Math.floor((q === 2 ? 150 : q === 3 ? 200 : 240) * fade * fade);
                this.lerpColor(pal.spark, pal.glow, i / steps, this._tmp);
                this._tmp.a = a;
                g.fillColor = this._tmp;
                const size = (q === 2 ? 2.6 : q === 3 ? 3.4 : 4.2) * fade;
                g.circle(p.x, p.y, size);
                g.fill();
                if (q >= 3 && i < 4) {
                    this._tmp.set(255, 255, 255, Math.floor(a * 0.7));
                    g.fillColor = this._tmp;
                    g.circle(p.x, p.y, size * 0.4);
                    g.fill();
                }
            }
            const tip = this.pointOnPath(head);
            this.fillSoftBlob(g, tip.x, tip.y, q === 4 ? 10 : 7, q === 4 ? 6 : 4, 0, pal.glow, q === 2 ? 40 : 70, mid);
        }

        if (q >= 4) {
            const head = (1 - ((this._t * 0.38) % 1)) % 1;
            const n = mid ? 12 : 16;
            for (let i = 0; i < n; i++) {
                const u = (head - (i / n) * 0.1 + 1) % 1;
                const p = this.pointOnPath(u);
                const fade = 1 - i / n;
                this._tmp.set(pal.foil.r, pal.foil.g, pal.foil.b, Math.floor(160 * fade * fade));
                g.fillColor = this._tmp;
                g.circle(p.x, p.y, 2.2 * fade);
                g.fill();
            }
        }
    }

    private drawCircuit(g: Graphics, pal: IQualityPalette, mid: boolean): void {
        if (!mid) {
            g.clear();
        }
        const q = this._quality;
        const sideY = this._cy - this._rh * 0.28;
        const leftX0 = this._cx - this._rw + 5;
        const rightX0 = this._cx + this._rw - 5;
        const arm = q === 4 ? 28 : q === 3 ? 24 : 20;
        const leftNode = { x: leftX0 + arm, y: sideY };
        const rightNode = { x: rightX0 - arm, y: sideY };
        const pulse = 0.5 + 0.5 * Math.sin(this._t * (q === 2 ? 3.0 : 4.2));

        const lineA = Math.floor((q === 2 ? 70 : 110) * (0.7 + 0.3 * pulse));
        this._tmp.set(pal.deep.r, pal.deep.g, pal.deep.b, lineA);
        g.strokeColor = this._tmp;
        g.lineWidth = q >= 4 ? 1.8 : 1.3;
        g.moveTo(leftX0, sideY);
        g.lineTo(leftNode.x, leftNode.y);
        g.stroke();
        g.moveTo(rightX0, sideY);
        g.lineTo(rightNode.x, rightNode.y);
        g.stroke();

        const run = (this._t * (q === 2 ? 0.9 : 1.4)) % 1;
        for (const dir of [-1, 1]) {
            const x0 = dir < 0 ? leftX0 : rightX0;
            const x1 = dir < 0 ? leftNode.x : rightNode.x;
            const x = x0 + (x1 - x0) * run;
            this._tmp.set(pal.spark.r, pal.spark.g, pal.spark.b, Math.floor(180 + pulse * 60));
            g.fillColor = this._tmp;
            g.circle(x, sideY, q === 4 ? 2.4 : 1.8);
            g.fill();
        }

        for (const node of [leftNode, rightNode]) {
            this.fillSoftBlob(g, node.x, node.y, 7 + pulse * (q === 4 ? 6 : 3), 5 + pulse * 2, 0, pal.glow, q === 2 ? 45 : 75, mid);
            this._tmp.set(pal.spark.r, pal.spark.g, pal.spark.b, Math.floor(140 + pulse * 100));
            g.fillColor = this._tmp;
            g.circle(node.x, node.y, 2.2 + pulse * (q === 4 ? 2.2 : 1.2));
            g.fill();
            if (q >= 3) {
                this._tmp.set(255, 255, 255, Math.floor(160 * pulse));
                g.fillColor = this._tmp;
                g.circle(node.x, node.y, 1.1);
                g.fill();
            }
            if (q >= 4) {
                g.strokeColor = this._tmp;
                g.lineWidth = 1.2;
                const ray = 5 + pulse * 5;
                g.moveTo(node.x - ray, node.y);
                g.lineTo(node.x + ray, node.y);
                g.moveTo(node.x, node.y - ray);
                g.lineTo(node.x, node.y + ray);
                g.stroke();
            }
        }
    }

    private drawDust(g: Graphics, pal: IQualityPalette, dt: number, mid: boolean): void {
        if (!mid) {
            g.clear();
        }
        const q = this._quality;
        for (const m of this._motes) {
            if (!mid) {
                m.u = (m.u + m.speed * dt) % 1;
            }
            const base = this.pointOnPath(m.u);
            const next = this.pointOnPath((m.u + 0.01) % 1);
            const tx = next.x - base.x;
            const ty = next.y - base.y;
            const len = Math.hypot(tx, ty) || 1;
            const nx = -ty / len;
            const ny = tx / len;
            const sway = Math.sin(this._t * 2.2 + m.phase) * (q === 4 ? 5 : 3);
            const x = base.x + nx * (m.side * m.dist + sway);
            const y = base.y + ny * (m.side * m.dist * 0.85 + sway * 0.5);
            const tw = 0.4 + 0.6 * Math.abs(Math.sin(this._t * 5.5 + m.phase));
            const a = Math.floor((q === 2 ? 110 : q === 3 ? 170 : 220) * tw);
            this.lerpColor(pal.spark, pal.glow, m.kind * 0.25, this._tmp);
            this._tmp.a = a;
            g.fillColor = this._tmp;
            const size = m.size * (0.65 + tw * 0.55);
            const rot = m.phase + this._t * m.spin;

            if (m.kind === 0) {
                g.circle(x, y, size * 0.55);
                g.fill();
                if (q >= 3) {
                    g.strokeColor = this._tmp;
                    g.lineWidth = 1;
                    g.moveTo(x - size * 1.5, y);
                    g.lineTo(x + size * 1.5, y);
                    g.moveTo(x, y - size * 1.5);
                    g.lineTo(x, y + size * 1.5);
                    g.stroke();
                }
            } else if (m.kind === 1) {
                this.fillDiamond(g, x, y, size * 1.1, size * 0.7, rot);
            } else if (m.kind === 2) {
                this.fillSoftBlob(g, x, y, size * 1.4, size * 0.7, rot, this._tmp, a, mid);
            } else {
                g.circle(x, y, size * 0.4);
                g.fill();
                if (q >= 4) {
                    this._tmp.a = Math.floor(a * 0.45);
                    g.fillColor = this._tmp;
                    g.circle(x + Math.cos(rot) * size, y + Math.sin(rot) * size, size * 0.25);
                    g.fill();
                }
            }
        }
    }

    private drawSparks(g: Graphics, pal: IQualityPalette, mid: boolean): void {
        if (!mid) {
            g.clear();
        }
        const q = this._quality;
        if (q < 2) {
            return;
        }

        const notchW = (this._rw - 4) * 0.42;
        const topY = this._cy + this._rh - 4 - 11;
        const glints: IPt[] = [
            { x: this._cx - notchW + 8, y: topY },
            { x: this._cx + notchW - 8, y: topY },
            { x: this._cx - this._rw + 10, y: this._cy - this._rh + 10 },
            { x: this._cx + this._rw - 10, y: this._cy - this._rh + 10 },
        ];
        const n = q === 2 ? 2 : 4;
        for (let i = 0; i < n; i++) {
            const p = glints[i];
            const tw = Math.max(0, Math.sin(this._t * (q === 4 ? 7 : 4.5) + i * 1.7));
            const bright = tw * tw;
            if (bright < 0.08) {
                continue;
            }
            this.fillSoftBlob(g, p.x, p.y, 6 + bright * (q === 4 ? 8 : 4), 3 + bright * 3, 0, pal.glow, Math.floor(90 * bright), mid);
            this._tmp.set(255, 255, 255, Math.floor(200 * bright));
            g.fillColor = this._tmp;
            g.circle(p.x, p.y, 1.2 + bright * 1.5);
            g.fill();
            if (q >= 4) {
                g.strokeColor = this._tmp;
                g.lineWidth = 1.1;
                const ray = 4 + bright * 7;
                g.moveTo(p.x - ray, p.y);
                g.lineTo(p.x + ray, p.y);
                g.moveTo(p.x, p.y - ray * 0.7);
                g.lineTo(p.x, p.y + ray * 0.7);
                g.stroke();
            }
        }

        if (q >= 4) {
            const floatN = mid ? 4 : 6;
            for (let i = 0; i < floatN; i++) {
                const ang = this._t * 0.7 + i * 1.05;
                const rr = 18 + (i % 3) * 8;
                const x = this._cx + Math.cos(ang) * rr * 0.35;
                const y = this._cy + this._rh * 0.15 + Math.sin(ang * 1.3) * 12;
                const tw = 0.4 + 0.6 * Math.abs(Math.sin(this._t * 3 + i));
                this._tmp.set(pal.spark.r, pal.spark.g, pal.spark.b, Math.floor(90 * tw));
                g.fillColor = this._tmp;
                g.circle(x, y, 1.2 + tw);
                g.fill();
            }
        }
    }

    private strokePath(g: Graphics): void {
        if (this._path.length < 2) {
            return;
        }
        const p0 = this._path[0];
        g.moveTo(p0.x, p0.y);
        for (let i = 1; i < this._path.length; i++) {
            g.lineTo(this._path[i].x, this._path[i].y);
        }
        g.close();
        g.stroke();
    }

    private pointOnPath(u: number): IPt {
        if (this._pathLen <= 0 || this._path.length === 0) {
            return { x: this._cx, y: this._cy };
        }
        let d = (((u % 1) + 1) % 1) * this._pathLen;
        for (let i = 0; i < this._path.length; i++) {
            const seg = this._segLen[i];
            if (d <= seg) {
                const a = this._path[i];
                const b = this._path[(i + 1) % this._path.length];
                const t = seg > 0 ? d / seg : 0;
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            }
            d -= seg;
        }
        return this._path[0];
    }

    private fillSoftBlob(
        g: Graphics,
        x: number,
        y: number,
        rx: number,
        ry: number,
        rot: number,
        color: Color,
        alpha: number,
        mid: boolean,
    ): void {
        this._tmp.set(color.r, color.g, color.b, Math.max(0, Math.min(255, alpha)));
        g.fillColor = this._tmp;
        const steps = mid ? 8 : 10;
        g.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * ry);
        for (let i = 1; i <= steps; i++) {
            const a = rot + (i / steps) * Math.PI * 2;
            g.lineTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
        }
        g.close();
        g.fill();
    }

    private fillDiamond(g: Graphics, x: number, y: number, rx: number, ry: number, rot: number): void {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const pts = [
            { x: rx, y: 0 },
            { x: 0, y: ry },
            { x: -rx, y: 0 },
            { x: 0, y: -ry },
        ];
        const r0 = pts[0];
        g.moveTo(x + r0.x * c - r0.y * s, y + r0.x * s + r0.y * c);
        for (let i = 1; i < 4; i++) {
            const p = pts[i];
            g.lineTo(x + p.x * c - p.y * s, y + p.x * s + p.y * c);
        }
        g.close();
        g.fill();
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
}
