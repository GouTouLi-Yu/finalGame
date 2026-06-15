import { Node, Size, UITransform, Vec2, Widget } from "cc";
import "./NodeExt";
import { EScrollViewDirection, TableViewData } from "./TableView";
import { TableViewCellNode, TableViewDataSource } from "./TableViewDataSource";

export class GroupTableViewDataSource extends TableViewDataSource {
    private _columnNum: number | null; //单行列数，如果设置了会按列打组进行自动排列
    private _columnEdgeInterval: number = 0; //列间隔
    private _fixedCellSize: Size | null; //固定单元格大小, _columeNum > 1 时有效, 暂时没用
    private _fixedCellGroupSize: Size | null; //固定单元格组大小, _columeNum > 1 时有效, 暂时没用

    constructor(data: TableViewData) {
        super(data)
        this._columnNum = data.columnNum
        this._columnEdgeInterval = data.columnEdgeInterval || 0
    }

    public tableCellSizeForIndex(idx: number): Size {
        return this._getCellGroupSize()
    }

    private _setIndexForCell(index: number, cell: TableViewCellNode) {
        cell.setAnchorPoint(0, 0);
        cell.setPositionCC(this._posFromIndex(index));
        cell.setIdx(index);
    }

    private _posFromIndex(index: number): Vec2 {
        let cellSize = this._getCellSizeFunc(0);
        if (this._tableView.direction == EScrollViewDirection.VERTICAL) {
            return new Vec2(this._columnEdgeInterval + cellSize.width * index, 0);
        } else {
            return new Vec2(0, this._columnEdgeInterval + cellSize.height * (this._columnNum - index - 1));
        }
    }

    public initCellAtIndex(idx: number, cell: TableViewCellNode) {
        let cellSize = this._getCellGroupSize();
        cell.setContentSize(cellSize);
        let preIndex = idx * this._columnNum;
        //cell分组的第一个cell作为模板 所有模版一致
        let templateCell = this._getCellFunc(0);
        for (let i = 0; i < this._columnNum; i++) {
            let index = preIndex + i;
            let sonCell: TableViewCellNode = cell.getChildByTag(i) as TableViewCellNode;
            if (!sonCell) {
                sonCell = new TableViewCellNode("sonCell", this._tableView);
                sonCell.addComponent(UITransform)
                let cellSize = this._getCellSizeFunc(index);
                sonCell.setContentSize(cellSize);
                cell.addChildCC(sonCell);
                this._setIndexForCell(i, sonCell)

                sonCell.setTag(i)
                sonCell.setIdx(index)

                let cellRect = templateCell.clone();
                cellRect.setVisible(true);
                cellRect.setTag(i);
                cellRect.setName(templateCell.name);
                sonCell.addChildCC(cellRect);
                sonCell.setCellRect(cellRect);

                let widget = cellRect.getComponent(Widget);
                if (!widget) {
                    widget = cellRect.addComponent(Widget);
                }
                widget.isAlignVerticalCenter = true
                widget.isAlignHorizontalCenter = true
                widget.verticalCenter = 0
                widget.horizontalCenter = 0
            }
        }
    }

    refreshCell(idx: number, cell: TableViewCellNode) {
        let preIndex = idx * this._columnNum;
        var cellCount = this._getCellCountFunc()
        for (let i = 0; i < this._columnNum; i++) {
            let index = preIndex + i;
            let sonCell: TableViewCellNode = cell.getChildByTag(i) as TableViewCellNode;
            sonCell.setName("sonCell" + index)
            sonCell["__cellIndex"] = index;
            var cellRect = sonCell.getCellRect();
            cellRect["__cellIndex"] = index;
            if (index >= cellCount) {
                cellRect.setVisible(false);
            } else {
                cellRect.setVisible(true);
                if (this._data.refreshCellFunc) {
                    this._data.refreshCellFunc(cellRect, index);
                }
            }
        }
    }

    getCurTouchCell(): Node {
        return this._curTouchCell
    }

    getCellIndex(index: number) {
        return Math.floor(index / this._columnNum)
    }

    getCellRectByIndex(index) {
        var groupIdx = this.getCellIndex(index);
        var cell = this._tableView._cellAtIndex(groupIdx);
        if (cell) {
            return cell.getChildByTag(index % this._columnNum).getCellRect();
        }
        return null
    }

    getShowIndexCells() {
        var list = {}
        for (let k in this._tableView.getCellsUsed()) {
            var idx = this._tableView.getCellsUsed()[k].getIdx()
            var cellGroup = this._tableView.getCellsUsed()[k]
            for (let i = 0; i < cellGroup.children.length; i++) {
                let itemCell = cellGroup.children[i].getCellRect()
                list[itemCell["__cellIndex"]] = itemCell
            }
        }
        return list
    }

    setColumnNum(columnNum?) {
        this._fixedCellSize = null
        this._fixedCellGroupSize = null
        this._columnNum = columnNum
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
            if (cell.active) {
                for (let col = 0; col < cell.children.length; col++) {
                    let sonCell = cell.getChildByTag(col)
                    if (this._tableView.isCovered(sonCell, wpos)) {
                        var cellRect = sonCell.getCellRect();
                        if (cellRect.active == false) {
                            return null
                        }
                        return sonCell
                    }
                }
            }
        }
    }

    numberOfCellsInTableView() {
        return this._getCellGroupCountFunc()
    }

    _getCellGroupCountFunc() {
        return Math.ceil(this._getCellCountFunc() / this._columnNum);
    }

    _getCellCountFunc() {
        let cellCount = this._data.getCellCountFunc && this._data.getCellCountFunc();
        cellCount = cellCount || 0;
        return cellCount;
    };

    // _getCellGroupSize() {
    //     if (!this._fixedCellGroupSize) {
    //         var table = this._tableView;
    //         let totalWidth = table.getViewSize().width;
    //         let height = this._getCellSizeFunc().height;
    //         this._fixedCellGroupSize = new Size(totalWidth, height);
    //     }
    //     return this._fixedCellGroupSize;
    // }

    // // 获取cell的size
    // _getCellSizeFunc(index?: number): Size {
    //     if (this._fixedCellSize == null) {
    //         let cellSize = this._data.getCellSizeFunc && this._data.getCellSizeFunc(index);
    //         if (cellSize) {
    //             this._fixedCellSize = cellSize;
    //         } else {
    //             let tableViewSize = this._tableView.getViewSize()
    //             let cellSize = this._getCellFunc().getContentSize();
    //             this._fixedCellSize = new Size(
    //                 Math.floor((tableViewSize.width - this._columnEdgeInterval * 2) / this._columnNum),
    //                 cellSize.height
    //             );
    //         }
    //     }
    //     return this._fixedCellSize;
    // };

    _getCellGroupSize() {
        if (!this._fixedCellGroupSize) {
            var table = this._tableView;
            if (this._data.direction == EScrollViewDirection.HORIZONTAL) {
                let totalHeight = table.getViewSize().height;
                let width = this._getCellSizeFunc(0).width;
                this._fixedCellGroupSize = new Size(width, totalHeight);
            }
            else {
                let totalWidth = table.getViewSize().width;
                let height = this._getCellSizeFunc(0).height;
                this._fixedCellGroupSize = new Size(totalWidth, height);
            }
        }
        return this._fixedCellGroupSize;
    }

    // 获取cell的size
    _getCellSizeFunc(index?: number): Size {
        if (this._fixedCellSize == null) {
            let cellSize = this._data.getCellSizeFunc?.(index);
            if (cellSize) {
                this._fixedCellSize = cellSize;
            } else {
                let tableViewSize = this._tableView.getViewSize()
                let cellSize = this._getCellFunc(index).getContentSize();
                if (this.data.direction == EScrollViewDirection.HORIZONTAL) {
                    this._fixedCellSize = new Size(
                        cellSize.width,
                        Math.floor((tableViewSize.height - this._columnEdgeInterval * 2) / this._columnNum),
                    );
                }
                else {
                    this._fixedCellSize = new Size(
                        Math.floor((tableViewSize.width - this._columnEdgeInterval * 2) / this._columnNum),
                        cellSize.height
                    );
                }

            }
        }
        return this._fixedCellSize;
    };
}