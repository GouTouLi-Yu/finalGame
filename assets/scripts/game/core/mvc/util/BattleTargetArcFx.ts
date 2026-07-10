import {
    _decorator,
    Color,
    Component,
    Graphics,
    Node,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';

const { ccclass } = _decorator;

export type TArcAimState = 'aim' | 'lock' | 'cancel';

interface IDust {
    t: number;
    side: number;
    dist: number;
    size: number;
    rot: number;
    spin: number;
    twinkle: number;
    hue: number;
    kind: number; // 0星芒 1碎晶 2花粉 3小星 4飘带点
}

/**
 * 梦幻魔法弧光：不规则星尘/碎晶/花粉，丰富渐变，无规则圆球流光。
 */
@ccclass('BattleTargetArcFx')
export class BattleTargetArcFx extends Component {
    private _gFog!: Graphics;
    private _gRibbon!: Graphics;
    private _gDust!: Graphics;
    private _gSpark!: Graphics;
    private _gTip!: Graphics;

    private _from = new Vec3();
    private _to = new Vec3();
    private _ctrl = new Vec3();
    private _state: TArcAimState = 'aim';
    private _active = false;
    private _phase = 0;
    private _pulse = 0;
    private readonly _samples: Vec3[] = [];
    private readonly _tangents: Vec3[] = [];
    private readonly _dust: IDust[] = [];
    private readonly _cA = new Color();
    private readonly _cB = new Color();
    private readonly _cC = new Color();
    private readonly _cOut = new Color();

    static create(parent: Node): BattleTargetArcFx {
        const node = new Node('TargetArcFx');
        const ut = node.addComponent(UITransform);
        const parentUt = parent.getComponent(UITransform);
        if (parentUt != null) {
            ut.setContentSize(parentUt.width, parentUt.height);
            ut.setAnchorPoint(parentUt.anchorX, parentUt.anchorY);
        } else {
            ut.setContentSize(2560, 1440);
            ut.setAnchorPoint(0.5, 0.5);
        }
        node.setPosition(0, 0, 0);
        node.layer = parent.layer;
        parent.addChild(node);
        const card = parent.getChildByName('card');
        if (card != null) {
            node.setSiblingIndex(card.getSiblingIndex());
        } else {
            node.setSiblingIndex(Math.max(0, parent.children.length - 1));
        }

        const fx = node.addComponent(BattleTargetArcFx);
        fx.buildLayers();
        fx.seedDust();
        node.active = false;
        return fx;
    }

    private buildLayers(): void {
        this._gFog = this.makeGfx('fog');
        this._gRibbon = this.makeGfx('ribbon');
        this._gDust = this.makeGfx('dust');
        this._gSpark = this.makeGfx('spark');
        this._gTip = this.makeGfx('tip');
        for (let i = 0; i <= 48; i++) {
            this._samples.push(new Vec3());
            this._tangents.push(new Vec3());
        }
    }

    private makeGfx(name: string): Graphics {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.addComponent(UITransform).setContentSize(1, 1);
        this.node.addChild(n);
        return n.addComponent(Graphics);
    }

    private seedDust(): void {
        this._dust.length = 0;
        // 伪随机：不规则分布，避免等间距
        const seeds = [
            0.04, 0.09, 0.13, 0.19, 0.22, 0.28, 0.33, 0.37, 0.41, 0.48,
            0.52, 0.57, 0.61, 0.66, 0.71, 0.74, 0.79, 0.83, 0.88, 0.92, 0.96,
            0.07, 0.16, 0.25, 0.31, 0.44, 0.55, 0.63, 0.77, 0.85, 0.94,
            0.11, 0.27, 0.39, 0.5, 0.68, 0.81, 0.9, 0.18, 0.35, 0.58, 0.72,
            0.02, 0.45, 0.6, 0.86, 0.98, 0.24, 0.42, 0.69, 0.15, 0.53,
            0.76, 0.08, 0.47, 0.64, 0.91, 0.3, 0.56, 0.82,
        ];
        for (let i = 0; i < seeds.length; i++) {
            const s = seeds[i];
            this._dust.push({
                t: s,
                side: (i % 2 === 0 ? 1 : -1) * (0.35 + ((i * 17) % 10) * 0.12),
                dist: 6 + ((i * 13) % 11) * 5 + ((i * 7) % 5) * 3,
                size: 1.4 + ((i * 11) % 6) * 0.85,
                rot: ((i * 37) % 360) * Math.PI / 180,
                spin: ((i % 5) - 2) * 0.9,
                twinkle: i * 1.17,
                hue: (i * 47) % 100 / 100,
                kind: i % 5,
            });
        }
    }

    show(): void {
        this._active = true;
        this.node.active = true;
        this._phase = 0;
        this._pulse = 0;
    }

    hide(): void {
        this._active = false;
        this.node.active = false;
        this.clearAll();
    }

    setEndpoints(fromUi: Vec2 | Vec3, toUi: Vec2 | Vec3, state: TArcAimState): void {
        this._from.set(fromUi.x, fromUi.y, 0);
        this._to.set(toUi.x, toUi.y, 0);
        this._state = state;
        this.rebuildControl();
        if (this._active) {
            this.redraw();
        }
    }

    update(dt: number): void {
        if (!this._active) {
            return;
        }
        const lock = this._state === 'lock';
        this._phase += dt * (lock ? 2.4 : 1.6);
        this._pulse += dt * 3.8;
        this.rebuildControl();
        this.redraw();
    }

    private rebuildControl(): void {
        const mx = (this._from.x + this._to.x) * 0.5;
        const my = (this._from.y + this._to.y) * 0.5;
        const dx = this._to.x - this._from.x;
        const dy = this._to.y - this._from.y;
        const len = Math.max(80, Math.sqrt(dx * dx + dy * dy));
        // 控制点略抖，弧形不那么机械
        const wobbleX = Math.sin(this._pulse * 0.7) * 18 + Math.cos(this._phase * 0.5) * 10;
        const wobbleY = Math.sin(this._phase * 0.9) * 14;
        const arcH = Math.min(320, 90 + len * 0.26);
        const side = Math.min(110, len * 0.1) * (dx >= 0 ? -1 : 1);
        this._ctrl.set(mx + side + wobbleX, my + arcH + wobbleY, 0);
    }

    private redraw(): void {
        const ut = this.node.getComponent(UITransform);
        if (ut == null) {
            return;
        }
        const n = this._samples.length - 1;
        for (let i = 0; i <= n; i++) {
            this.sampleBezier(i / n, this._samples[i]);
            ut.convertToNodeSpaceAR(this._samples[i], this._samples[i]);
        }
        for (let i = 0; i <= n; i++) {
            const a = this._samples[Math.max(0, i - 1)];
            const b = this._samples[Math.min(n, i + 1)];
            this._tangents[i].set(b.x - a.x, b.y - a.y, 0);
            const len = Math.sqrt(this._tangents[i].x ** 2 + this._tangents[i].y ** 2) || 1;
            this._tangents[i].x /= len;
            this._tangents[i].y /= len;
        }

        this.drawDreamFog(this._gFog);
        this.drawMagicRibbon(this._gRibbon);
        this.drawIrregularDust(this._gDust);
        this.drawTwinkleSparks(this._gSpark);
        this.drawFairyTip(this._gTip);
    }

    private sampleBezier(t: number, out: Vec3): void {
        const u = 1 - t;
        out.x = u * u * this._from.x + 2 * u * t * this._ctrl.x + t * t * this._to.x;
        out.y = u * u * this._from.y + 2 * u * t * this._ctrl.y + t * t * this._to.y;
        out.z = 0;
    }

    /**
     * 童话色带：薰衣草 → 薄荷 → 樱花粉 → 月光金（锁敌更暖更饱和）
     */
    private fairyColor(t: number, hueJitter: number, out: Color, alpha: number): Color {
        const lock = this._state === 'lock';
        const u = Math.max(0, Math.min(1, t + (hueJitter - 0.5) * 0.18));
        if (!lock) {
            // 紫 → 青 → 粉 → 浅金白
            if (u < 0.33) {
                this._cA.set(150, 110, 255, 255); // 薰衣草
                this._cB.set(100, 220, 255, 255); // 薄荷青
                this.lerpColor(this._cA, this._cB, u / 0.33, out);
            } else if (u < 0.66) {
                this._cA.set(100, 220, 255, 255);
                this._cB.set(255, 150, 210, 255); // 樱花粉
                this.lerpColor(this._cA, this._cB, (u - 0.33) / 0.33, out);
            } else {
                this._cA.set(255, 150, 210, 255);
                this._cB.set(255, 240, 190, 255); // 月光
                this.lerpColor(this._cA, this._cB, (u - 0.66) / 0.34, out);
            }
        } else {
            // 玫红 → 珊瑚 → 蜜金 → 亮白
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
        }
        // 整体偏亮 + 轻微闪烁（不再把底色压暗）
        const shimmer = 1.12 + 0.18 * Math.sin(this._phase * 2.5 + t * 10 + hueJitter * 6);
        out.r = Math.min(255, out.r * shimmer);
        out.g = Math.min(255, out.g * shimmer);
        out.b = Math.min(255, out.b * shimmer);
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

    /** 梦雾：不规则团块，不是整齐圆串 */
    private drawDreamFog(g: Graphics): void {
        g.clear();
        const lock = this._state === 'lock';
        const n = this._samples.length - 1;
        for (let i = 0; i < this._dust.length; i += 2) {
            const d = this._dust[i];
            const idx = Math.min(n, Math.floor(d.t * n));
            const p = this._samples[idx];
            const tan = this._tangents[idx];
            const nx = -tan.y;
            const ny = tan.x;
            const sway = Math.sin(this._pulse * 0.8 + d.twinkle) * 10;
            const x = p.x + nx * (d.side * d.dist * 0.7 + sway);
            const y = p.y + ny * (d.side * d.dist * 0.7 + sway * 0.6);
            const pulse = 0.75 + 0.35 * Math.sin(this._pulse + d.twinkle * 0.5);
            const rx = (18 + d.size * 6) * pulse * (lock ? 1.25 : 1);
            const ry = rx * (0.45 + (d.hue % 1) * 0.5);
            const rot = d.rot + this._phase * d.spin * 0.15;
            this.fairyColor(d.t, d.hue, this._cOut, lock ? 72 : 58);
            g.fillColor = this._cOut;
            this.fillSoftBlob(g, x, y, rx, ry, rot);
        }
    }

    /** 魔法丝带：逐段渐变，宽度起伏不规则 */
    private drawMagicRibbon(g: Graphics): void {
        g.clear();
        const lock = this._state === 'lock';
        const pts = this._samples;
        // 外层柔光
        for (let pass = 0; pass < 3; pass++) {
            const baseW = lock ? [42, 24, 14][pass] : [36, 20, 12][pass];
            const baseA = lock ? [95, 130, 175][pass] : [75, 110, 150][pass];
            for (let i = 0; i < pts.length - 1; i++) {
                const t = i / (pts.length - 1);
                const wave = 0.7 + 0.55 * Math.sin(t * 9 + this._phase) * Math.sin(t * 3.7 + 1.2);
                this.fairyColor(t, 0.5, this._cOut, baseA * (0.75 + 0.25 * t));
                g.strokeColor = this._cOut;
                g.lineWidth = baseW * wave;
                g.moveTo(pts[i].x, pts[i].y);
                g.lineTo(pts[i + 1].x, pts[i + 1].y);
                g.stroke();
            }
        }
        // 亮芯：细、更白更粉
        for (let i = 0; i < pts.length - 1; i++) {
            const t = i / (pts.length - 1);
            const wave = 0.6 + 0.7 * Math.abs(Math.sin(t * 11 + this._phase * 1.3));
            this.fairyColor(t, 0.7, this._cOut, lock ? 245 : 220);
            this._cOut.r = Math.min(255, this._cOut.r + 55);
            this._cOut.g = Math.min(255, this._cOut.g + 45);
            this._cOut.b = Math.min(255, this._cOut.b + 55);
            g.strokeColor = this._cOut;
            g.lineWidth = (lock ? 4.4 : 3.6) * wave;
            g.moveTo(pts[i].x, pts[i].y);
            g.lineTo(pts[i + 1].x, pts[i + 1].y);
            g.stroke();
        }
    }

    /** 不规则星尘：星芒/碎晶/花粉/小星，闪烁而非流动圆 */
    private drawIrregularDust(g: Graphics): void {
        g.clear();
        const lock = this._state === 'lock';
        const n = this._samples.length - 1;
        for (const d of this._dust) {
            const idx = Math.min(n, Math.floor(d.t * n));
            const p = this._samples[idx];
            const tan = this._tangents[idx];
            const nx = -tan.y;
            const ny = tan.x;
            // 轻微漂浮，不是沿弧推进
            const floatX = Math.sin(this._phase * 1.1 + d.twinkle) * 5;
            const floatY = Math.cos(this._phase * 0.9 + d.twinkle * 0.7) * 6;
            const x = p.x + nx * d.side * d.dist + floatX;
            const y = p.y + ny * d.side * d.dist + floatY;
            const tw = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(this._phase * 3.2 + d.twinkle * 2.1), 2);
            if (tw < 0.2) {
                continue;
            }
            const size = d.size * tw * (lock ? 1.35 : 1.15);
            this.fairyColor(d.t, d.hue, this._cOut, 230 * tw);
            const rot = d.rot + this._phase * d.spin;

            switch (d.kind) {
                case 0:
                    this.drawStarBurst(g, x, y, size * 3.2, rot, this._cOut, tw);
                    break;
                case 1:
                    this.drawCrystal(g, x, y, size * 2.4, rot, this._cOut);
                    break;
                case 2:
                    this.drawPollen(g, x, y, size * 1.6, this._cOut, tw);
                    break;
                case 3:
                    this.drawTinyStar(g, x, y, size * 2.0, rot, this._cOut, tw);
                    break;
                default:
                    this.drawSparkSlash(g, x, y, size * 2.8, rot, this._cOut, tw);
                    break;
            }
        }
    }

    /** 额外高亮碎光：更明显的魔法感 */
    private drawTwinkleSparks(g: Graphics): void {
        g.clear();
        const lock = this._state === 'lock';
        const n = this._samples.length - 1;
        // 固定若干“爆发点”，闪烁开关，不沿弧滚动
        for (let i = 0; i < 12; i++) {
            const t = (0.08 + i * 0.075 + Math.sin(i * 1.7) * 0.02) % 1;
            const burst = 0.5 + 0.5 * Math.sin(this._phase * 2.8 + i * 1.9);
            if (burst < 0.55) {
                continue;
            }
            const tw = (burst - 0.55) / 0.45;
            const idx = Math.min(n, Math.floor(t * n));
            const p = this._samples[idx];
            const tan = this._tangents[idx];
            const nx = -tan.y;
            const ny = tan.x;
            const side = (i % 2 === 0 ? 1 : -1);
            const x = p.x + nx * side * (8 + (i % 4) * 6);
            const y = p.y + ny * side * (8 + (i % 4) * 6);
            this.fairyColor(t, i / 12, this._cOut, 255 * tw);
            this.drawStarBurst(g, x, y, (lock ? 11 : 9) * tw, i + this._phase, this._cOut, tw);
            g.fillColor = new Color(255, 255, 255, Math.floor(235 * tw));
            // 中心用极小菱形，避免“圆球”
            this.drawTinyStar(g, x, y, 2.0 * tw, 0, new Color(255, 255, 255, Math.floor(250 * tw)), tw);
        }
    }

    private drawFairyTip(g: Graphics): void {
        g.clear();
        const p = this._samples[this._samples.length - 1];
        const lock = this._state === 'lock';
        const breathe = 1 + Math.sin(this._pulse * 1.5) * 0.16;

        // 不规则雾团叠层
        for (let i = 0; i < 5; i++) {
            const ang = this._phase * 0.6 + i * 1.1;
            const ox = Math.cos(ang) * (6 + i * 3);
            const oy = Math.sin(ang * 1.3) * (5 + i * 2.5);
            this.fairyColor(1, i / 5, this._cOut, lock ? 95 - i * 10 : 80 - i * 9);
            this.fillSoftBlob(
                g,
                p.x + ox,
                p.y + oy,
                (32 - i * 4) * breathe * (lock ? 1.2 : 1),
                (18 - i * 2) * breathe,
                ang,
            );
        }

        // 多层星芒（不是同心圆）
        const arms = lock ? 6 : 5;
        for (let layer = 0; layer < 2; layer++) {
            const arm = (lock ? 42 : 32) * breathe * (1 - layer * 0.25);
            const rot = this._phase * (layer === 0 ? 0.55 : -0.35);
            this.fairyColor(1, 0.8, this._cOut, lock ? 230 : 200);
            g.strokeColor = this._cOut;
            g.lineWidth = layer === 0 ? 2.2 : 1.4;
            for (let i = 0; i < arms; i++) {
                const a = rot + (i * Math.PI * 2) / arms + (i % 2) * 0.12;
                const len = arm * (0.65 + (i % 3) * 0.18);
                g.moveTo(p.x, p.y);
                g.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
                g.stroke();
            }
        }

        // 中心碎晶簇
        this.fairyColor(1, 0.9, this._cOut, 230);
        this.drawCrystal(g, p.x, p.y, lock ? 9 : 7, this._phase, this._cOut);
        this.drawTinyStar(g, p.x, p.y, lock ? 5 : 4, this._phase * 0.5, new Color(255, 255, 255, 240), 1);

        // 外圈用碎点代替圆框
        const ringN = lock ? 14 : 10;
        for (let i = 0; i < ringN; i++) {
            const a = this._phase * 0.8 + (i / ringN) * Math.PI * 2;
            const rr = (lock ? 30 : 24) * breathe * (0.9 + (i % 3) * 0.06);
            const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this._phase * 4 + i));
            this.fairyColor(1, i / ringN, this._cOut, 240 * tw);
            const x = p.x + Math.cos(a) * rr;
            const y = p.y + Math.sin(a) * rr;
            this.drawTinyStar(g, x, y, 2.2 * tw, a, this._cOut, tw);
        }
    }

    private fillSoftBlob(g: Graphics, x: number, y: number, rx: number, ry: number, rot: number): void {
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            // 边缘起伏，打破椭圆规则感
            const jag = 0.85 + 0.2 * Math.sin(a * 3 + rot * 2) + 0.1 * Math.sin(a * 5 - rot);
            const px = x + Math.cos(a + rot) * rx * jag;
            const py = y + Math.sin(a + rot) * ry * jag;
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
        g.lineWidth = 1.3;
        for (let i = 0; i < 4; i++) {
            const a = rot + (i * Math.PI) / 4;
            const len = r * (i % 2 === 0 ? 1 : 0.55);
            g.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
            g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
            g.stroke();
        }
        g.fillColor = new Color(255, 255, 255, Math.floor(180 * tw));
        this.drawTinyStar(g, x, y, Math.max(1.2, r * 0.18), rot, new Color(255, 255, 255, Math.floor(200 * tw)), tw);
    }

    private drawCrystal(g: Graphics, x: number, y: number, r: number, rot: number, c: Color): void {
        g.fillColor = c;
        const pts = [
            [0, r],
            [r * 0.55, r * 0.15],
            [r * 0.35, -r * 0.7],
            [-r * 0.25, -r * 0.55],
            [-r * 0.6, r * 0.1],
        ];
        for (let i = 0; i < pts.length; i++) {
            const px = x + pts[i][0] * Math.cos(rot) - pts[i][1] * Math.sin(rot);
            const py = y + pts[i][0] * Math.sin(rot) + pts[i][1] * Math.cos(rot);
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.close();
        g.fill();
    }

    private drawPollen(g: Graphics, x: number, y: number, r: number, c: Color, tw: number): void {
        // 三瓣花粉，非圆
        g.fillColor = c;
        for (let i = 0; i < 3; i++) {
            const a = this._phase * 0.4 + i * (Math.PI * 2 / 3);
            const px = x + Math.cos(a) * r * 0.55;
            const py = y + Math.sin(a) * r * 0.55;
            this.fillSoftBlob(g, px, py, r * 0.7, r * 0.4, a);
        }
        g.fillColor = new Color(255, 255, 255, Math.floor(150 * tw));
        this.drawTinyStar(g, x, y, r * 0.35, 0, new Color(255, 255, 255, Math.floor(160 * tw)), tw);
    }

    private drawTinyStar(g: Graphics, x: number, y: number, r: number, rot: number, c: Color, _tw: number): void {
        g.fillColor = c;
        // 四角星
        for (let i = 0; i < 8; i++) {
            const a = rot + (i * Math.PI) / 4;
            const rad = i % 2 === 0 ? r : r * 0.38;
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

    private drawSparkSlash(g: Graphics, x: number, y: number, r: number, rot: number, c: Color, tw: number): void {
        g.strokeColor = c;
        g.lineWidth = 1.6;
        g.moveTo(x - Math.cos(rot) * r, y - Math.sin(rot) * r);
        g.lineTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
        g.stroke();
        g.strokeColor = new Color(255, 255, 255, Math.floor(160 * tw));
        g.lineWidth = 1;
        const r2 = r * 0.55;
        const rot2 = rot + 0.7;
        g.moveTo(x - Math.cos(rot2) * r2, y - Math.sin(rot2) * r2);
        g.lineTo(x + Math.cos(rot2) * r2, y + Math.sin(rot2) * r2);
        g.stroke();
    }

    private clearAll(): void {
        this._gFog?.clear();
        this._gRibbon?.clear();
        this._gDust?.clear();
        this._gSpark?.clear();
        this._gTip?.clear();
    }

    onDestroy(): void {
        this.clearAll();
    }
}
