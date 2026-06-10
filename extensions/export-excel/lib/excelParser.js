/**
 * Excel解析核心模块
 */
const XLSX = require('xlsx');
const path = require('path');
const ErrorHandler = require('./errorHandler');

class ExcelParser {
    constructor() {
        this.errorHandler = new ErrorHandler();
    }

    /**
     * Sheet 是否为空（没有任何单元格内容）
     */
    isSheetEmpty(sheet) {
        if (!sheet) return true;
        const keys = Object.keys(sheet).filter(k => !k.startsWith('!'));
        if (keys.length === 0) return true;
        // 兼容某些只含样式/边框的情况：仍视为非空，交给后续校验
        return false;
    }

    /**
     * 获取单元格值
     */
    getCellValue(sheet, row, col) {
        const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
        const cell = sheet[cellAddress];
        if (!cell) return null;
        return cell.v;
    }

    parseNumber(value, fileName, sheetName, row, col, fieldName) {
        if (value === null || value === undefined || value === '') return null;
        const num = parseFloat(value);
        if (isNaN(num)) {
            this.errorHandler.addDataTypeError(fileName, sheetName, row, col, fieldName, 'number', value);
            return null;
        }
        return num;
    }

    parseNumberArray(value, fileName, sheetName, row, col, fieldName) {
        if (value === null || value === undefined || value === '') return [];
        const str = String(value).trim();
        if (!str) return [];
        const parts = str.split(',');
        const result = [];
        for (const part of parts) {
            const num = parseFloat(part.trim());
            if (isNaN(num)) {
                this.errorHandler.addArrayFormatError(fileName, sheetName, row, col, fieldName, 'number[]');
                return [];
            }
            result.push(num);
        }
        return result;
    }

    parseString(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    }

    parseStringArray(value) {
        if (value === null || value === undefined || value === '') return [];
        const str = String(value).trim();
        if (!str) return [];
        return str.split(',').map(s => s.trim());
    }

    parseJson(value, fileName, sheetName, row, col, fieldName) {
        if (value === null || value === undefined || value === '') return null;
        const str = String(value).trim();
        if (!str) return null;
        try {
            return JSON.parse(str);
        } catch (error) {
            this.errorHandler.addJsonFormatError(fileName, sheetName, row, col, fieldName, error.message);
            return null;
        }
    }

    parseJsonArray(value, fileName, sheetName, row, col, fieldName) {
        if (value === null || value === undefined || value === '') return [];
        const str = String(value).trim();
        if (!str) return [];
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) return parsed;
            this.errorHandler.addArrayFormatError(fileName, sheetName, row, col, fieldName, 'jsonArr');
            return [];
        } catch (error) {
            this.errorHandler.addJsonFormatError(fileName, sheetName, row, col, fieldName, error.message);
            return [];
        }
    }

    /**
     * any：对应 TS any；保留 Excel 单元格原始类型，字符串则尝试 JSON.parse，失败则保留字符串。
     */
    parseAny(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        const str = String(value).trim();
        if (!str) return null;
        try {
            return JSON.parse(str);
        } catch {
            return str;
        }
    }

    parseValueByType(value, dataType, fileName, sheetName, row, col, fieldName) {
        switch (dataType) {
            case 'number':
                return this.parseNumber(value, fileName, sheetName, row, col, fieldName);
            case 'number[]':
                return this.parseNumberArray(value, fileName, sheetName, row, col, fieldName);
            case 'string':
                return this.parseString(value);
            case 'string[]':
                return this.parseStringArray(value);
            case 'json':
                return this.parseJson(value, fileName, sheetName, row, col, fieldName);
            case 'jsonArr':
                return this.parseJsonArray(value, fileName, sheetName, row, col, fieldName);
            case 'any':
                return this.parseAny(value);
            default:
                this.errorHandler.addError(fileName, sheetName, row, col, fieldName, `未知的数据类型: ${dataType}`);
                return null;
        }
    }

    /**
     * 解析 A 列中的 start/end 标记，确定数据导出行范围（含边界行）。
     * - A 列某行填写 start：从该行开始导出
     * - A 列某行填写 end：到该行结束导出
     * - 未填写 start：默认从第 4 行开始
     * - 未填写 end：默认到最后一行
     * - end 最小为第 4 行（标记在第 1~3 行时按第 4 行处理）
     */
    parseExportRange(sheet, maxRow, fileName, sheetName) {
        let startRow = 4;
        let endRow = maxRow;

        for (let row = 1; row <= maxRow; row++) {
            const value = this.getCellValue(sheet, row, 1);
            if (value === null || value === undefined) continue;
            const marker = String(value).trim().toLowerCase();
            if (marker === 'start') {
                startRow = row;
            } else if (marker === 'end') {
                endRow = row;
            }
        }

        endRow = Math.max(4, endRow);

        if (startRow > endRow) {
            this.errorHandler.addError(
                fileName,
                sheetName,
                startRow,
                'A',
                '',
                `导出范围无效：start 在第 ${startRow} 行，end 在第 ${endRow} 行`
            );
            return null;
        }

        return { startRow, endRow };
    }

    /**
     * 解析单个Sheet
     * 约定：
     * - A1：表名
     * - 第2行：类型（从B列开始），支持 number | number[] | string | string[] | json | jsonArr | any
     * - 第3行：字段名（从B列开始），须包含 id 列
     * - 第4行开始：数据行（可通过 A 列 start/end 标记调整范围）
     * - 第1行中标记为 $$ 的列不导出
     */
    parseSheet(workbook, sheetName, fileName) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return null;

        // 完全空 Sheet 直接跳过，不报错（常见于模板/空表）
        if (this.isSheetEmpty(sheet) || !sheet['!ref']) {
            return null;
        }

        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        const maxRow = range.e.r + 1;
        const maxCol = range.e.c + 1;

        const tableName = this.getCellValue(sheet, 1, 1);
        if (!tableName || String(tableName).trim() === '') {
            // 若该 sheet 实际是空白区域，也直接跳过
            const maybeEmpty = (maxRow <= 1 && maxCol <= 1);
            if (maybeEmpty) return null;
            this.errorHandler.addMissingTableNameError(fileName);
            return null;
        }

        const excludedCols = new Set();
        excludedCols.add(1); // A列不参与
        for (let col = 1; col <= maxCol; col++) {
            const v = this.getCellValue(sheet, 1, col);
            if (v && String(v).trim() === '$$') excludedCols.add(col);
        }

        // 第3行中查找 id 所在列（不再强制要求 B3）
        let idCol = null;
        for (let col = 2; col <= maxCol; col++) {
            if (excludedCols.has(col)) continue;
            const v = this.getCellValue(sheet, 3, col);
            if (v && String(v).trim().toLowerCase() === 'id') {
                idCol = col;
                break;
            }
        }
        if (!idCol) {
            this.errorHandler.addMissingIdError(fileName, sheetName);
            return null;
        }

        const dataTypes = {};
        for (let col = 2; col <= maxCol; col++) {
            if (excludedCols.has(col)) continue;
            const dt = this.getCellValue(sheet, 2, col);
            if (dt) dataTypes[col] = String(dt).trim();
        }

        const fieldNames = {};
        for (let col = 2; col <= maxCol; col++) {
            if (excludedCols.has(col)) continue;
            const fn = this.getCellValue(sheet, 3, col);
            if (fn) fieldNames[col] = String(fn).trim();
        }

        const exportRange = this.parseExportRange(sheet, maxRow, fileName, sheetName);
        if (!exportRange) return null;

        const { startRow, endRow } = exportRange;
        const data = {};
        for (let row = startRow; row <= endRow; row++) {
            const idValue = this.getCellValue(sheet, row, idCol);
            if (!idValue || String(idValue).trim() === '') continue;

            const id = String(idValue).trim();
            const rowData = { id };

            for (let col = 2; col <= maxCol; col++) {
                if (excludedCols.has(col)) continue;
                const fieldName = fieldNames[col];
                const dataType = dataTypes[col];
                if (!fieldName || !dataType) continue;

                const cellValue = this.getCellValue(sheet, row, col);
                const parsedValue = this.parseValueByType(cellValue, dataType, fileName, sheetName, row, col, fieldName);
                if (fieldName !== 'id') rowData[fieldName] = parsedValue;
            }

            data[id] = rowData;
        }

        return {
            tableName: String(tableName).trim(),
            data
        };
    }

    /**
     * 解析Excel文件（合并所有Sheet）
     */
    parseExcel(filePath) {
        this.errorHandler.clear();
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const fileName = path.basename(filePath);

            if (!sheetNames || sheetNames.length === 0) {
                this.errorHandler.addError(fileName, '', 0, '', '', 'Excel文件没有Sheet');
                return { success: false, data: null, errors: this.errorHandler.getAllErrors() };
            }

            const allData = {};
            let tableName = null;

            for (const sheetName of sheetNames) {
                const result = this.parseSheet(workbook, sheetName, fileName);
                if (result) {
                    if (!tableName) tableName = result.tableName;
                    for (const id in result.data) {
                        if (allData[id]) allData[id] = { ...allData[id], ...result.data[id] };
                        else allData[id] = result.data[id];
                    }
                }
            }

            if (!tableName) {
                // 整个文件都没有有效数据且无其他错误 -> 视为“跳过”
                if (!this.errorHandler.hasErrors()) {
                    return { success: true, skipped: true, tableName: null, data: {}, errors: [] };
                }
                return { success: false, data: null, errors: this.errorHandler.getAllErrors() };
            }

            if (this.errorHandler.hasErrors()) {
                return { success: false, data: null, errors: this.errorHandler.getAllErrors() };
            }

            return { success: true, tableName, data: allData, errors: [] };
        } catch (error) {
            const fileName = path.basename(filePath);
            this.errorHandler.addError(fileName, '', 0, '', '', `解析Excel文件失败: ${error.message}`);
            return { success: false, data: null, errors: this.errorHandler.getAllErrors() };
        }
    }
}

module.exports = ExcelParser;

