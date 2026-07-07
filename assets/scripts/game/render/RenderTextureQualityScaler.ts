import {
    _decorator,
    Camera,
    Canvas,
    Component,
    director,
    Node,
    RenderTexture,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec3,
    view,
    warn,
} from 'cc';
import { GraphicsQualityService } from './GraphicsQualityService';
import { GRAPHICS_QUALITY_SCALE } from './GraphicsQualityLevel';

const { ccclass } = _decorator;

/** __UIAreaLayer 离屏缩放层（与曾验证可用的方案一致） */
const SCALED_LAYER = 1 << 21;
/** RT 全屏展示层 */
const DISPLAY_LAYER = 1 << 20;
/** HUD / 弹窗直出层 */
const UI_LAYER = 1 << 22;

const NAME_AREA_LAYER = '__UIAreaLayer';
const NAME_POPUP_LAYER = '__UIPopupLayer';
const NAME_HUD_LAYER = '__UIHUDLayer';
const NAME_OVERLAY_ROOT = '__QualityDisplayRoot';
const NAME_POST_CANVAS = 'PostCanvas';
const NAME_DISPLAY_SPRITE = 'QualityDisplaySprite';
const NAME_DISPLAY_CAMERA = 'PostCamera';
const NAME_UI_CAMERA_NODE = 'UILayerCamera';

/**
 * GameLayer / UILayer 分离：
 * - __UIAreaLayer → SCALED_LAYER → 主相机 → RT → PostCanvas 全屏展示
 * - __UIHUDLayer / __UIPopupLayer → UI_LAYER → UI 相机直出
 */
@ccclass('RenderTextureQualityScaler')
export class RenderTextureQualityScaler extends Component {
    private _gameCamera: Camera | null = null;
    private _sourceCanvas: Node | null = null;
    private _gameCameraOriginalVisibility = 0;
    private _renderTexture: RenderTexture | null = null;
    private _displaySpriteFrame: SpriteFrame | null = null;
    private _overlayRoot: Node | null = null;
    private _displayCamera: Camera | null = null;
    private _uiCamera: Camera | null = null;
    private _displaySprite: Sprite | null = null;
    private _scalingActive = false;
    private _areaLayerBackup = new Map<Node, number>();
    private _uiLayerBackup = new Map<Node, number>();

    onLoad(): void {
        this._resolveGameCamera();
        this._buildPipelines();
        GraphicsQualityService.registerScaler(this);
        view.on('canvas-resize', this._onCanvasResize, this);
    }

    start(): void {
        this.scheduleOnce(() => this.applyQuality(), 0);
    }

    scheduleApplyQuality(): void {
        this.unschedule(this._applyQualityDeferred);
        this.scheduleOnce(this._applyQualityDeferred, 0);
    }

    private _applyQualityDeferred = (): void => {
        this.applyQuality();
    };

    syncLayers(): void {
        if (!this._scalingActive) {
            return;
        }
        this._applyUILayers();
    }

    onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResize, this);
        GraphicsQualityService.unregisterScaler(this);
        this._teardown();
    }

    applyQuality(): void {
        if (!this._gameCamera || !this._overlayRoot || !this._displaySprite || !this._displayCamera) {
            return;
        }

        const scale = GRAPHICS_QUALITY_SCALE[GraphicsQualityService.getCurrent()];
        if (scale >= 1) {
            this._disableScaling();
            return;
        }

        const areaLayer = this._sourceCanvas?.getChildByName(NAME_AREA_LAYER);
        if (!areaLayer) {
            warn('[RenderTextureQualityScaler] __UIAreaLayer 未就绪，暂不启用 RT');
            this._disableScaling();
            return;
        }

        this._applyAreaScaledLayers();
        this._applyUILayers();
        this._ensureRenderTarget(scale);

        this._gameCamera.targetTexture = this._renderTexture;
        this._gameCamera.visibility = SCALED_LAYER;

        this._overlayRoot.active = true;
        if (this._uiCamera) {
            this._uiCamera.node.active = true;
        }

        this._syncLayout();
        this._applyDisplaySprite();
        this._scalingActive = true;
    }

    private _applyAreaScaledLayers(): void {
        this._restoreAreaLayers();
        const areaLayer = this._sourceCanvas?.getChildByName(NAME_AREA_LAYER);
        if (!areaLayer) {
            return;
        }
        this._setLayerRecursive(areaLayer, SCALED_LAYER, this._areaLayerBackup);
    }

    private _applyUILayers(): void {
        this._restoreUILayers();
        const hud = this._sourceCanvas?.getChildByName(NAME_HUD_LAYER);
        const popup = this._sourceCanvas?.getChildByName(NAME_POPUP_LAYER);
        if (hud) {
            this._setLayerRecursive(hud, UI_LAYER, this._uiLayerBackup);
        }
        if (popup) {
            this._setLayerRecursive(popup, UI_LAYER, this._uiLayerBackup);
        }
    }

    private _applyDisplaySprite(): void {
        if (!this._displaySprite || !this._renderTexture) {
            return;
        }
        if (!this._displaySpriteFrame) {
            this._displaySpriteFrame = new SpriteFrame();
        }
        this._displaySprite.customMaterial = null;
        this._displaySpriteFrame.texture = this._renderTexture;
        this._displaySprite.spriteFrame = this._displaySpriteFrame;
    }

    private _disableScaling(): void {
        this._restoreAreaLayers();
        this._restoreUILayers();
        if (this._gameCamera) {
            this._gameCamera.targetTexture = null;
            this._gameCamera.visibility = this._gameCameraOriginalVisibility;
        }
        if (this._overlayRoot) {
            this._overlayRoot.active = false;
        }
        if (this._uiCamera) {
            this._uiCamera.node.active = false;
        }
        this._scalingActive = false;
    }

    private _restoreAreaLayers(): void {
        for (const [node, layer] of this._areaLayerBackup) {
            if (node.isValid) {
                node.layer = layer;
            }
        }
        this._areaLayerBackup.clear();
    }

    private _restoreUILayers(): void {
        for (const [node, layer] of this._uiLayerBackup) {
            if (node.isValid) {
                node.layer = layer;
            }
        }
        this._uiLayerBackup.clear();
    }

    private _setLayerRecursive(node: Node, layer: number, backup: Map<Node, number>): void {
        if (!backup.has(node)) {
            backup.set(node, node.layer);
        }
        node.layer = layer;
        for (const child of node.children) {
            this._setLayerRecursive(child, layer, backup);
        }
    }

    private _resolveGameCamera(): void {
        const scene = director.getScene();
        if (!scene) {
            return;
        }
        const canvasNode = scene.getChildByName('Canvas');
        if (!canvasNode) {
            warn('[RenderTextureQualityScaler] 未找到 Canvas');
            return;
        }
        this._sourceCanvas = canvasNode;
        const canvas = canvasNode.getComponent(Canvas);
        this._gameCamera = canvas?.cameraComponent ?? canvasNode.getComponentInChildren(Camera);
        if (!this._gameCamera) {
            warn('[RenderTextureQualityScaler] 未找到游戏相机');
            return;
        }
        this._gameCameraOriginalVisibility = this._gameCamera.visibility;
    }

    private _buildPipelines(): void {
        const scene = director.getScene();
        if (!scene || !this._sourceCanvas || !this._gameCamera) {
            return;
        }
        this._overlayRoot = this._createDisplayPipeline(scene);
        this._uiCamera = this._createUILayerCamera();
    }

    /** 场景根节点独立 PostCanvas，对齐主 Canvas 变换（曾验证可用的展示管线） */
    private _createDisplayPipeline(scene: Node): Node {
        const canvasUi = this._sourceCanvas!.getComponent(UITransform);
        if (!canvasUi) {
            warn('[RenderTextureQualityScaler] Canvas 缺少 UITransform');
            return new Node(NAME_OVERLAY_ROOT);
        }

        const overlayRoot = new Node(NAME_OVERLAY_ROOT);
        scene.addChild(overlayRoot);
        overlayRoot.layer = DISPLAY_LAYER;
        overlayRoot.setPosition(this._sourceCanvas!.position);
        overlayRoot.setRotation(this._sourceCanvas!.rotation);
        overlayRoot.setScale(this._sourceCanvas!.scale);
        overlayRoot.active = false;

        const postCanvas = new Node(NAME_POST_CANVAS);
        postCanvas.parent = overlayRoot;
        postCanvas.layer = DISPLAY_LAYER;
        const postUi = postCanvas.addComponent(UITransform);
        postUi.setContentSize(canvasUi.contentSize);
        postUi.setAnchorPoint(canvasUi.anchorPoint);

        const camNode = new Node(NAME_DISPLAY_CAMERA);
        camNode.parent = postCanvas;
        camNode.layer = DISPLAY_LAYER;
        camNode.setPosition(this._gameCamera!.node.position);

        const displayCamera = camNode.addComponent(Camera);
        const postCanvasComp = postCanvas.addComponent(Canvas);
        postCanvasComp.cameraComponent = displayCamera;
        postCanvasComp.alignCanvasWithScreen = true;

        this._copyCameraParams(displayCamera, this._gameCamera!);
        displayCamera.priority = (this._gameCamera!.priority ?? 0) + 100;
        displayCamera.visibility = DISPLAY_LAYER;
        displayCamera.targetTexture = null;
        displayCamera.clearFlags = this._gameCamera!.clearFlags;

        const spriteNode = new Node(NAME_DISPLAY_SPRITE);
        spriteNode.parent = postCanvas;
        spriteNode.layer = DISPLAY_LAYER;
        spriteNode.setPosition(Vec3.ZERO);
        const spriteUi = spriteNode.addComponent(UITransform);
        spriteUi.setContentSize(canvasUi.contentSize);
        spriteUi.setAnchorPoint(0.5, 0.5);

        const sprite = spriteNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        this._displayCamera = displayCamera;
        this._displaySprite = sprite;
        return overlayRoot;
    }

    private _createUILayerCamera(): Camera {
        const camNode = new Node(NAME_UI_CAMERA_NODE);
        this._sourceCanvas!.addChild(camNode);
        camNode.layer = UI_LAYER;
        camNode.setPosition(this._gameCamera!.node.position);
        camNode.active = false;

        const uiCamera = camNode.addComponent(Camera);
        this._copyCameraParams(uiCamera, this._gameCamera!);
        uiCamera.priority = (this._gameCamera!.priority ?? 0) + 200;
        uiCamera.visibility = UI_LAYER;
        uiCamera.targetTexture = null;
        uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        return uiCamera;
    }

    private _syncLayout(): void {
        if (!this._overlayRoot || !this._displaySprite || !this._displayCamera || !this._gameCamera || !this._sourceCanvas) {
            return;
        }

        this._overlayRoot.setPosition(this._sourceCanvas.position);
        this._overlayRoot.setRotation(this._sourceCanvas.rotation);
        this._overlayRoot.setScale(this._sourceCanvas.scale);
        this._copyCameraParams(this._displayCamera, this._gameCamera);

        if (this._uiCamera) {
            this._copyCameraParams(this._uiCamera, this._gameCamera);
            this._uiCamera.node.setPosition(this._gameCamera.node.position);
        }

        const visibleSize = view.getVisibleSize();
        const postCanvas = this._overlayRoot.getChildByName(NAME_POST_CANVAS);
        postCanvas?.getComponent(UITransform)?.setContentSize(visibleSize.width, visibleSize.height);
        this._displaySprite.node.getComponent(UITransform)?.setContentSize(visibleSize.width, visibleSize.height);
    }

    private _ensureRenderTarget(scale: number): void {
        const size = this._getRenderSize(scale);
        if (!this._renderTexture) {
            this._renderTexture = new RenderTexture();
            this._renderTexture.reset({ width: size.width, height: size.height });
        } else {
            this._renderTexture.resize(size.width, size.height);
        }
    }

    private _getRenderSize(scale: number): Size {
        const vs = view.getVisibleSize();
        return new Size(
            Math.max(1, Math.floor(vs.width * scale)),
            Math.max(1, Math.floor(vs.height * scale)),
        );
    }

    private _copyCameraParams(dst: Camera, src: Camera): void {
        dst.projection = src.projection;
        dst.orthoHeight = src.orthoHeight;
        dst.near = src.near;
        dst.far = src.far;
    }

    private _teardown(): void {
        this._disableScaling();
        this._overlayRoot?.destroy();
        this._overlayRoot = null;
        this._uiCamera?.node.destroy();
        this._uiCamera = null;
        this._renderTexture?.destroy();
        this._renderTexture = null;
        this._displaySpriteFrame?.destroy();
        this._displaySpriteFrame = null;
        this._displayCamera = null;
        this._displaySprite = null;
    }

    private _onCanvasResize = (): void => {
        if (!this._scalingActive) {
            return;
        }
        this.applyQuality();
    };
}
