/**
 * 自 kos `engine/extend/NodeExt` 移植：挂接本项目 `ResManager`（EBundleType.ui / VIDEO）。
 * 未包含 kos 的 TabButton、StarView、引导 GuideHelper、Spine；若需要可自行补组件后再合并原型方法。
 */
import { approx, Asset, BlockInputEvents, Button, CacheMode, Color, EPSILON, EventTouch, Font, geometry, HorizontalTextAlignment, instantiate, Label, Layers, Mat3, Node, NodeEventType, Rect, RichText, Size, Sprite, SpriteFrame, Toggle, Tween, UIOpacity, UITransform, Vec2, Vec3, VerticalTextAlignment, VideoPlayer, warn, Widget } from "cc";
import { EBundleType, ResManager } from "../../game/manager/ResManager";

function isFunction(f: unknown): f is (...args: unknown[]) => unknown {
    return typeof f === "function";
}

function isString(s: unknown): s is string {
    return typeof s === "string";
}

function tostring(v: unknown): string {
    return v == null ? "" : String(v);
}

/** 与 kos Intersection.rectToAABB 一致（rect.x/y 作为 AABB 中心，沿用原工程） */
function rectToAABB(outAABB: geometry.AABB, rect: Rect, zCenter: number = 0, zHalfExtent: number = 0.1): geometry.AABB {
    outAABB.center.set(rect.x, rect.y, zCenter);
    outAABB.halfExtents.set(rect.width * 0.5, rect.height * 0.5, zHalfExtent);
    return outAABB;
}

function loadResAsync(
    bundle: EBundleType,
    res: string,
    type: unknown,
    cb: (err: Error | null, asset: any) => void,
): void {
    ResManager.loadAsset(bundle, res, type as any)
        .then((a) => cb(null, a))
        .catch((e) => cb(e instanceof Error ? e : new Error(String(e)), null));
}

const ResCleaner = {
    addManualAssets(asset: Asset | null | undefined) {
        if (!asset) return;
        try {
            (asset as any).addRef?.();
        } catch (_) { }
    },
    removeManualAssets(asset: Asset | null | undefined) {
        if (!asset) return;
        try {
            (asset as any).decRef?.();
        } catch (_) { }
    },
};

let HIDE_LAYER_FOR_ACTIVE = true
let HideLayerForActive = (value: boolean) => {
    HIDE_LAYER_FOR_ACTIVE = value
}

let _hideLayer: number = null
let hideLayer = () => {
    if (_hideLayer == null) {
        _hideLayer = 1 << Layers.nameToLayer("Hide")
    }
    return _hideLayer
}




export { HideLayerForActive };

export class LegacyNode {
    static create(name?: string): Node {
        let node = new Node(name || "Node");
        let t = node.addComponent(UITransform);
        return node;
    }
}

export class UILayout {
    static create(name?: string) {
        let node = new Node(name || "Layout");
        node.addComponent(UITransform)
        let widget: Widget = node.addComponent(Widget)
        widget.isAlignRight = true;
        widget.isAlignLeft = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        return node;
    }
}


export class LegacyLayer {
    static create(name?: string): Node {
        let node = new Node(name || "Layer");
        let t = node.addComponent(UITransform);
        let widget: Widget = node.addComponent(Widget)
        widget.isAlignRight = true;
        widget.isAlignLeft = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        return node;
    }
}

export class LegacySprite {
    static create(name?: string): Node {
        let node = new Node(name || "Sprite");
        let t = node.addComponent(UITransform);
        t.setContentSize(Size.ZERO)
        let sprite = node.addComponent(Sprite);
        return node
    }
}

export class LegacyLabel {
    static create(text: string, font: Font, fontSize: number, cacheMode: CacheMode = CacheMode.NONE): Node {
        let node = new Node("Label");
        let t = node.addComponent(UITransform); // cc.Label's initial anchor is 0.5, 0.5
        let label = node.addComponent(Label);
        label.cacheMode = cacheMode
        label.string = text;
        label.useSystemFont = false;
        label.font = font
        label.fontSize = fontSize;
        return node
    }
    static createWithTTF(text: string, font: Font, fontSize: number, cacheMode: CacheMode = CacheMode.NONE): Node {
        let node = new Node("Label");
        let t = node.addComponent(UITransform); // cc.Label's initial anchor is 0.5, 0.5
        let label = node.addComponent(Label);
        label.cacheMode = cacheMode
        label.string = text;
        label.useSystemFont = false;
        label.font = font
        label.fontSize = fontSize;
        label.lineHeight = fontSize;
        return node
    }
}

declare module "cc" {
    interface Node {
        [x: string]: any;
        clone(): Node;
        //callback: 1 [this,func]  2 func
        //点击事件 只有touchend才会触发
        _touchEnbale: boolean;
        _clickList: any[];
        addClickListener(callback, noCheckGuide?: boolean, checkMove?: boolean)
        _touchList: any[];
        addTouchListener(callback, noCheckGuide?: boolean, checkMove?: boolean);
        registerScriptTouchHandler(callback: (eventName: string, px: number, py: number, event?: EventTouch) => void, isUI?: boolean);
        removeTouchListener();

        _selfVisible: boolean;
        selfVisible(): boolean;
        isVisible(isCamare?: boolean): boolean;
        setVisible(visibility: boolean, isCamare?: boolean);

        changeLayer(layer: string | number, oriLayerList?: Array<number>);

        getContentSize(): Size;
        setContentSize(size: Size | number, height?: number);
        getAnchorPoint(): Vec2;
        setAnchorPoint(point: Vec2 | number, y?: number);

        getPositionX(): number;
        setPositionX(posX: number);
        getPositionY(): number;
        setPositionY(posY: number);
        setPositionCC(posX: number | Vec2, posY?: number);
        getPositionCC(outPos?: Vec2): Vec2;
        getWorldPositionCC(outPos?: Vec2): Vec2;

        setScaleX(scaleX: number): void
        setScaleY(scaleY: number): void
        setScaleCC(scaleX: number, scaleY?: number): void
        getScaleX(): number
        getScaleY(): number
        getScaleCC(): number

        setFlippedX(isFlippedX: boolean): void
        setFlippedY(isFlippedX: boolean): void

        _zOrder: number | null;
        setLocalZOrder(zorder: number);
        getLocalZOrder(): number;
        addChildWithOrder(child: Node, zOrder?: number)
        addChildCC(child: Node, zOrder?: number, tag?: string | number);
        getChildByFullName(path: string): Node;
        getChildByPath(path: string): Node | null;
        getChildrenCount(): number;

        _tag: string | number;
        setTag(tag: string | number);
        getTag(): string | number;
        getChildByTag(tag: string | number): Node;
        removeChildByTag(tag: string | number, cleanup?: boolean);
        removeChildByName(name: string)

        setName(name: string);
        getName(): string;

        setOpacity(opacity: number);
        getOpacity(): number;

        setSwallowTouches(enabled: boolean);

        //Sprite
        updateTexture(res: string, callBack?, hideOnStar?: boolean);
        loadTexture(res: string, callBack?, hideOnStar?: boolean)
        loadTextures(res: string, res2: string, res3: string)

        //Button
        setTouchEnabled(enabled: boolean);
        setEnabled(enabled: boolean);
        setTitleText(text: string);
        loadTextureNormal(res: string)
        loadTexturePressed(res: string)
        loadTextureDisabled(res: string)
        loadTextureHover(res: string)

        loadVideo(res: string, callBack?)



        // Text
        setString(str: string, refresh?: boolean, ignoreImg?: boolean);
        getString()
        setTextHorizontalAlignment(alignment: HorizontalTextAlignment);
        setTextVerticalAlignment(alignment: VerticalTextAlignment);
        setOutline(color?: Color, width?: number);
        setShadow(color: Color, size: Size, blurRadius?: number)
        setColor(color: Color)
        setTextColor(color: Color)

        //check box
        isSelected();
        setSelected(selected: boolean);

        convertToNodeSpace(worldPoint: Vec3 | Vec2, ignoreAnchor?: boolean): Vec2
        convertToWorldSpace(nodePos: Vec3 | Vec2): Vec2

        actions: Tween<Node>[];
        runAction(action);
        pushAction(action)
        stopAllActions()
        setGray(isGray, recursion?: boolean)

        _Percent: number
        setPercent(value: number)
        getPercent()

        changeParent(_groundLayer: Node)

        addChild(sonNode: Node)

        // /** 获取节点OBB盒 --> 世界坐标系*/
        // getOBB(refreshPos?: boolean, refreshExtents?: boolean, refreshRotation?: boolean, refreshScale?: boolean): geometry.OBB;
        /** 获取节点AABB盒 --> 世界坐标系*/
        getAABB(refreshPos?: boolean, refreshExtents?: boolean, refreshScale?: boolean): geometry.AABB;

        preObb: geometry.OBB;
        obb: geometry.OBB;
        getOBB(refresh?: boolean): geometry.OBB;
    }
}

var addChildFun = Node.prototype.addChild
Node.prototype.addChild = function (sonNode: Node) {
    if (sonNode == null) {
        return
    }
    if (HIDE_LAYER_FOR_ACTIVE) {
        if (this.layer == hideLayer()) {
            sonNode.changeLayer("Hide")
        } else {
            if (sonNode.layer == hideLayer() && !sonNode.selfVisible()) {
                sonNode.changeLayer(this.layer)
            }
        }
    }
    addChildFun.call(this, sonNode);
}


Node.prototype.changeParent = function (_groundLayer: Node) {
    _groundLayer.addChild(this)
}
Node.prototype.getPercent = function () {
    return this._Percent
}
Node.prototype.setPercent = function (value: number) {
    this._Percent = value
}

Node.prototype.pushAction = function (actionfunc: (node: Node) => Tween<Node>) {
    if (actionfunc == null) {
        return
    }

    if (!this.actions) {
        this.actions = []
    }
    let t: Tween<Node> = actionfunc(this)
    this.actions.push(t)
    if (t["isRepeatForever"]) {
        t.start()
    } else {
        t.call(() => this.actions.splice(this.actions.indexOf(t), 1)).start()
    }
}

Node.prototype.runAction = function (actionfunc: (node: Node) => Tween<Node>) {
    this.pushAction(actionfunc)
}

Node.prototype.stopAllActions = function () {
    if (this.actions) {
        this.actions.forEach(t => t.stop())
        this.actions = []
    }
}

Node.prototype.setGray = function (isGray, recursion: boolean = true) {
    this.__isGray = isGray
    var sprite: Sprite = this.getComponent(Sprite)
    if (sprite) {
        sprite.grayscale = isGray
    }
    var label: Label = this.getComponent(Label)
    if (label) {
        const hasOutline = !!label.enableOutline;
        if (isGray) {
            if (!this.__textColor) {
                this.__textColor = new Color(label.color)
            }
            if (hasOutline) {
                label.color = Color.WHITE
            } else {
                label.color = Color.GRAY
            }
        } else {
            if (this.__textColor) {
                label.color = this.__textColor
                this.__textColor = null;
            }
        }

        if (hasOutline) {
            if (isGray) {
                if (!this.__outlineColor) {
                    this.__outlineColor = label.outlineColor.clone()
                }
                label.outlineColor = Color.GRAY
            } else {
                if (this.__outlineColor) {
                    label.outlineColor = this.__outlineColor
                    this.__outlineColor = null;
                }
            }
        }
    }
    if (recursion) {
        this.children.forEach(child => {
            child.setGray(isGray)
        })
    }
}

Node.prototype.convertToNodeSpace = function (worldPoint: Vec3 | Vec2, ignoreAnchor?: boolean) {
    var t: UITransform = this.getComponent(UITransform)
    if (t == null) {
        t = this.addComponent(UITransform)
    }

    var outv3 = t.convertToNodeSpaceAR(new Vec3(worldPoint.x, worldPoint.y, 0))
    if (ignoreAnchor) {
        outv3.x += t.anchorX * t.width;
        outv3.y += t.anchorY * t.height;
    }
    return new Vec2(outv3.x, outv3.y);
}

Node.prototype.convertToWorldSpace = function (nodePos: Vec3 | Vec2) {
    var t = this.getComponent(UITransform)
    if (t == null) {
        t = this.addComponent(UITransform)
    }
    var outv3 = t.convertToWorldSpaceAR(new Vec3(nodePos.x, nodePos.y, 0))
    return new Vec2(outv3.x, outv3.y);
}

Node.prototype.clone = function (): Node {
    let clone = instantiate(this);
    clone._tag = this._tag;
    clone._zOrder = this._zOrder;
    clone._selfVisible = this._selfVisible;
    clone._task = this._task;

    // 根节点及子节点凡经 loadTexture 的，克隆后需同步引用计数与销毁回收
    const srcSprites = this.getComponentsInChildren(Sprite);
    const dstSprites = clone.getComponentsInChildren(Sprite);
    const n = Math.min(srcSprites.length, dstSprites.length);
    for (let i = 0; i < n; i++) {
        const srcSprite = srcSprites[i];
        const dstSprite = dstSprites[i];
        if (srcSprite == null || dstSprite == null) {
            continue;
        }
        if (!srcSprite.node.isLoadTexture) {
            continue;
        }
        dstSprite.node.isLoadTexture = true;
        if (dstSprite.node.__resName == null && srcSprite.node.__resName != null) {
            dstSprite.node.__resName = srcSprite.node.__resName;
        }
        ResCleaner.addManualAssets(dstSprite.spriteFrame);
        loadTextureDispos_sprite(dstSprite);
    }
    return clone;
}

Node.prototype.registerScriptTouchHandler = function (callback: (eventName: string, px: number, py: number, event?: EventTouch) => void) {
    this.on(NodeEventType.TOUCH_START, (event: EventTouch) => {
        let x = event.getUILocation().x
        let y = event.getUILocation().y
        if (this._touchEnbale == false) {
            event.preventSwallow = true
            return
        }
        callback?.("began", x, y, event);
    })
    this.on(NodeEventType.TOUCH_MOVE, (event: EventTouch) => {
        let x = event.getUILocation().x
        let y = event.getUILocation().y
        if (this._touchEnbale == false) {
            event.preventSwallow = true
            return
        }
        callback?.("moved", x, y, event);
    })
    this.on(NodeEventType.TOUCH_END, (event: EventTouch) => {
        let x = event.getUILocation().x
        let y = event.getUILocation().y
        if (this._touchEnbale == false) {
            event.preventSwallow = true
            return
        }
        callback?.("ended", x, y, event);
    })
    this.on(NodeEventType.TOUCH_CANCEL, (event: EventTouch) => {
        let x = event.getUILocation().x
        let y = event.getUILocation().y
        if (this._touchEnbale == false) {
            event.preventSwallow = true
            return
        }
        callback?.("cancelled", x, y, event);
    })
}

Node.prototype.addClickListener = function (callback, noCheckGuide: boolean = false, checkMove: boolean = true) {
    if (this._clickList == null) {
        this._clickList = []
        this.on(NodeEventType.TOUCH_START, (event: EventTouch) => {
            if (this._touchEnbale == false) {
                event.preventSwallow = true
                return
            }
        })
        this.on(NodeEventType.TOUCH_END, (event: EventTouch) => {
            if (this._touchEnbale == false) {
                event.preventSwallow = true
                return
            }
            if (event.target != this) return
            this._clickList?.forEach(clickInfo => {
                var _checkMove = clickInfo.checkMove
                var _noCheckGuide = clickInfo.noCheckGuide
                var _callback = clickInfo.callback
                if (_checkMove && Vec2.squaredDistance(event.getUILocation(), event.getUIStartLocation()) > 100) {
                    return
                }
                if (isFunction(_callback)) {
                    _callback(event.currentTarget, NodeEventType.TOUCH_END)
                } else {
                    _callback[1].call(_callback[0], event.currentTarget, NodeEventType.TOUCH_END)
                }
            })
        })
    }
    var clickInfo: any = {
        callback: callback,
        noCheckGuide: noCheckGuide,
        checkMove: checkMove
    }
    this._clickList.push(clickInfo)
}

Node.prototype.addTouchListener = function (_callback, _noCheckGuide: boolean = false, _checkMove: boolean = true) {
    if (this._touchList == null) {
        this._touchList = []
        this.on(NodeEventType.TOUCH_START, (event: EventTouch) => {
            if (this._touchEnbale == false) {
                return
            }
            this._touchList?.forEach(clickInfo => {
                var callback = clickInfo.callback
                var checkMove = clickInfo.checkMove
                var noCheckGuide = clickInfo.noCheckGuide
                if (isFunction(callback)) {
                    callback(event.currentTarget, NodeEventType.TOUCH_START, event)
                } else {
                    callback[1].call(callback[0], event.currentTarget, NodeEventType.TOUCH_START, event)
                }
            })
        })

        this.on(NodeEventType.TOUCH_MOVE, (event: EventTouch) => {
            if (this._touchEnbale == false) {
                return
            }
            this._touchList?.forEach(clickInfo => {
                var callback = clickInfo.callback
                var checkMove = clickInfo.checkMove
                var noCheckGuide = clickInfo.noCheckGuide
                if (isFunction(callback)) {
                    callback(event.currentTarget, NodeEventType.TOUCH_MOVE, event)
                } else {
                    callback[1].call(callback[0], event.currentTarget, NodeEventType.TOUCH_MOVE, event)
                }
            })
        })

        this.on(NodeEventType.TOUCH_CANCEL, (event: EventTouch) => {
            if (this._touchEnbale == false) {
                return
            }
            this._touchList?.forEach(clickInfo => {
                var callback = clickInfo.callback
                var checkMove = clickInfo.checkMove
                var noCheckGuide = clickInfo.noCheckGuide
                if (isFunction(callback)) {
                    callback(event.currentTarget, NodeEventType.TOUCH_CANCEL, event)
                } else {
                    callback[1].call(callback[0], event.currentTarget, NodeEventType.TOUCH_CANCEL, event)
                }
            })
        })

        this.on(NodeEventType.TOUCH_END, (event: EventTouch) => {
            if (this._touchEnbale == false) {
                return
            }
            this._touchList?.forEach(clickInfo => {
                var callback = clickInfo.callback
                var checkMove = clickInfo.checkMove
                var noCheckGuide = clickInfo.noCheckGuide
                if (checkMove && Vec2.squaredDistance(event.getUILocation(), event.getUIStartLocation()) > 100) {
                    if (isFunction(callback)) {
                        callback(event.currentTarget, NodeEventType.TOUCH_CANCEL, event)
                    } else {
                        callback[1].call(callback[0], event.currentTarget, NodeEventType.TOUCH_CANCEL, event)
                    }
                    return
                }
                if (isFunction(callback)) {
                    callback(event.currentTarget, NodeEventType.TOUCH_END, event)
                } else {
                    callback[1].call(callback[0], event.currentTarget, NodeEventType.TOUCH_END, event)
                }
            })
        })
    }
    var clickInfo: any = {
        callback: _callback,
        noCheckGuide: _noCheckGuide,
        checkMove: _checkMove
    }
    this._touchList.push(clickInfo)
}

Node.prototype.removeTouchListener = function () {
    if (this._clickList) {
        this._clickList.splice(0)
    }
    if (this._touchList) {
        this._touchList.splice(0)
    }
}

Node.prototype.changeLayer = function (layer: string | number, oriLayerList?: Array<number>) {
    oriLayerList?.push(this.layer);
    if (HIDE_LAYER_FOR_ACTIVE) {
        if (this.layer != hideLayer()) {
            this._srcLayer = this.layer;
        }
    }
    if (isString(layer)) {
        this.layer = 1 << Layers.nameToLayer(layer.toString());
    } else {
        this.layer = Number(layer);
    }
    this.children?.forEach(child => child.changeLayer(layer, oriLayerList))
}


Node.prototype.selfVisible = function () {
    if (HIDE_LAYER_FOR_ACTIVE) {
        if (this.layer == hideLayer()) {
            return this._selfVisible
        }
    }
    return this.active;
}

Node.prototype.isVisible = function (isCamare: boolean = false) {
    if (HIDE_LAYER_FOR_ACTIVE && isCamare) {
        return this.layer != hideLayer()
    }
    return this.active;
}

Node.prototype.setVisible = function (visibility: boolean, isCamare: boolean = false) {
    if (HIDE_LAYER_FOR_ACTIVE && isCamare) {
        if (this.layer != hideLayer()) {
            this._srcLayer = this.layer;
        }
        this.changeLayer(visibility ? this._srcLayer : "Hide", [])
        this._selfVisible = visibility
        return
    }
    this.active = visibility;
}

Node.prototype.getContentSize = function (): Size {
    let transform: UITransform = this.getComponent(UITransform);
    if (!transform) {
        return new Size();
    }
    return new Size(transform.contentSize);
}

Node.prototype.setContentSize = function (size: Size | number, height?: number) {
    let transform: UITransform = this.getComponent(UITransform);
    if (!transform) {
        warn("setContentSize failed, node has no UITransform component", this.name)
        return;
    }
    let originX = transform.contentSize.width;
    let originY = transform.contentSize.height;
    if (height === undefined) {
        size = size as Size;
        if (approx(size.width, originX, EPSILON) && approx(size.height, originY, EPSILON)) {
            return;
        }
        transform.setContentSize(size);
    } else {
        if (approx(size as number, originX, EPSILON) && approx(height, originY, EPSILON)) {
            return;
        }
        transform.setContentSize(size as number, height);
    }
}

Node.prototype.getAnchorPoint = function (): Vec2 {
    let transform: UITransform = this.getComponent(UITransform);
    if (!transform) {
        return new Vec2();
    }
    return new Vec2(transform.anchorPoint);
}

Node.prototype.setAnchorPoint = function (point: number | Vec2, y?: number) {
    let transform: UITransform = this.getComponent(UITransform);
    if (!transform) {
        warn("setAnchorPoint failed, node has no UITransform component", this.name)
        return;
    }
    if (y === undefined) {
        point = point as Vec2;
        transform.setAnchorPoint(point.x, point.y);
    } else {
        transform.setAnchorPoint(point as number, y);
    }
}

Node.prototype.getPositionX = function (): number {
    return this.getPositionCC().x;
}

Node.prototype.setPositionX = function (x: number) {
    this.setPositionCC(x, this.getPositionY())
}

Node.prototype.getPositionY = function (): number {
    return this.getPositionCC().y;
}

Node.prototype.setPositionY = function (y: number) {
    this.setPositionCC(this.getPositionX(), y)
}

Node.prototype.setPositionCC = function (point: number | Vec2, y?: number) {
    let parent: Node = this.parent;
    if (y === undefined) {
        point = point as Vec2;
        y = point.y;
        point = point.x;
    }
    this.setPosition(point as number, y);
}

Node.prototype.getPositionCC = function (outPos?: Vec2): Vec2 {
    if (!outPos) {
        outPos = new Vec2();
    }
    outPos.set(this.position.x, this.position.y)
    return outPos
}
Node.prototype.getWorldPositionCC = function (outPos?: Vec2): Vec2 {
    if (!outPos) {
        outPos = new Vec2();
    }
    outPos.set(this.worldPosition.x, this.worldPosition.y)
    return outPos
}


Node.prototype.setScaleX = function (scaleX: number) {
    this.setScale(scaleX, this.scale.y)
}

Node.prototype.setScaleY = function (scaleY: number) {
    this.setScale(this.getScaleX(), scaleY);
}

Node.prototype.setScaleCC = function (scaleX: number, scaleY?: number) {
    if (scaleY === undefined) {
        this.setScale(scaleX, scaleX, scaleX)
    } else {
        this.setScale(scaleX, scaleY)
    }
}

Node.prototype.getScaleX = function (): number {
    return this.scale.x
}

Node.prototype.getScaleY = function (): number {
    return this.scale.y
}

Node.prototype.getScaleCC = function (): number {
    return this.scale.x
}

Node.prototype.setFlippedX = function (isFlippedX: boolean): void {
    let symbol = isFlippedX ? -1 : 1
    this.setScaleX(symbol * Math.abs(this.scale.x))
}

Node.prototype.setFlippedY = function (isFlippedY: boolean): void {
    let symbol = isFlippedY ? -1 : 1
    this.setScaleY(symbol * Math.abs(this.scale.y))
}

Node.prototype.setLocalZOrder = function (zOrder: number) {
    if (!this.parent) {
        this._zOrder = zOrder;
        return;
    }

    this._zOrder = zOrder;
    let children = this.parent.children;
    let newSibIndex = 0
    for (let index = 0; index < children.length; index++) {
        let sib = children[index]
        if (this == sib) {
            continue
        }
        let sibOrder = sib._zOrder;
        if (sibOrder == null || sibOrder == undefined) {
            sibOrder = 0;
        }
        if (sibOrder > zOrder) {
            break
        }
        ++newSibIndex
    }

    if (this.getSiblingIndex() != newSibIndex) {
        this.setSiblingIndex(newSibIndex);
    }
}

Node.prototype.getLocalZOrder = function () {
    return this._zOrder || 0;
}

Node.prototype.addChildWithOrder = function (child: Node, zOrder: number) {
    let pos = child.getPositionCC();
    this.addChild(child)
    child.setPositionCC(pos.x, pos.y)

    if (zOrder != null && zOrder != undefined) {
        child.setLocalZOrder(zOrder)
    }
}

Node.prototype.addChildCC = function (child: Node, zOrder?: number, tag?: number | string) {
    zOrder = zOrder || child._zOrder || 0
    this.addChild(child)
    child.setLocalZOrder(zOrder)
    if (tag !== undefined) {
        child.setTag(tag);
    }
}

Node.prototype.getChildByFullName = function (path: string) {
    return this.getChildByPath(path);
}

Node.prototype.getChildByPath = function (path: string): Node | null {
    const segments = path.split('/');
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let lastNode: Node = this;
    for (let i = 0; i < segments.length; ++i) {
        var segment = segments[i];
        if (segment.length === 0) {
            continue;
        }
        var index = segment.indexOf('@');
        if (index !== -1) {
            segment = segment.slice(0, index);
        }
        const next = lastNode.children.find((childNode) => {
            if (childNode.name === segment) {
                return true;
            }
            const at = childNode.name.indexOf('@');
            return at !== -1 && childNode.name.slice(0, at) === segment;
        });
        if (!next) {
            return null;
        }
        lastNode = next;
    }
    return lastNode;
}

Node.prototype.getChildrenCount = function () {
    return this.children.length;
}

Node.prototype._tag = "";

Node.prototype.setTag = function (tag: string | number) {
    this._tag = tag;
}

Node.prototype.getTag = function (): string | number {
    return this._tag;
}

Node.prototype.getChildByTag = function (tag: string | number): Node {
    let children = this.children;
    for (let index = 0; index < children.length; index++) {
        let child = children[index];
        if (child.getTag() === tag) {
            return child;
        }
    }
    for (let index = 0; index < children.length; index++) {
        let child = children[index].getChildByTag(tag);
        if (child) {
            return child;
        }
    }
    return null;
}


Node.prototype.removeChildByName = function (name: string) {
    let child = this.getChildByName(name);
    if (child) {
        this.removeChild(child);
        child.destroy();
    }
}

Node.prototype.removeChildByTag = function (tag: string | number, cleanup?: boolean) {
    let child = this.getChildByTag(tag);
    if (child) {
        this.removeChild(child);
        child.destroy();
    }
}

Node.prototype.setName = function (str: string) {
    this.name = str;
}

Node.prototype.getName = function (): string {
    return this.name;
}

Node.prototype.setOpacity = function (opacity: number) {
    let sprite: UIOpacity = this.getComponent(UIOpacity);
    if (!sprite) {
        sprite = this.addComponent(UIOpacity);
    }
    sprite.opacity = opacity;
}

Node.prototype.getOpacity = function (): number {
    let sprite: UIOpacity = this.getComponent(UIOpacity);
    if (!sprite) {
        return 255;
    }
    return sprite.opacity;
}

Node.prototype.setSwallowTouches = function (enabled: boolean) {
    let block = this.getComponent(BlockInputEvents);
    if (enabled) {
        if (!block) {
            block = this.addComponent(BlockInputEvents);
        }
        block.enabled = true;
    } else {
        if (block) {
            block.enabled = false;
        }
    }
}

var loadVideoDispos = (videoPlayer: VideoPlayer) => {
    if (!videoPlayer.node.initLoadTextture) {
        videoPlayer.node.initLoadTextture = true
        videoPlayer.node.on(NodeEventType.NODE_DESTROYED, () => {
            if (videoPlayer && videoPlayer.isValid && videoPlayer.node.isLoadTexture) {
                ResCleaner.removeManualAssets(videoPlayer.clip)
                videoPlayer.node.isLoadTexture = false
            }
        })
    }
}

//-------------- Sprite ----------------//

Node.prototype.loadTexture = function (res: string, callBack?, hideOnStart: boolean = false) {
    if (!res) {
        return
    }
    let sprite: Sprite = this.getComponent(Sprite);
    if (!sprite) {
        return;
    }
    var fileName = res.substring(res.lastIndexOf('/') + 1);
    var indexPoint = fileName.lastIndexOf('.');
    if (indexPoint != -1) {
        fileName = fileName.substring(0, indexPoint);
    }
    if (fileName == this.__resName && sprite.spriteFrame) {
        if (callBack) {
            callBack(null, sprite.spriteFrame);
        }
        return;
    }
    this.__resName = fileName;
    if (hideOnStart) {
        var oldFrame = sprite.spriteFrame;
        sprite.spriteFrame = null;
        if (sprite.node.isLoadTexture) {
            ResCleaner.removeManualAssets(oldFrame)
        }
        sprite.node.isLoadTexture = false;
    }
    loadResAsync(EBundleType.ui, res, SpriteFrame, (err, spriteFrame) => {
        if (spriteFrame && sprite && sprite.isValid && this.__resName == spriteFrame.name) {
            var oldFrame = sprite.spriteFrame;
            sprite.spriteFrame = spriteFrame;
            if (sprite.node.isLoadTexture) {
                ResCleaner.removeManualAssets(oldFrame)
            }
            sprite.node.isLoadTexture = true;
            ResCleaner.addManualAssets(spriteFrame)
            loadTextureDispos_sprite(sprite)
            if (callBack) {
                callBack(null, spriteFrame);
            }
        } else {
            ResCleaner.removeManualAssets(spriteFrame)
        }
    })
}

var loadTextureDispos_sprite = (sprite: Sprite) => {
    if (!sprite.node.initLoadTextture) {
        sprite.node.initLoadTextture = true
        sprite.node.on(NodeEventType.NODE_DESTROYED, () => {
            if (sprite && sprite.isValid && sprite.node.isLoadTexture) {
                ResCleaner.removeManualAssets(sprite.spriteFrame)
                sprite.node.isLoadTexture = false
            }
        })
    }
}

var loadTextureDispos_button = (button: Button) => {
    if (!button.node.initLoadTextture) {
        button.node.initLoadTextture = true
        button.node.on(NodeEventType.NODE_DESTROYED, () => {
            if (!button || !button.isValid) {
                return
            }
            if (button.node.isLoadNormalSprite) {
                ResCleaner.removeManualAssets(button.normalSprite)
                button.node.isLoadNormalSprite = false
            }
            if (button.node.isLoadPressedSprite) {
                ResCleaner.removeManualAssets(button.pressedSprite)
                button.node.isLoadNormalSprite = false
            }
            if (button.node.isLoadDisabledSprite) {
                ResCleaner.removeManualAssets(button.disabledSprite)
                button.node.isLoadNormalSprite = false
            }
            if (button.node.isLoadHoverSprite) {
                ResCleaner.removeManualAssets(button.hoverSprite)
                button.node.isLoadNormalSprite = false
            }
        })
    }
}

Node.prototype.updateTexture = function (res: string, callBack?, hideOnStar: boolean = false) {
    this.loadTexture(res, callBack, hideOnStar);
}

Node.prototype.loadTextures = function (res: string, res1: string, res2: string) {
    this.loadTextureNormal(res);
    this.loadTexturePressed(res1);
    this.loadTextureDisabled(res2);
}

//-------------- Button ----------------//

Node.prototype.setTouchEnabled = function (enabled: boolean) {
    let button: Button = this.getComponent(Button);
    if (button) {
        button.interactable = enabled;
    }
    var block: BlockInputEvents = this.getComponent(BlockInputEvents);
    if (block) {
        block.enabled = enabled;
    }
    this._touchEnbale = enabled
}

Node.prototype.setEnabled = function (enabled: boolean) {
    this.setTouchEnabled(enabled);
}

Node.prototype.setTitleText = function (text: string) {
    let title = this.getChildByName("Label");
    if (title) {
        let label = title.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }
}

Node.prototype.loadTextureNormal = function (res: string) {
    if (!res) {
        return
    }
    let button: Button = this.getComponent(Button);
    if (!button) {
        return;
    }
    var fileName = res.substring(res.lastIndexOf('/') + 1);
    var indexPoint = fileName.lastIndexOf('.');
    if (indexPoint != -1) {
        fileName = fileName.substring(0, indexPoint);
    }
    if (fileName == this.__resNameNormal && button.normalSprite) {
        return;
    }
    this.__resNameNormal = fileName;
    loadResAsync(EBundleType.ui, res, SpriteFrame, (err, spriteFrame) => {
        if (spriteFrame && button && button.isValid && this.__resNameNormal == spriteFrame.name) {
            var oldFrame = button.normalSprite;
            button.normalSprite = spriteFrame;
            if (button.node.isLoadNormalSprite) {
                ResCleaner.removeManualAssets(oldFrame)
            }
            button.node.isLoadNormalSprite = true
            loadTextureDispos_button(button)
        } else {
            ResCleaner.removeManualAssets(spriteFrame)
        }
    })
}



Node.prototype.loadTexturePressed = function (res: string) {
    if (!res) {
        return
    }
    let button: Button = this.getComponent(Button);
    if (!button) {
        return;
    }
    var fileName = res.substring(res.lastIndexOf('/') + 1);
    var indexPoint = fileName.lastIndexOf('.');
    if (indexPoint != -1) {
        fileName = fileName.substring(0, indexPoint);
    }
    if (fileName == this.__resNamePressed && button.pressedSprite) {
        return;
    }
    this.__resNamePressed = fileName;
    loadResAsync(EBundleType.ui, res, SpriteFrame, (err, spriteFrame) => {
        if (spriteFrame && button && button.isValid && this.__resNamePressed == spriteFrame.name) {
            var oldFrame = button.pressedSprite;
            button.pressedSprite = spriteFrame;
            if (button.node.isLoadPressedSprite) {
                ResCleaner.removeManualAssets(oldFrame)
            }
            button.node.isLoadPressedSprite = true
            loadTextureDispos_button(button)
        } else {
            ResCleaner.removeManualAssets(spriteFrame)
        }
    })
}

Node.prototype.loadTextureDisabled = function (res: string) {
    if (!res) {
        return
    }
    let button: Button = this.getComponent(Button);
    if (!button) {
        return;
    }
    var fileName = res.substring(res.lastIndexOf('/') + 1);
    var indexPoint = fileName.lastIndexOf('.');
    if (indexPoint != -1) {
        fileName = fileName.substring(0, indexPoint);
    }
    if (fileName == this.__resNameDisabled && button.disabledSprite) {
        return;
    }
    this.__resNameDisabled = fileName;
    loadResAsync(EBundleType.ui, res, SpriteFrame, (err, spriteFrame) => {
        if (spriteFrame && button && button.isValid && this.__resNameDisabled == spriteFrame.name) {
            var oldFrame = button.disabledSprite;
            button.disabledSprite = spriteFrame;
            if (button.node.isLoadDisabledSprite) {
                ResCleaner.removeManualAssets(oldFrame)
            }
            button.node.isLoadDisabledSprite = true
            loadTextureDispos_button(button)
        } else {
            ResCleaner.removeManualAssets(spriteFrame)
        }
    })
}

Node.prototype.loadTextureHover = function (res: string, type?: number) {
    if (!res) {
        return
    }
    let button: Button = this.getComponent(Button);
    if (!button) {
        return;
    }

    var fileName = res.substring(res.lastIndexOf('/') + 1);
    var indexPoint = fileName.lastIndexOf('.');
    if (indexPoint != -1) {
        fileName = fileName.substring(0, indexPoint);
    }
    if (fileName == this.__resNameHover && button.hoverSprite) {
        return;
    }
    this.__resNameHover = fileName;
    loadResAsync(EBundleType.ui, res, SpriteFrame, (err, spriteFrame) => {
        if (spriteFrame && button && button.isValid && this.__resNameHover == spriteFrame.name) {
            var oldFrame = button.hoverSprite;
            button.hoverSprite = spriteFrame;
            if (button.node.isLoadHoverSprite) {
                ResCleaner.removeManualAssets(oldFrame)
            }
            button.node.isLoadHoverSprite = true
            loadTextureDispos_button(button)
        } else {
            ResCleaner.removeManualAssets(spriteFrame)
        }
    })
}

//-------------- Lable ----------------//

Node.prototype.setString = function (str: string, refresh: boolean = false, ignoreImg: boolean = false) {
    let label: Label = this.getComponent(Label);
    if (!label) {
        let richText: RichText = this.getComponent(RichText);
        if (richText) {
            richText.string = tostring(str);
        }
        return;
    }
    label.string = tostring(str);
    if (refresh) {
        label.updateRenderData(true);
    }
}

Node.prototype.getString = function () {
    let label: Label = this.getComponent(Label);
    if (!label) {
        let richText: RichText = this.getComponent(RichText);
        if (richText) {
            return richText.string;
        }
    }
    return label.string;
}


Node.prototype.setTextHorizontalAlignment = function (alignment: HorizontalTextAlignment) {
    let label: Label = this.getComponent(Label);
    if (!label) {
        return;
    }
    label.horizontalAlign = alignment;
}

Node.prototype.setTextVerticalAlignment = function (alignment: VerticalTextAlignment) {
    let label: Label = this.getComponent(Label);
    if (!label) {
        return;
    }
    label.verticalAlign = alignment;
}

Node.prototype.setOutline = function (color: Color = Color.BLACK, width: number = 2) {
    let label: Label = this.getComponent(Label);
    if (!label) {
        return;
    }
    label.enableOutline = true;
    label.outlineColor = color;
    label.outlineWidth = width;
}

Node.prototype.setShadow = function (color: Color, size: Size, blurRadius?: number) {
    let label: Label = this.getComponent(Label);
    if (!label) {
        return;
    }
    label.enableShadow = true;
    label.shadowColor = color;
    label.shadowOffset = new Vec2(size.width, size.height);
    if (blurRadius != null && "shadowBlur" in label) {
        (label as any).shadowBlur = blurRadius;
    }
}

Node.prototype.setColor = function (color: Color) {
    let label: Label = this.getComponent(Label);
    if (label) {
        label.color = color;
        return;
    }
    let sprite: Sprite = this.getComponent(Sprite)
    if (sprite) {
        sprite.color = color
        return;
    }
}

Node.prototype.setTextColor = function (color: Color) {
    let label: Label = this.getComponent(Label);
    if (!label || color == null) {
        return;
    }
    label.color = color;
}

//-------------- Checkbox ----------------//

Node.prototype.isSelected = function (): boolean {
    let toggle: Toggle = this.getComponent(Toggle);
    if (!toggle) {
        return;
    }
    return toggle.isChecked;
}

Node.prototype.setSelected = function (selected: boolean) {
    let toggle: Toggle = this.getComponent(Toggle);
    if (!toggle) {
        return;
    }
    toggle.isChecked = selected;
}

Node.prototype.getOBB = function (refresh: boolean = true) {
    let node = this;
    const uiTransform = node.getComponent(UITransform);
    if (!uiTransform) return null;
    if (refresh && this.obb) {
        this.preObb = this.obb;
    }
    if (!refresh && this.obb) {
        return this.obb;
    }

    // 1. 获取节点的原始尺寸和锚点偏移
    const { width, height } = uiTransform;
    const { x, y } = uiTransform.anchorPoint;

    // 2. 定义局部坐标系下的四个顶点（基于锚点计算偏移）
    const localPos = [
        new Vec3(-x * width, -y * height, 0),          // 左下
        new Vec3((1 - x) * width, -y * height, 0),     // 右下
        new Vec3((1 - x) * width, (1 - y) * height, 0),// 右上
        new Vec3(-x * width, (1 - y) * height, 0)      // 左上
    ];

    // 3. 获取节点的世界变换矩阵
    const worldMatrix = node.getWorldMatrix();

    // 4. 将局部坐标转换为世界坐标
    const worldPositions = localPos.map(p => {
        const out = new Vec3();
        Vec3.transformMat4(out, p, worldMatrix);
        return out;
    });

    const [lb, rb, rt, lt] = worldPositions;

    // 1. 计算中心点 (对角线的中心)
    const center = new Vec3();
    Vec3.add(center, lb, rt);
    Vec3.multiplyScalar(center, center, 0.5);

    // 2. 计算方向轴 (归一化的向量)
    const axisX = new Vec3();
    Vec3.subtract(axisX, rb, lb);
    const halfWidth = axisX.length() * 0.5; // 计算半轴长
    axisX.normalize();

    const axisY = new Vec3();
    Vec3.subtract(axisY, lt, lb);
    const halfHeight = axisY.length() * 0.5; // 计算半轴长
    axisY.normalize();

    // 3. 构建旋转矩阵 (Orientation)
    // 2D 情况下 Z 轴通常为 (0,0,1)
    const rotationMatrix = new Mat3();
    Mat3.set(rotationMatrix,
        axisX.x, axisX.y, 0,
        axisY.x, axisY.y, 0,
        0, 0, 1
    );

    // 4. 实例化 OBB
    const outObb = new geometry.OBB();
    outObb.center = center;
    outObb.halfExtents = new Vec3(halfWidth, halfHeight, 1); // 2D 深度设为 1 或极小值
    outObb.orientation = rotationMatrix;
    this.obb = outObb;
    return outObb;
}

Node.prototype.getAABB = function (refreshPos = true, refreshExtents?: boolean, refreshScale?: boolean) {
    let trans: UITransform = this.getComponent(UITransform);
    if (!trans) {
        return null;
    }
    let aabb = this.aabb as geometry.AABB;
    let node: Node = this;
    if (!aabb) {
        aabb = new geometry.AABB();
        this.aabb = aabb;
    }
    let rect: Rect = this.rect;
    if (!rect) {
        rect = trans.getBoundingBoxToWorld();
        this.rect = rect;
    }
    if (refreshPos) {
        let worldPos = node.worldPosition;
        let x = worldPos.x - trans.anchorX * trans.width;
        let y = worldPos.y - trans.anchorY * trans.height;
        rect.x = x;
        rect.y = y;
    }
    if (refreshExtents) {
        rect.width = trans.width;
        rect.height = trans.height;
    }
    if (refreshScale) {
        rect.width *= node.getScaleX();
        rect.height *= node.getScaleY();
    }
    rectToAABB(aabb, rect);
    return aabb;
}