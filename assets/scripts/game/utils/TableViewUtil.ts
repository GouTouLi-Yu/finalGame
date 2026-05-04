import { Node } from "cc";
import TableView, { TableViewData } from "../../engine/Extension/TableView";
import { GroupTableViewDataSource } from "../../engine/Extension/GroupTableViewDataSource";
import { TableViewDataSource } from "../../engine/Extension/TableViewDataSource";

/**
 * 对齐 k 项目 `kos/utils/TableViewUtils`：根据是否多列选择 DataSource 并创建 TableView。
 * 动态 slider 路径（`slider: string`）在 FinalGame 未接 UIUtils，传入时仅打日志。
 */
export class TableViewUtil {
    static createTableView(data: TableViewData): TableView {
        const tableView: Node = data.tableView;
        let dataSource: TableViewDataSource | GroupTableViewDataSource;
        if (data.columnNum) {
            dataSource = new GroupTableViewDataSource(data);
        } else {
            dataSource = new TableViewDataSource(data);
        }
        if (typeof data.slider === "string") {
            console.warn("[TableViewUtil] slider 传入路径字符串时需在工程中自行接 ScrollBar（k 侧用 UIUtils.createView）");
        }
        return TableView.create(tableView, data.viewSize, dataSource);
    }
}
