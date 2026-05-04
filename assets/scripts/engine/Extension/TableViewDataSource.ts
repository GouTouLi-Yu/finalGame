import { EventTouch, Node, Size, Vec2, Widget, _decorator } from "cc";
const { ccclass } = _decorator;

export let CC_INVALID_INDEX: number = -1;
@ccclass('TableViewCellNode')
export class TableViewCellNode extends Node {
    private _idx: number = CC_INVALID_INDEX;
    public getIdx = (): number => this._idx;
    public setIdx = (idx: number) => this._idx = idx;
    public reset = () => this._idx = CC_INVALID_INDEX;
    private _cellRect: Node;
    public getCellRect = (): Node => this._cellRect;
    public setCellRect = (cellRect: Node) => this._cellRect = cellRect;

    private _tableView: any = null;
    get tableView() { return this._tableView }

    constructor(name: string, tableView) {
        super(name)
        this._tableView = tableView
    }
}

// 移植 TableViewDataSource from CCTableView.h
export class TableViewDataSource {
    protected _tableView: any = null;
    get tableView() { return this._tableView }
    set tableView(__newVal: any) { this._tableView = __newVal }
    protected _data: any = null;
    get data() { return this._data }
    set data(__newVal: any) { this._data = __newVal }

    protected _curTouchCell: Node;

    constructor(data: any) {
        this._data = data
    }

    onTableViewTouchBegan(event: EventTouch) {
        if (!this._data.selectCellFunc) {
            return
        }
        let touch = event.touch
        this._curTouchCell = null
        let cell = this.getCellByWorldPos(touch.getUILocation())
        if (cell) {
            this._curTouchCell = cell.getCellRect()
        }
    }

    onTableViewTouchMoved(event: EventTouch) {
        if (!this._curTouchCell) {
            return
        }
        let touch = event.touch
        let cell = this.getCellByWorldPos(touch.getUILocation())
        if (cell && cell.getCellRect() != this._curTouchCell) {
            this._curTouchCell = null
        }
    }

    onTableViewTouchEnded(event: EventTouch) {
        if (!this._curTouchCell) {
            return
        }
        let deltaX = event.getUILocation().y - event.getUIStartLocation().y
        let deltaY = event.getUILocation().x - event.getUIStartLocation().x
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            this._curTouchCell = null
            return
        }
        if (event.target == this._tableView.node) {
            this._data.selectCellFunc?.(this._curTouchCell["__cellIndex"]);
        }
    }

    onTableViewTouchCancel(event: EventTouch) {
        this._curTouchCell = null
    }

    public tableCellSizeForIndex(idx: number): Size {
        if (this._data.getCellSizeFunc) {
            return this._data.getCellSizeFunc(idx)
        }
        return this._getCellFunc(idx).getContentSize();
    }

    _getCellFunc(index: number): Node {
        let cell = this._data.getCellFunc(index);
        cell.setVisible(false);
        return cell;
    };

    //创建cell时对cell的处理
    public initCellAtIndex(idx: number, cell: TableViewCellNode) {
        let cellSize = this.tableCellSizeForIndex(idx);
        cell.setContentSize(cellSize);
        let templateCell = this._getCellFunc(idx);
        var cellRect = cell.getCellRect()
        if (!cellRect || cellRect.name != templateCell.name) {
            cell.destroyAllChildren();
            cellRect = templateCell.clone();
            cellRect.setVisible(true);
            cellRect.setName(templateCell.name)
            cellRect.setContentSize(cellSize)
            const f = this._data.isInvertedZOrder
            cell.addChildCC(cellRect, idx * (!f ? 1 : -1));
            cell.setCellRect(cellRect);
            let widget = cellRect.getComponent(Widget);
            if (!widget) {
                widget = cellRect.addComponent(Widget);
            }
            widget.isAlignVerticalCenter = true
            widget.isAlignHorizontalCenter = true
            widget.verticalCenter = 0
            widget.horizontalCenter = 0
            widget.alignMode = 1
        }
    }

    refreshCell(idx: number, cell: TableViewCellNode) {
        var cellRect = cell.getCellRect();
        cell["__cellIndex"] = idx;
        cellRect["__cellIndex"] = idx;
        this._data.refreshCellFunc?.(cellRect, idx);
    }

    public numberOfCellsInTableView(): number {
        return this._data?.getCellCountFunc?.() ?? 0;
    }

    public scrollViewDidScroll(view) {
        this._data?.scrollViewDidScroll?.()
    }

    public scrollViewStopScroll(view) {
        this._data?.scrollViewStopScroll?.()
    }

    public scorllTopCallback(view) {
        this._data?.scorllTopCallback?.();
    }

    public scorllBottomCallback(view) {
        this._data?.scorllBottomCallback?.();
    }

    public scorllLeftCallback(view) {
        this._data?.scorllLeftCallback?.();
    }

    public scorllRightCallback(view) {
        this._data?.scorllRightCallback?.();
    }

    getCurTouchCell() {
        return this._curTouchCell
    }

    getCellRectByIndex(idx) {
        return this._tableView._cellAtIndex(idx)?.getCellRect()
    }

    getShowIndexCells() {
        var list = {}
        var cellsUsed = this._tableView.getCellsUsed()
        for (let k in cellsUsed) {
            var idx = cellsUsed[k].getIdx()
            list[idx] = cellsUsed[k].getCellRect()
        }
        return list
    }

    getCellByWorldPos(wpos): Node {
        if (this._tableView.node.active == false) {
            return null
        }
        if (!this._tableView.isCovered(this._tableView.getContainer(), wpos)) {
            return null;
        }
        let allCells = this._tableView.getContainer().children
        for (let row = 0; row < allCells.length; row++) {
            let cell = allCells[row]
            if (cell.active && this._tableView.isCovered(cell, wpos)) {
                return cell
            }
        }
    }

    onPageIndexChanged(index) {
        this.data?.onPageIndexChanged?.(index)
    }

    checkOffset(offset: Vec2) {
        offset.x = Math.min(offset.x, 0)
        let deltaW = this._tableView.getViewSize().width - this._tableView.getContainer().getContentSize().width
        if (deltaW < 0) {
            offset.x = Math.max(offset.x, deltaW)
        }

        offset.y = Math.min(offset.y, 0)
        let deltaH = this._tableView.getViewSize().height - this._tableView.getContainer().getContentSize().height
        if (deltaH < 0) {
            offset.y = Math.max(offset.y, deltaH)
        } else {
            offset.y = deltaH
        }
        return offset
    }

    getCellIndex(index: number) {
        return index
    }
}