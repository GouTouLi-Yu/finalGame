/**
 * 插件主入口
 */
'use strict';

const ConfigManager = require('./lib/configManager');
const FileWatcher = require('./lib/fileWatcher');
const ExcelParser = require('./lib/excelParser');
const pathUtil = require('./lib/pathUtil');
const fs = require('fs');
const path = require('path');

const configManager = new ConfigManager();
const fileWatcher = new FileWatcher();
const excelParser = new ExcelParser();

function getProjectRoot() {
    return pathUtil.getProjectRoot();
}

function getOutputDir() {
    return path.join(getProjectRoot(), 'assets', 'config');
}

function getExcelPathFromConfig() {
    const config = configManager.readConfig();
    const storedPath = config.excelLocation;
    if (!storedPath || storedPath.trim() === '') {
        return null;
    }
    return {
        storedPath,
        absolutePath: pathUtil.resolveExcelLocation(storedPath),
    };
}

function ensureOutputDir() {
    const outputDir = getOutputDir();
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}

function showOperationResult(actionName, result) {
    if (result.success) {
        const message = result.message || `${actionName}成功`;
        if (result.files && result.files.length > 0) {
            Editor.Dialog.info(`${actionName}成功`, `${message}\n\n${result.files.join('\n')}`);
        } else {
            Editor.Dialog.info(`${actionName}成功`, message);
        }
        return true;
    }

    const errorMsg = result.message || `${actionName}失败`;
    const errors = result.errors || [];
    const fullErrorMsg = errors.length > 0
        ? `${errorMsg}\n\n${errors.join('\n')}`
        : errorMsg;
    Editor.Dialog.error(`${actionName}失败`, fullErrorMsg);
    return false;
}

async function exportExcel(excelLocation) {
    try {
        console.log('========== 开始导表 ==========');
        console.log(`Excel 相对路径: ${path.relative(getProjectRoot(), excelLocation)}`);
        console.log(`Excel 绝对路径: ${excelLocation}`);

        if (!fs.existsSync(excelLocation)) {
            const errorMsg = `Excel 目录不存在: ${excelLocation}`;
            console.error('❌ ' + errorMsg);
            return {
                success: false,
                message: errorMsg,
                errors: [errorMsg],
            };
        }

        ensureOutputDir();
        console.log('✓ 输出目录已准备');

        console.log('正在检测 Excel 文件改动...');
        const changedFiles = fileWatcher.detectChangedFiles(excelLocation);

        if (changedFiles.length === 0) {
            console.log('ℹ 没有检测到改动的 Excel 文件');
            return {
                success: true,
                message: '没有检测到改动的 Excel 文件',
                files: [],
            };
        }

        console.log(`✓ 检测到 ${changedFiles.length} 个有改动的 Excel 文件:`);
        changedFiles.forEach((filePath, index) => {
            console.log(`  ${index + 1}. ${path.basename(filePath)}`);
        });

        const tableNamesToDelete = new Set();

        console.log('\n开始解析 Excel 文件...');
        for (const filePath of changedFiles) {
            const fileName = path.basename(filePath);
            console.log(`  正在解析: ${fileName}`);

            const result = excelParser.parseExcel(filePath);
            if (result && result.success && result.skipped) {
                console.log(`    ℹ 跳过空表: ${fileName}`);
                continue;
            }
            if (result && result.success && result.tableName) {
                console.log(`    ✓ 表名: ${result.tableName}, 数据条数: ${Object.keys(result.data).length}`);
                tableNamesToDelete.add(result.tableName);
            } else if (result && result.errors && result.errors.length > 0) {
                console.error(`    ❌ 解析失败: ${fileName}`);
                result.errors.forEach((err) => console.error(`      - ${err}`));
                return {
                    success: false,
                    message: `Excel 文件解析失败: ${fileName}`,
                    errors: result.errors,
                };
            }
        }

        if (tableNamesToDelete.size === 0) {
            console.log('ℹ 本次改动的文件中没有可导出的有效表（可能都是空表/模板）');
            return {
                success: true,
                message: '没有可导出的有效表（可能都是空表/模板）',
                files: [],
            };
        }

        console.log('\n删除旧的 JSON 文件...');
        const outputDir = getOutputDir();
        for (const tableName of tableNamesToDelete) {
            const jsonPath = path.join(outputDir, `${tableName}.json`);
            if (fs.existsSync(jsonPath)) {
                fs.unlinkSync(jsonPath);
                console.log(`  ✓ 已删除: ${tableName}.json`);
            }
        }

        console.log('\n重新解析所有相关 Excel 文件...');
        const allExcelFiles = fileWatcher.getAllExcelFiles(excelLocation);

        if (allExcelFiles.length === 0) {
            const errorMsg = `在目录 ${excelLocation} 中未找到任何 Excel 文件`;
            console.error('❌ ' + errorMsg);
            return {
                success: false,
                message: errorMsg,
                errors: [errorMsg],
            };
        }

        console.log(`  找到 ${allExcelFiles.length} 个 Excel 文件`);
        const tableDataMap = {};
        const allErrors = [];

        for (const filePath of allExcelFiles) {
            const result = excelParser.parseExcel(filePath);

            if (result && result.success && result.skipped) {
                continue;
            }
            if (result && result.success && result.tableName) {
                if (tableNamesToDelete.has(result.tableName)) {
                    if (!tableDataMap[result.tableName]) {
                        tableDataMap[result.tableName] = {};
                    }
                    const beforeCount = Object.keys(tableDataMap[result.tableName]).length;
                    Object.assign(tableDataMap[result.tableName], result.data);
                    const afterCount = Object.keys(tableDataMap[result.tableName]).length;

                    fileWatcher.updateExcelCache(filePath, result.tableName);

                    if (afterCount > beforeCount) {
                        console.log(`    ✓ ${path.basename(filePath)} -> ${result.tableName} (新增 ${afterCount - beforeCount} 条数据)`);
                    }
                }
            } else if (result && result.errors && result.errors.length > 0) {
                console.error(`    ❌ ${path.basename(filePath)} 解析失败`);
                result.errors.forEach((err) => console.error(`      - ${err}`));
                allErrors.push(...result.errors);
            }
        }

        if (allErrors.length > 0) {
            console.error('\n❌ Excel 文件解析过程中出现错误:');
            allErrors.forEach((err) => console.error(`  - ${err}`));
            return {
                success: false,
                message: `Excel 文件解析过程中出现 ${allErrors.length} 个错误`,
                errors: allErrors,
            };
        }

        console.log('\n生成 JSON 文件...');
        const generatedFiles = [];
        const outputDirPath = getOutputDir();

        for (const tableName in tableDataMap) {
            const jsonPath = path.join(outputDirPath, `${tableName}.json`);
            const jsonData = {
                [tableName]: tableDataMap[tableName],
            };

            const dataCount = Object.keys(tableDataMap[tableName]).length;
            fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
            fileWatcher.updateJsonCache(jsonPath, [tableName]);
            generatedFiles.push(path.relative(getProjectRoot(), jsonPath));
            console.log(`  ✓ ${tableName}.json (${dataCount} 条数据)`);
        }

        console.log('\n========== 导表成功 ==========');
        console.log(`✓ 成功导出 ${generatedFiles.length} 个 JSON 文件`);

        return {
            success: true,
            message: `成功导出 ${generatedFiles.length} 个 JSON 文件`,
            files: generatedFiles,
        };
    } catch (error) {
        console.error('\n========== 导表失败 ==========');
        console.error(`❌ 错误: ${error.message}`);
        if (error.stack) {
            console.error('错误堆栈:', error.stack);
        }
        return {
            success: false,
            message: `导出失败: ${error.message}`,
            errors: [error.message],
        };
    }
}

async function validateAllExcel(excelLocation) {
    try {
        console.log('========== 开始导表校验 ==========');
        console.log(`Excel 绝对路径: ${excelLocation}`);

        if (!fs.existsSync(excelLocation)) {
            const errorMsg = `Excel 目录不存在: ${excelLocation}`;
            return {
                success: false,
                message: errorMsg,
                errors: [errorMsg],
            };
        }

        const allExcelFiles = fileWatcher.getAllExcelFiles(excelLocation);
        if (allExcelFiles.length === 0) {
            return {
                success: false,
                message: '未找到任何 Excel 文件',
                errors: ['未找到任何 Excel 文件'],
            };
        }

        const allErrors = [];
        const tableFiles = {};
        let validFileCount = 0;
        let skippedFileCount = 0;
        let totalRowCount = 0;
        const checkedFiles = [];

        for (const filePath of allExcelFiles) {
            const fileName = path.basename(filePath);
            const result = excelParser.parseExcel(filePath);

            if (result && result.success && result.skipped) {
                skippedFileCount++;
                continue;
            }

            if (!result || !result.success) {
                allErrors.push(...(result && result.errors ? result.errors : [`[文件: ${fileName}] 解析失败`]));
                continue;
            }

            validFileCount++;
            totalRowCount += Object.keys(result.data).length;
            checkedFiles.push(`${fileName} -> ${result.tableName} (${Object.keys(result.data).length} 条)`);

            if (!tableFiles[result.tableName]) {
                tableFiles[result.tableName] = [];
            }
            tableFiles[result.tableName].push(fileName);
        }

        for (const tableName in tableFiles) {
            if (tableFiles[tableName].length > 1) {
                allErrors.push(
                    `[表名冲突] 表名 "${tableName}" 出现在多个文件中: ${tableFiles[tableName].join(', ')}`
                );
            }
        }

        if (allErrors.length > 0) {
            console.error(`❌ 校验失败，共 ${allErrors.length} 个问题`);
            return {
                success: false,
                message: `校验失败，共 ${allErrors.length} 个问题`,
                errors: allErrors,
            };
        }

        const summary = [
            `Excel 文件: ${allExcelFiles.length} 个`,
            `有效表: ${validFileCount} 个`,
            `跳过空表: ${skippedFileCount} 个`,
            `数据总行数: ${totalRowCount} 条`,
            '',
            ...checkedFiles,
        ];

        console.log('✓ 校验通过');
        return {
            success: true,
            message: `校验通过：${validFileCount} 张有效表，共 ${totalRowCount} 条数据`,
            files: summary,
        };
    } catch (error) {
        console.error('❌ 校验异常:', error);
        return {
            success: false,
            message: `校验失败: ${error.message}`,
            errors: [error.message],
        };
    }
}

async function openExcelFolder(excelLocation, storedPath) {
    if (!fs.existsSync(excelLocation)) {
        Editor.Dialog.warn(
            '路径不存在',
            `数据表目录不存在:\n${storedPath}\n\n请在 extensions/export-excel/settings.json 中配置 excelLocation（相对项目根目录）`
        );
        return false;
    }

    const { shell } = require('electron');
    const result = await shell.openPath(excelLocation);
    if (result) {
        Editor.Dialog.error('打开失败', result);
        return false;
    }
    return true;
}

async function openPanel() {
    console.log('[一键导表] 开始导表');

    const excelPathInfo = getExcelPathFromConfig();
    if (!excelPathInfo) {
        Editor.Dialog.warn(
            '配置缺失',
            '请先在 extensions/export-excel/settings.json 中配置 excelLocation（相对项目根目录）'
        );
        return false;
    }

    const exportResult = await exportExcel(excelPathInfo.absolutePath);
    return showOperationResult('导表', exportResult);
}

async function validateExcel() {
    console.log('[导表校验] 开始校验');

    const excelPathInfo = getExcelPathFromConfig();
    if (!excelPathInfo) {
        Editor.Dialog.warn(
            '配置缺失',
            '请先在 extensions/export-excel/settings.json 中配置 excelLocation（相对项目根目录）'
        );
        return false;
    }

    const validateResult = await validateAllExcel(excelPathInfo.absolutePath);
    return showOperationResult('导表校验', validateResult);
}

async function openFolder() {
    console.log('[打开数据表目录]');

    const excelPathInfo = getExcelPathFromConfig();
    if (!excelPathInfo) {
        Editor.Dialog.warn(
            '配置缺失',
            '请先在 extensions/export-excel/settings.json 中配置 excelLocation（相对项目根目录）'
        );
        return false;
    }

    return openExcelFolder(excelPathInfo.absolutePath, excelPathInfo.storedPath);
}

function getConfig(event) {
    const config = configManager.readConfig();
    event.reply(null, config);
}

function setConfig(event, config) {
    if (config && config.excelLocation) {
        configManager.setExcelLocation(config.excelLocation);
    }
    event.reply(null, true);
}

async function doExport(event, options) {
    if (!options || !options.excelLocation) {
        const errorMsg = '未提供 Excel 路径';
        event.reply(null, {
            success: false,
            message: errorMsg,
            errors: [errorMsg],
        });
        return;
    }

    try {
        const absolutePath = pathUtil.resolveExcelLocation(options.excelLocation);
        const result = await exportExcel(absolutePath);
        event.reply(null, result);
    } catch (error) {
        event.reply(null, {
            success: false,
            message: `导出失败: ${error.message}`,
            errors: [error.message],
        });
    }
}

exports.methods = {
    openPanel,
    validateExcel,
    openFolder,
    getConfig,
    setConfig,
    doExport,
};

exports.load = function () {
    console.log('[export-excel] 插件已加载');
};

exports.unload = function () {
    console.log('[export-excel] 插件已卸载');
};
