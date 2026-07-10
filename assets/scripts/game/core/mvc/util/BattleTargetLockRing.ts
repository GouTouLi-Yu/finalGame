import {
    _decorator,
    Color,
    Component,
    Graphics,
    Node,
    UITransform,
} from 'cc';

const { ccclass } = _decorator;

/** 合法目标选中：梦幻碎星环，避免死板同心圆 */
@ccclass('BattleTargetLockRing')
export class BattleTargetLockRing extends Component {
    private _g!: Graphics;
    private _t = 0;
    private _active = false;

    static ensure(host: Node): BattleTargetLockRing {
        const existing = host.getChildByName('LockRing');
        const ringComp = existing?.getComponent(BattleTargetLockRing);
        if (ringComp != null) {
            return ringComp;
        }
        const n = new Node('LockRing');
        n.layer = host.layer;
        const hut = host.getComponent(UITransform);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(hut?.width ?? 120, hut?.height ?? 200);
        ut.setAnchorPoint(hut?.anchorX ?? 0.5, hut?.anchorY ?? 0);
        n.setPosition(0, 0, 0);
        host.addChild(n);
        const ring = n.addComponent(BattleTargetLockRing);
        ring._g = n.addComponent(Graphics);
        n.active = false;
        return ring;
    }

    show(): void {
        this._active = true;
        this.node.active = true;
        this._t = 0;
    }

    hide(): void {
        this._active = false;
        this.node.active = false;
        this._g?.clear();
    }

    update(dt: number): void {
        if (!this._active) {
            return;
        }
        this._t += dt;
        const ut = this.node.getComponent(UITransform);
        const w = ut?.width ?? 120;
        const h = ut?.height ?? 200;
        const ax = ut?.anchorX ?? 0.5;
        const ay = ut?.anchorY ?? 0;
        const cx = (0.5 - ax) * w;
        const cy = (0.35 - ay) * h;
        const breathe = 1 + Math.sin(this._t * 4.5) * 0.1;
        const rx = Math.max(52, w * 0.65) * breathe;
        const ry = Math.max(24, h * 0.22) * breathe;

        this._g.clear();

        // 不规则雾团
        for (let i = 0; i < 6; i++) {
            const a = this._t * 0.7 + i * 1.05;
            const ox = Math.cos(a) * rx * 0.25;
            const oy = Math.sin(a * 1.2) * ry * 0.35;
            this._g.fillColor = new Color(
                255,
                120 + i * 15,
                160 + i * 10,
                58,
            );
            this.fillBlob(this._g, cx + ox, cy + oy, 22 - i * 2, 14 - i, a);
        }

        // 碎星环（点列，非描边圆）
        const n = 16;
        for (let i = 0; i < n; i++) {
            const a = this._t * 1.2 + (i / n) * Math.PI * 2;
            const jag = 0.88 + 0.14 * Math.sin(a * 3 + this._t);
            const x = cx + Math.cos(a) * rx * jag;
            const y = cy + Math.sin(a) * ry * jag;
            const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this._t * 5 + i * 1.3));
            const col = i % 3 === 0
                ? new Color(255, 230, 150, Math.floor(245 * tw))
                : i % 3 === 1
                    ? new Color(255, 150, 200, Math.floor(235 * tw))
                    : new Color(255, 255, 255, Math.floor(245 * tw));
            this.drawTinyStar(this._g, x, y, (2.0 + (i % 3) * 0.6) * tw, a, col);
        }

        // 内圈碎晶
        for (let i = 0; i < 8; i++) {
            const a = -this._t * 0.9 + (i / 8) * Math.PI * 2;
            const x = cx + Math.cos(a) * rx * 0.55;
            const y = cy + Math.sin(a) * ry * 0.55;
            const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this._t * 6 + i));
            this.drawTinyStar(this._g, x, y, 1.6 * tw, a, new Color(255, 255, 240, Math.floor(230 * tw)));
        }
    }

    private fillBlob(g: Graphics, x: number, y: number, rx: number, ry: number, rot: number): void {
        const steps = 9;
        for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            const jag = 0.8 + 0.25 * Math.sin(a * 3 + rot);
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

    private drawTinyStar(g: Graphics, x: number, y: number, r: number, rot: number, c: Color): void {
        g.fillColor = c;
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
}
