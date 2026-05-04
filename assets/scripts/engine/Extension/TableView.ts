/*
 * @Author: wangshuaihua@playcarb.com
 * @Date: 2024-03-04 09:59:34
 * @LastEditors: wangshuaihua@playcarb.com
 * @LastEditTime: 2024-05-31 11:07:21
 * @FilePath: \koscreator\assets\scripts\engine\extend\TableView.ts
 * @Description: File Description
 */
import { CCInteger, Component, Enum, EventTouch, Mask, Node, NodeEventType, ScrollView, Size, UIOpacity, UITransform, Vec2, Vec3, Widget, _decorator, math } from 'cc';
import './NodeExt';
import { CC_INVALID_INDEX, TableViewCellNode, TableViewDataSource } from './TableViewDataSource';
const { ccclass, property, menu } = _decorator;
/**
 * 翻译的 cocos2dx cc.TableView
 * 注意：
 *      1. cell 的锚点是 0, 0
 *      2. 只支持垂直滚动或水平滚动，不支持双向滚动
 * 函数：
 *      设置单元格间距的 setInterval(0, 0, 0)
 *      重新加载数据 reloadData(false)            添加参数(isUseLastOffset:是否使用上一次的容器偏移量)
 *      查找索引处的单元格 cellAtIndex(0)
 *      更新索引处的单元格 updateCellAtIndex(0)
 *      滚动到索引处的单元格 scrollToIndex(0)
 * 未实现：
 *      指定索引处插入新单元格 insertCellAtIndex
 *      删除指定索引处的单元格 removeCellAtIndex
 */

export enum VerticalFillOrder { TOP_DOWN = 0, BOTTOM_UP = 1 }

export enum ScrollViewDirection {
    HORIZONTAL = 1,
    VERTICAL = 2,
}

export enum TableViewOffSetType {
    none = "none",
    top = "top",
    bottom = "bottom",
    left = "left",
    right = "right",
    // 完全显示在视图中
    appear = "appear",
    center = "center",
}

/** 
 * @description 创建一个TableView，所需要的数据
 */
export interface TableViewData {

    /** Required */
    /** tableview的Node */
    tableView: Node
    /** 默认用tableView本身的size */
    viewSize?: Size
    /** 用来获取clone的模板cell的方法, 参数(index) */
    getCellFunc?: (index: number) => Node
    /** 获取要创建的cell数量的方法(建议不超过50万) */
    getCellCountFunc?: () => number

    /* Optional */
    /** 是否允许事件向下传递 */
    preventSwallow?: boolean

    /** tableView的滚动方向(默认竖向滚动) */
    direction?: ScrollViewDirection
    /** 单元格垂直填充顺序(默认从上到下) */
    fillOrder?: VerticalFillOrder
    /** 是否回弹(默认false) */
    bounceable?: boolean
    /** 设置一行多少个cell(设置对性能比较好, 仅支持相同的cell) */
    columnNum?: number,
    /**行的边缘间距 */
    columnEdgeInterval?: number,

    /**是否是pageview */
    isPageView?: boolean
    /** page变化回调 */
    onPageIndexChanged?: (index: number) => void
    /**关闭滑动。默认是开启的 */
    isTouchEnabled?: boolean

    /** 设置单元格间距的 setInterval(0, 0, 0) */
    starInterval?: number
    midInterval?: number
    endInterval?: number

    /** 是否Zorder反转排序 */
    isInvertedZOrder?: boolean

    /** 用来获取cell的尺寸的方法, 参数(index) */
    getCellSizeFunc?: (index: number) => Size
    /** 刷新cell的方法, 参数(cell, index) */
    refreshCellFunc: (cellRect: Node, index: number) => void
    /** cell被点击后调用的方法, 参数(index) */
    selectCellFunc?: (index: number) => void
    /** cell刚被按下时调用的方法, 参数(index) */
    willSelectCellFunc?: (index: number) => void
    /** cell被取消点击时调用的方法, 参数(index) */
    cancelSelectCellFunc?: (index: number) => void

    /** Slider */
    /** TableView的滑动条, 传入的是path就创建 */
    slider?: Node | string

    /** ScorllEdge */
    /** 滚动到顶部回调 */
    scorllTopCallback?: () => void
    /** 滚动到底部回调 */
    scorllBottomCallback?: () => void
    /** 滚动到左边回调 */
    scorllLeftCallback?: () => void
    /** 滚动到右边回调 */
    scorllRightCallback?: () => void

    /** 滚动 */
    scrollViewDidScroll?: () => void
    /** 滚动停止 */
    scrollViewStopScroll?: () => void

    /** 是否渐变消失或出现 */
    isFade?: boolean
}

@ccclass
@menu("Extend/TableView")
export default class TableView extends Component {
    @property({ serializable: true })
    private _direction: ScrollViewDirection = ScrollViewDirection.VERTICAL;
    @property({ type: Enum(ScrollViewDirection), tooltip: "HORIZONTAL水平 、VERTICAL垂直" })
    get direction() {
        return this._direction;
    }
    set direction(value: ScrollViewDirection) {
        if (this._direction == value) {
            return
        }
        this._direction = value;
        this.updateDirection()
    }

    @property({ type: Enum(VerticalFillOrder), tooltip: "单元格垂直填充顺序" })
    private vordering: VerticalFillOrder = VerticalFillOrder.TOP_DOWN;

    @property({ type: CCInteger, tooltip: "第一个单元格和边框的间隔" })
    private starInterval: number = 0;
    @property({ type: CCInteger, tooltip: "单元格之间的间隔" })
    private midInterval: number = 0;
    @property({ type: CCInteger, tooltip: "最后一个单元格和边框的间隔" })
    private endInterval: number = 0;

    @property({ tooltip: "是否为分页列表(一次滑动一页)" })
    public isPageView: boolean = false;
    private _curPageIndex: number = -1;
    public getCurPageIndex() {
        return this._curPageIndex
    }
    private _prePageIndex: number = -1;
    private _pageOffset: number = 0
    public ssetPageOffset(offset: number) {
        this._pageOffset = offset
    }

    private _preventSwallow: boolean = false;
    public set preventSwallow(value: boolean) {
        this._preventSwallow = value;
    }

    private _curPageOffset: Vec2 = new Vec2(0, 0);
    private _pageChanged: boolean = false
    public setPageIndex(index: number, animated: boolean = true) {
        if (!this.isPageView) {
            return
        }
        index = math.clamp(index, 0, this._cellsPositions.length - 2)
        this._prePageIndex = index
        if (index != this._curPageIndex) {
            this._pageChanged = true
        }
        // this._curPageIndex = index;
        this.scrollToIndex(index, animated);
        if (!animated) {
            this.onPageIndexChanged()
        }
    }

    public onPageIndexChanged() {
        this._pageChanged = false
        if (this._prePageIndex != this._curPageIndex) {
            this._curPageIndex = this._prePageIndex
            // console.log("onPageIndexChanged", this._curPageIndex)
            if (this._dataSource != null) {
                this._dataSource.onPageIndexChanged(this._curPageIndex)
            }
        } else {
            // console.log("onPageIndexChanged  false", this._curPageIndex)
        }
    }

    public setTableInterval(star: number, mid: number, end: number) {
        if (star != null) {
            this.starInterval = star
        }
        if (mid != null) {
            this.midInterval = mid
        }
        if (end != null) {
            this.endInterval = end
        }
    }

    public setTableIntervalWithRefresh(star: number, mid: number, end: number) {
        this.setTableInterval(star, mid, end)
        this.onSizeChange()
    }

    private _animationTime: number = 0.2
    set animationTime(value: number) {
        this._animationTime = value;
    }

    private _scrollView: ScrollView = null;
    get scrollView(): ScrollView {
        return this._scrollView;
    }
    set scrollView(value: ScrollView) {
        this._scrollView = value;
    }

    private _dataSource: TableViewDataSource;

    private _indices: Set<number>                                     //索引集用于查询所使用单元格的索引
    private _cellsPositions: number[] = [];                                 //所有单元格位置
    get cellsPositions() {
        return this._cellsPositions
    }
    //当前在表中的单元格
    private _cellsUsed: TableViewCellNode[] = [];
    public getCellsUsed(): TableViewCellNode[] {
        return this._cellsUsed
    }
    private _cellsFreed: TableViewCellNode[] = [];                          //未使用的单元格
    private _isUsedCellsDirty: boolean = false;                             //使用的单元格是否进行排序
    private _isInit: boolean = false;

    private _oldDirection: ScrollViewDirection = null

    private _viewSize: Size = new Size();

    private _viewNode: Node
    get viewNode() { return this._viewNode }

    private _isFade: boolean
    setIsFade(__newVal: boolean) { this._isFade = __newVal }

    public initWithSize(size?: Size) {
        if (this._isInit)
            return;
        if (size) {
            this.node.setContentSize(size);
        }

        this._viewSize.set(this.node.getContentSize())
        this._isInit = true;
        this.node.getComponent(ScrollView)?.destroy();
        this.node.destroyAllChildren();
        this.scrollView = this.node.addComponent(ScrollView);
        let parentSize: Size = this.node.getContentSize()
        let viewNode: Node = new Node("view")
        let viewTrans: UITransform = viewNode.addComponent(UITransform)
        viewTrans.anchorPoint = new Vec2(0, 1) //anchor at left top
        viewTrans.contentSize = parentSize
        let widget = viewNode.addComponent(Widget)
        widget.alignMode = 1
        widget.isAlignTop = true
        widget.isAlignBottom = true
        widget.isAlignLeft = true
        widget.top = 0
        widget.bottom = 0
        widget.left = 0
        this.node.addChild(viewNode)
        viewNode.addComponent(Mask)

        this._viewNode = viewNode
        this._viewNode.on(NodeEventType.SIZE_CHANGED, this.onSizeChange, this);

        let contentNode: Node = new Node("content")
        let contentTrans: UITransform = contentNode.addComponent(UITransform)
        viewNode.addChild(contentNode)
        contentTrans.anchorPoint = new Vec2(0, 1) //anchor at left top
        contentTrans.contentSize = parentSize
        this.scrollView.content = contentNode
        this.updateDirection()

        this._indices = new Set<number>();

        this.node.on(NodeEventType.TOUCH_START, this.onTableViewTouchBegan, this, true);
        this.node.on(NodeEventType.TOUCH_MOVE, this.onTableViewTouchMoved, this, true);
        this.node.on(NodeEventType.TOUCH_END, this.onTableViewTouchEnded, this, true);
        this.node.on(NodeEventType.TOUCH_CANCEL, this.onTableViewTouchCancel, this, true);
    }

    onSizeChange() {
        this._viewSize.set(this.node.getContentSize())
        // this.reloadTableViewData()
        this._updateContentSize();
        this._updateCellShowStatus();
        this.scrollView["_calculateBoundary"]()
    }

    onTableViewTouchBegan(event: EventTouch) {
        if (this._preventSwallow) {
            event.preventSwallow = true;
        }
        this._dataSource.onTableViewTouchBegan(event)
    }

    onTableViewTouchMoved(event: EventTouch) {
        if (this._preventSwallow) {
            event.preventSwallow = true;
        }
        this._dataSource.onTableViewTouchMoved(event)
    }

    onTableViewTouchEnded(event: EventTouch) {
        if (this._preventSwallow) {
            event.preventSwallow = true;
        }
        this._dataSource.onTableViewTouchEnded(event)
    }

    onTableViewTouchCancel(event: EventTouch) {
        if (this._preventSwallow) {
            event.preventSwallow = true;
        }
        this.scrollViewTouchup()
        this._dataSource.onTableViewTouchCancel(event)
    }

    onLoad() {

    }

    onEnable() {
        this.node.on(ScrollView.EventType.SCROLLING, this.scrollViewDidScroll, this);
        this.node.on(ScrollView.EventType.SCROLL_ENDED, this.scrollViewStopScroll, this);
        this.node.on(ScrollView.EventType.TOUCH_UP, this.scrollViewTouchup, this);
        this.node.on(ScrollView.EventType.SCROLL_TO_TOP, this.scorllTopCallback, this);
        this.node.on(ScrollView.EventType.SCROLL_TO_BOTTOM, this.scorllBottomCallback, this);
        this.node.on(ScrollView.EventType.SCROLL_TO_LEFT, this.scorllLeftCallback, this);
        this.node.on(ScrollView.EventType.SCROLL_TO_RIGHT, this.scorllRightCallback, this);
    }

    onDisable() {
        this.node.off(ScrollView.EventType.SCROLLING, this.scrollViewDidScroll, this);
        this.node.off(ScrollView.EventType.SCROLL_ENDED, this.scrollViewStopScroll, this);
        this.node.off(ScrollView.EventType.TOUCH_UP, this.scrollViewTouchup, this);
        this.node.off(ScrollView.EventType.SCROLL_TO_TOP, this.scorllTopCallback, this);
        this.node.off(ScrollView.EventType.SCROLL_TO_BOTTOM, this.scorllBottomCallback, this);
        this.node.off(ScrollView.EventType.SCROLL_TO_LEFT, this.scorllLeftCallback, this);
        this.node.off(ScrollView.EventType.SCROLL_TO_RIGHT, this.scorllRightCallback, this);
    }

    onDestroy() {
        this._dataSource = null;
        this._indices = null
    }

    //---------- CCTableView public interface ----------

    public getDataSource(): TableViewDataSource {
        return this._dataSource;
    }

    public setDataSource(dataSource: TableViewDataSource) {
        this._dataSource = dataSource;
        this._dataSource.tableView = this;
    }

    private updateDirection() {
        if (!this.scrollView) {
            return
        }
        var direction = this._direction;
        if (direction == ScrollViewDirection.HORIZONTAL) {
            this.scrollView.horizontal = true;
            this.scrollView.vertical = false;
        } else if (direction == ScrollViewDirection.VERTICAL) {
            this.scrollView.horizontal = false;
            this.scrollView.vertical = true;
        }
    }

    public setDirection(direction: ScrollViewDirection) {
        this.direction = direction;
    }

    public getDirection(): ScrollViewDirection {
        return this.direction;
    }

    setBounceable(bounceable) {
        this.scrollView.elastic = bounceable;
    }

    getViewSize(): Size {
        const view = (this.scrollView as any).view as Node;
        return view?.getContentSize?.() ?? this._viewSize;
    }

    getContainer() {
        return this.scrollView.content;
    }

    //设置垂直填充顺序
    public setVerticalFillOrder(fillOrder: VerticalFillOrder) {
        if (this.vordering != fillOrder) {
            this.vordering = fillOrder;
            if (this._cellsUsed.length > 0) {
                this.reloadData();
            }
        }
    }

    //查找索引处的单元格
    public _cellAtIndex(idx: number) {
        if (this._indices.has(idx)) {
            return this._cellsUsed.find(v => v.getIdx() === idx)
        }
        return null;
    }

    //更新索引处的单元格
    public updateCellAtIndex(idx: number) {
        if (idx <= CC_INVALID_INDEX)
            return;
        let countOfItems = this._dataSource.numberOfCellsInTableView();
        if (0 === countOfItems || idx > countOfItems - 1)
            return;

        let cell = this._cellAtIndex(idx);
        if (!cell) {
            cell = this._createCellAtIndex(idx);
            this._setIndexForCell(idx, cell);
            this._addCellIfNecessary(cell);
        } else {
            this._setIndexForCell(idx, cell)
        }
        this._dataSource.refreshCell(idx, cell);
    }

    public insertCellAtIndex(idx: number) {
        //TODO CCTableView.cpp
    }

    public removeCellAtIndex(idx: number) {
        //TODO CCTableView.cpp
    }

    private _forceRefresh = false
    private _closeRefresh = false

    //加载数据
    public reloadData() {
        this.stopScrolling();
        this._oldDirection = null
        for (let k in this._cellsUsed) {
            let cell = this._cellsUsed[k];
            this._cellsFreed.push(cell);
            cell.reset();
            cell.active = false;
        }
        this._indices.clear();
        this._cellsUsed = [];
        this._updateCellPositions();
        this._updateContentSize();
        this._updateCellShowStatus();
    }

    public stopScrolling() {
        this.scrollView.stopAutoScroll();
    }

    /**
     * @zh 更新当前cell的显示状态
     */
    private _startIndex: number
    private _endIndex: number
    private _updateCellShowStatus() {
        /** 防止reloadTableViewData时，多次刷新 */
        if (this._closeRefresh) return
        let countOfItems = this._dataSource.numberOfCellsInTableView();
        if (0 === countOfItems) {
            return;
        }

        if (this._isUsedCellsDirty) {
            this._isUsedCellsDirty = false;
            this._cellsUsed.sort((a: TableViewCellNode, b: TableViewCellNode) => a.getIdx() - b.getIdx())
        }

        //计算在显示范围的单元格的起始 startIdx 和结束 endIdx
        let startIdx = 0;
        let endIdx = 0;
        let idx = 0;
        let maxIdx = Math.max(countOfItems - 1, 0);
        let offset: Vec2 = this.getContentOffset();
        offset.x = -offset.x;
        if (this.direction == ScrollViewDirection.VERTICAL && this.vordering == VerticalFillOrder.BOTTOM_UP) {
            offset.y = this.getContainer().getContentSize().height - offset.y - this._viewSize.height;
        }
        startIdx = this._indexFromOffset(offset);
        if (startIdx == CC_INVALID_INDEX) {
            startIdx = countOfItems - 1;
        }

        offset.y += this._viewSize.height;
        offset.x += this._viewSize.width;
        endIdx = this._indexFromOffset(offset);
        if (endIdx == CC_INVALID_INDEX) {
            endIdx = countOfItems - 1;
        }
        for (let i = this._cellsUsed.length - 1; i >= 0; --i) {
            let cell = this._cellsUsed[i];
            idx = cell.getIdx();
            if (idx < startIdx || idx > endIdx) {
                this._moveCellOutOfSight(cell, i);
            }
        }
        //更新未在区域显示的cell
        for (let i = startIdx; i <= endIdx; ++i) {
            if (this._forceRefresh || !this._indices.has(i)) {
                this.updateCellAtIndex(i);
            }
        }
        this._startIndex = startIdx
        this._endIndex = endIdx
    }

    public scrollViewDidScroll() {
        this._updateCellShowStatus();
        this.scrollViewUpdateCellOpacity()
        this._dataSource?.scrollViewDidScroll(this);
    }

    public scrollViewStopScroll() {
        if (this.isPageView && this._pageChanged) {
            // 判断当前页
            let offset = this.scrollView.getScrollOffset();
            let curOffset = this._curPageOffset
            var offsetNum = 0
            if (this._direction == ScrollViewDirection.HORIZONTAL) {
                offsetNum = -offset.x - curOffset.x
            } else {
                offsetNum = offset.y - curOffset.y
            }
            if (Math.abs(offsetNum) < 1) {
                this.onPageIndexChanged()
            }
        }
        this.scrollViewUpdateCellOpacity()
        this._dataSource?.scrollViewStopScroll?.(this);
    }

    public scrollViewUpdateCellOpacity() {
        if (!this._isFade) { return }
        let position = this.scrollView.content.position
        let parentSize = this._viewNode.parent.getContentSize()
        for (let index = 0; index < this._cellsUsed.length; index++) {
            const cell = this._cellsUsed[index];
            const cellOpacity = cell.getComponent(UIOpacity)
            const cellTransform = cell.getComponent(UITransform)
            if (this.direction == ScrollViewDirection.VERTICAL) {
                let displayPosY = cell.position.y + position.y
                if (Math.abs(displayPosY) > parentSize.height) {
                    let y = Math.abs(displayPosY) - parentSize.height
                    let op = Math.min(Math.max(y / cellTransform.height, 0), 1)
                    cellOpacity.opacity = Math.round(255 * (1 - op))
                } else {
                    let y = displayPosY + cellTransform.height
                    let op = Math.min(Math.max(y / cellTransform.height, 0), 1)
                    cellOpacity.opacity = Math.round(255 * (1 - op))
                }
            }
        }
    }

    public scrollViewTouchup() {
        if (this.isPageView) {
            // 判断当前页
            let offset = this.scrollView.getScrollOffset();
            let curOffset = this._curPageOffset
            if (this._direction == ScrollViewDirection.HORIZONTAL) {
                if (-offset.x - curOffset.x > 10) {
                    this.setPageIndex(this._curPageIndex + 1)
                } else if (-offset.x - curOffset.x < -10) {
                    this.setPageIndex(this._curPageIndex - 1)
                } else if (offset.x - curOffset.x != 0) {
                    this.setPageIndex(this._curPageIndex)
                }
            } else {
                if (this.vordering == VerticalFillOrder.TOP_DOWN) {
                    if (offset.y - curOffset.y < -10) {
                        this.setPageIndex(this._curPageIndex - 1)
                    } else if (offset.y - curOffset.y > 10) {
                        this.setPageIndex(this._curPageIndex + 1)
                    } else if (offset.y - curOffset.y != 0) {
                        this.setPageIndex(this._curPageIndex)
                    }
                } else {
                    if (offset.y - curOffset.y < -10) {
                        this.setPageIndex(this._curPageIndex + 1)
                    } else if (offset.y - curOffset.y > 10) {
                        this.setPageIndex(this._curPageIndex - 1)
                    } else if (offset.y - curOffset.y != 0) {
                        this.setPageIndex(this._curPageIndex)
                    }
                }
            }
        }
    }

    public scorllTopCallback() {
        this._dataSource?.scorllTopCallback(this);
    }

    public scorllBottomCallback() {
        this._dataSource?.scorllBottomCallback(this);
    }

    public scorllLeftCallback() {
        this._dataSource?.scorllLeftCallback(this);
    }

    public scorllRightCallback() {
        this._dataSource?.scorllRightCallback(this);
    }

    /**
     * @zh 获取滚动视图的内容偏移量，以视图左下角为原点，与Cocos坐标系匹配
     */
    public getContentOffset(): Vec2 {
        return this.getContainer().getPositionCC();
    }

    /**
     * @zh 设置滚动视图的内容偏移量，以视图左下角为原点，与Cocos坐标系匹配
     */
    public setContentOffset(offset: Vec2, animated: boolean = false, callback?: any) {
        // }
        var animateTime = animated ? this._animationTime : 0
        this.scrollView.scrollToOffset(offset, animateTime);
        this._updateCellShowStatus();
        if (callback) {
            if (animated) {
                this.scheduleOnce(callback, animateTime)
            } else {
                callback()
            }
        }
    }

    maxContainerOffset(): Vec2 {
        return this.scrollView.getMaxScrollOffset()
    }

    minContainerOffset(): Vec2 {
        return new Vec2(0, 0);
    }


    /** 下面是私有函数 */

    //更新单元格位置
    private _updateCellPositions() {
        let cellsCount = this._dataSource.numberOfCellsInTableView();
        this._cellsPositions = [];
        this._cellsPositions.length = cellsCount + 1;

        if (cellsCount > 0) {
            let currentPos = this.starInterval;
            let cellSize: Size
            for (let i = 0; i < cellsCount; ++i) {
                this._cellsPositions[i] = currentPos;
                cellSize = this._dataSource.tableCellSizeForIndex(i);
                switch (this.getDirection()) {
                    case ScrollViewDirection.HORIZONTAL:
                        currentPos += cellSize.width + this.midInterval;
                        break;
                    default:
                        currentPos += cellSize.height + this.midInterval;
                        break;
                }
            }
            this._cellsPositions[cellsCount] = currentPos - this.midInterval;
        }
    }

    //更新内部容器大小
    private _updateContentSize() {
        let size = Size.ZERO
        let cellCount = this._dataSource.numberOfCellsInTableView();
        if (cellCount > 0) {
            let maxPosition = this._cellsPositions[cellCount] + this.endInterval;
            //当单元格数量不足以填满视图时，使用视图大小（这里-1 是为了隐藏scorllbar）
            if (this.getDirection() == ScrollViewDirection.HORIZONTAL) {
                size = new Size(Math.max(maxPosition, this._viewSize.width - 1), this._viewSize.height);
            } else {
                size = new Size(this._viewSize.width, Math.max(maxPosition, this._viewSize.height - 1));
            }
        }

        this.getContainer().setContentSize(size);

        let _direction = this.getDirection()
        if (this._oldDirection != _direction) {
            this._oldDirection = _direction;
            if (this.direction == ScrollViewDirection.VERTICAL && this.vordering == VerticalFillOrder.BOTTOM_UP) {
                this.setContentOffset(this.maxContainerOffset());
            } else {
                this.setContentOffset(this.minContainerOffset());
            }
            this._scrollView["_updateScrollBarState"]()
        }
    }

    _posFromIndex(index: number): Vec2 {
        let offset;
        let cellSize: Size = this._dataSource.tableCellSizeForIndex(index);
        switch (this.getDirection()) {
            case ScrollViewDirection.HORIZONTAL:
                offset = new Vec3(this._cellsPositions[index], -cellSize.height / 2 - this._viewSize.height / 2);
                break;
            default:
                var posX = (this._viewSize.width - cellSize.width) / 2;
                if (this.vordering === VerticalFillOrder.BOTTOM_UP) {
                    let contentSize = this.getContainer().getContentSize();
                    offset = new Vec3(posX, -contentSize.height + this._cellsPositions[index]);
                } else {
                    offset = new Vec3(posX, -this._cellsPositions[index] - cellSize.height);
                }
                break;
        }
        return offset;
    }

    //偏移量转索引
    private _indexFromOffset(offset: Vec2): number {
        let index = 0
        let maxIdx = this._dataSource.numberOfCellsInTableView() - 1;
        // if (this.vordering === VerticalFillOrder.TOP_DOWN) {
        //     offset.y = this.getContainer().getContentSize().height - offset.y;
        // }
        index = this.__indexFromOffset(offset);
        if (index != -1) {
            index = Math.max(0, index);
            if (index > maxIdx) {
                index = CC_INVALID_INDEX;
            }
        }
        return index;
    }

    //偏移量转索引的二分查找法
    private __indexFromOffset(offset: Vec2): number {
        let low = 0;
        let high = this._dataSource.numberOfCellsInTableView() - 1;
        let search;
        switch (this.getDirection()) {
            case ScrollViewDirection.HORIZONTAL:
                search = offset.x;
                break;
            default:
                search = offset.y;
                break;
        }

        while (high >= low) {
            let index = Math.ceil(low + (high - low) / 2);
            let cellStart = this._cellsPositions[index];
            let cellEnd = this._cellsPositions[index + 1];

            if (search >= cellStart && search <= cellEnd) {
                return index;
            } else if (search < cellStart) {
                high = index - 1;
            } else {
                low = index + 1;
            }
        }

        if (low <= 0) {
            return 0
        }
        if (low > high) {
            return high
        }
        return -1
    }

    //把单元格移除视线
    private _moveCellOutOfSight(cell: TableViewCellNode, index: number) {
        this._cellsUsed.splice(index, 1);
        this._isUsedCellsDirty = true;
        this._indices.delete(cell.getIdx());
        cell.reset();
        cell.active = false;
        this._cellsFreed.push(cell);
    }

    //设置单元格索引
    private _setIndexForCell(index: number, cell: TableViewCellNode) {
        const f = this._dataSource.data.isInvertedZOrder
        cell.setAnchorPoint(0, 0);
        cell.setPositionCC(this._posFromIndex(index));
        cell.setLocalZOrder(index * (!f ? 1 : -1))
        cell.setIdx(index);
    }

    //必要时添加单元格
    private _addCellIfNecessary(cell: TableViewCellNode) {
        const f = this._dataSource.data.isInvertedZOrder
        if (cell.parent != this.getContainer()) {
            this.getContainer().addChildCC(cell, cell.getIdx() * (!f ? 1 : -1))
        }
        this._cellsUsed.push(cell);
        this._indices.add(cell.getIdx());
        cell.active = true;
        this._isUsedCellsDirty = true;
    }

    //空闲的单元格离队
    public dequeueCell(): TableViewCellNode | null {
        let cell: TableViewCellNode | null = null;
        if (this._cellsFreed.length > 0) {
            cell = this._cellsFreed.shift();
            cell.active = true;
        }
        return cell
    }

    //创建索引处的单元格
    private _createCellAtIndex(idx): TableViewCellNode {
        let cell: TableViewCellNode = this.dequeueCell();
        if (!cell) {
            cell = new TableViewCellNode("cell", this);
            cell.addComponent(UITransform)
            cell.addComponent(UIOpacity)
        }
        this._dataSource.initCellAtIndex(idx, cell);
        return cell;
    }

    //-----------------Kos TableViewUtil接口适配-----------------
    static create(node: Node, tableViewSize?: Size, dataSource?: TableViewDataSource): TableView {
        let table = node.getComponent(TableView)
        if (!table) {
            table = node.addComponent(TableView)
        }
        let data = dataSource.data
        if (data.isPageView != null) {
            table.isPageView = data.isPageView
        }
        if (data.preventSwallow != null) {
            table.preventSwallow = data.preventSwallow
        }
        table.initWithSize(tableViewSize)
        table.setDirection(data.direction || table.direction);
        table.setVerticalFillOrder(data.fillOrder || VerticalFillOrder.TOP_DOWN);
        table.setTableInterval(data.starInterval, data.midInterval, data.endInterval)
        table.setIsFade(data.isFade == true)

        if (table.isPageView) {
            table.scrollView.elastic = false
            table.scrollView.inertia = false
        } else {
            table.setBounceable(data.bounceable);
        }
        if (data.isTouchEnabled === false) {
            table.scrollView.enabled = false;
        } else {
            table.scrollView.enabled = true;
        }
        table.setDataSource(dataSource);
        table.reloadData();
        return table;
    }


    public getContentChildCount(): number {
        if (!this._cellsUsed) {
            return 0;
        }
        let num = 0
        for (let cell of this._cellsUsed) {
            if (cell.active) {
                num++
            }
        }
        return num
    }

    reloadTableViewData(ignoreOffset: boolean = false) {
        this.stopScrolling();
        if (ignoreOffset == true) {
            this.reloadData();
        } else {
            let offset = this.scrollView.getScrollOffset();
            if (this._direction == ScrollViewDirection.HORIZONTAL) {
                offset.x = offset.x * -1
            }
            this._closeRefresh = true
            this.reloadData();
            this._forceRefresh = true
            this._closeRefresh = false
            this.setContentOffset(offset);
            this._forceRefresh = false
        }
    }

    reloadTableViewSize(index: number) {
        let cell = this._cellAtIndex(index);
        let cellSize = this._dataSource.tableCellSizeForIndex(index)
        cell.setContentSize(cellSize)
        cell.setPositionY(cellSize.height / 2)
        cell.parent.setContentSize(cellSize)

        let offset = this.scrollView.getScrollOffset();
        if (this._direction == ScrollViewDirection.HORIZONTAL) {
            offset.x = offset.x * -1
        }
        this._forceRefresh = true
        this.stopScrolling();
        this._updateCellPositions();
        this._updateContentSize();
        this.scrollView.scrollToOffset(offset);
        this._updateCellShowStatus();
        this._forceRefresh = false
    }

    getCurTouchCell() {
        return this._dataSource.getCurTouchCell()
    }

    getIndexCell(idx): Node {
        return this._dataSource.getCellRectByIndex(idx)
    }

    getShowIndexCells() {
        return this._dataSource.getShowIndexCells()
    }

    public isCovered(panel: Node, worldPos: Vec2) {
        const transform = panel.getComponent(UITransform);
        if (!transform) {
            return false;
        }
        const area = transform.getBoundingBoxToWorld();
        return area.contains(new Vec2(worldPos.x, worldPos.y));
    }

    getCellByWorldPos(wpos): Node {
        return this._dataSource.getCellByWorldPos(wpos);
    }


    getOffsetByCondition(condition: TableViewOffSetType, selectIndex: number) {
        return this._getOffSetByIndex(selectIndex, condition)
    }

    appearSelectCell(selectIndex, hasAnimation) {
        if (selectIndex == null) {
            return;
        }
        // 判断当前cell是否在视图中

        hasAnimation = hasAnimation || true;
        let delta = this.getOffsetByCondition(TableViewOffSetType.appear, selectIndex)
        this.setContentOffset(delta, hasAnimation)
    }

    topSelectCell(selectIndex, hasAnimation?) {
        if (selectIndex == null) {
            return;
        }
        hasAnimation = hasAnimation || true;
        let delta = this.getOffsetByCondition(TableViewOffSetType.top, selectIndex)
        this.setContentOffset(delta, hasAnimation)
    }

    checkCellInView(selectIndex) {
        var cell = this._cellAtIndex(selectIndex);
        if (!cell) {
            return false
        }
        const rect = cell.getComponent(UITransform)!.getBoundingBoxToWorld();
        const rectTableView = this.node.getComponent(UITransform)!.getBoundingBoxToWorld();
        return !(
            rect.xMax < rectTableView.xMin ||
            rect.xMin > rectTableView.xMax ||
            rect.yMax < rectTableView.yMin ||
            rect.yMin > rectTableView.yMax
        );
    }

    _getOffSetByIndex(index, offSetType: TableViewOffSetType = TableViewOffSetType.none) {
        let cellIndex = this._dataSource.getCellIndex(index)
        if (cellIndex < 0 || cellIndex >= this._cellsPositions.length - 1) {
            return new Vec2()
        }
        let offset = new Vec2()
        let offsetPos = this._cellsPositions[cellIndex]
        let cellSize: Size = this._dataSource.tableCellSizeForIndex(index);
        switch (this.getDirection()) {
            case ScrollViewDirection.HORIZONTAL:
                offset.x = offsetPos + this._pageOffset
                if (offSetType == TableViewOffSetType.center) {
                    offset.x = offset.x - (this._viewSize.width - cellSize.width) / 2
                } else if (offSetType == TableViewOffSetType.appear) {
                    if (this.checkCellInView(index)) {
                        offset = this.scrollView.getScrollOffset();
                        offset.x = offset.x * -1
                    } else {
                        if (index >= this._endIndex) {
                            offset.x = offset.x - this._viewSize.width + cellSize.width
                        }
                    }
                }
                offset.y = 0
                break;
            default:
                if (this.vordering === VerticalFillOrder.BOTTOM_UP) {
                    let contentSize = this.getContainer().getContentSize();
                    offset.y = contentSize.height - this._viewSize.height - offsetPos + this._pageOffset
                    if (offSetType == TableViewOffSetType.center) {
                        offset.y = offset.y + (this._viewSize.height - cellSize.height) / 2
                    } else if (offSetType == TableViewOffSetType.appear) {
                        if (this.checkCellInView(index)) {
                            offset = this.scrollView.getScrollOffset();
                        } else {
                            if (index >= this._endIndex) {
                                offset.y = offset.y + this._viewSize.height - cellSize.height + this.endInterval
                            }
                        }
                    }
                } else {
                    offset.y = offsetPos + this._pageOffset;
                    if (offSetType == TableViewOffSetType.center) {
                        offset.y = offset.y - (this._viewSize.height - cellSize.height) / 2
                    } else if (offSetType == TableViewOffSetType.appear) {
                        if (this.checkCellInView(index)) {
                            offset = this.scrollView.getScrollOffset();
                        } else {
                            if (index >= this._endIndex) {
                                offset.y = offset.y - this._viewSize.height + cellSize.height + this.endInterval
                            }
                        }
                    }
                }
                offset.x = 0
                break;
        }
        this._fixOffset(offset)
        return offset
    }

    /**
     * 修复偏移值  避免超出范围
     * @param offset 
     */
    _fixOffset(offset: Vec2) {
        let contentSize = this.getContainer().getContentSize();
        let contW = contentSize.width;
        let contH = contentSize.height;
        const minOffset: Vec2 = this.minContainerOffset();
        const maxOffset: Vec2 = this.maxContainerOffset();
        if (this._viewSize.width > contW) {
            offset.x = Math.max(maxOffset.x, Math.min(offset.x, minOffset.x));
        } else {
            offset.x = Math.max(minOffset.x, Math.min(maxOffset.x, offset.x));
        }
        if (this._viewSize.height > contH) {
            offset.y = Math.max(maxOffset.y, Math.min(minOffset.y, offset.y));
        } else {
            offset.y = Math.max(minOffset.y, Math.min(maxOffset.y, offset.y));
        }
    }

    /**
     * 滚动到指定索引处的单元格
     */
    scrollToIndex(index: number, animated: boolean = false, offSetType: TableViewOffSetType = TableViewOffSetType.none, callback?: any, customOffsetX = 0, customOffsetY = 0) {
        var cellIndex = this._dataSource.getCellIndex(index)
        if (cellIndex < 0 || cellIndex >= this._cellsPositions.length - 1) {
            return
        }
        let offset = this._getOffSetByIndex(index, offSetType)
        this._curPageOffset = offset
        offset = offset.add(new Vec2(customOffsetX, customOffsetY));
        this.setContentOffset(offset, animated, callback)
    }

    scrollToTop(timeInSecond?: number, attenuated?: boolean) {
        this._scrollView.scrollToTop(timeInSecond, attenuated)
        this._updateCellShowStatus();
    }

    scrollToBottom(timeInSecond?: number, attenuated?: boolean) {
        this._scrollView.scrollToBottom(timeInSecond, attenuated)
        this._updateCellShowStatus();
    }

    scrollToRight(timeInSecond?: number, attenuated?: boolean) {
        this._scrollView.scrollToRight(timeInSecond, attenuated)
        this._updateCellShowStatus();
    }

    scrollToLeft(timeInSecond?: number, attenuated?: boolean) {
        this._scrollView.scrollToLeft(timeInSecond, attenuated)
        this._updateCellShowStatus();
    }
}
