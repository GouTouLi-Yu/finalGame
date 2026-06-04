/**
 * 错误处理模块
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
    }

    /**
     * 添加错误
     */
    addError(fileName, sheetName, row, col, fieldName, message) {
        const error = {
            fileName: fileName,
            sheetName: sheetName || '',
            row: row,
            col: col,
            fieldName: fieldName || '',
            message: message
        };
        this.errors.push(error);
    }

    /**
     * 添加缺少表名错误
     */
    addMissingTableNameError(fileName) {
        this.addError(fileName, '', 1, 'A', '', '第1行A列未填写表名，请填写表名');
    }

    /**
     * 添加缺少id字段错误
     */
    addMissingIdError(fileName, sheetName) {
        this.addError(fileName, sheetName, 3, 'B', 'id', '第3行B列必须填写"id"字段');
    }

    /**
     * 添加JSON格式错误
     */
    addJsonFormatError(fileName, sheetName, row, col, fieldName, errorMessage) {
        this.addError(fileName, sheetName, row, col, fieldName, `JSON格式错误：${errorMessage}`);
    }

    /**
     * 添加数据类型错误
     */
    addDataTypeError(fileName, sheetName, row, col, fieldName, expectedType, actualValue) {
        this.addError(fileName, sheetName, row, col, fieldName, `数据类型错误：期望${expectedType}，实际为"${actualValue}"`);
    }

    /**
     * 添加数组格式错误
     */
    addArrayFormatError(fileName, sheetName, row, col, fieldName, arrayType) {
        this.addError(fileName, sheetName, row, col, fieldName, `数组格式错误：无法解析为${arrayType}`);
    }

    /**
     * 格式化错误信息
     */
    formatError(error) {
        let message = `[文件: ${error.fileName}]`;

        if (error.sheetName) {
            message += ` [Sheet: ${error.sheetName}]`;
        }

        if (error.row > 0) {
            message += ` 第${error.row}行`;
        }

        if (error.col) {
            message += ` 第${error.col}列`;
        }

        if (error.fieldName) {
            message += `(${error.fieldName})`;
        }

        message += ` ${error.message}`;

        return message;
    }

    /**
     * 获取所有错误信息
     */
    getAllErrors() {
        return this.errors.map(error => this.formatError(error));
    }

    /**
     * 是否有错误
     */
    hasErrors() {
        return this.errors.length > 0;
    }

    /**
     * 清空错误
     */
    clear() {
        this.errors = [];
    }
}

module.exports = ErrorHandler;

