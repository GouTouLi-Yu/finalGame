/**
 * 插件主入口
 */
'use strict';

const ConfigManager = require('./lib/configManager');
const FileWatcher = require('./lib/fileWatcher');
const ExcelParser = require('./lib/excelParser');
const fs = require('fs');
const path = require('path');

const configManager = new ConfigManager();
const fileWatcher = new FileWatcher();
const excelParser = new ExcelParser();

// 获取项目根目录
function getProjectRoot() {
    return Editor.Project.path;
}

// 获取输出目录（固定导出到 assets/config）
function getOutputDir() {
    const projectRoot = getProjectRoot();
    return path.join(projectRoot, 'assets', 'config');
}

// 确保输出目录存在
function ensureOutputDir() {
    const outputDir = getOutputDir();
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}

// 导出Excel
async function exportExcel(excelLocation) {
    try {
        console.log('========== 开始导表 ==========');
        console.log(`Excel文件路径: ${excelLocation}`);

        // 检查Excel路径是否存在
        if (!fs.existsSync(excelLocation)) {
            const errorMsg = `Excel文件路径不存在: ${excelLocation}`;
            console.error('❌ ' + errorMsg);
            return {
                success: false,
                message: errorMsg,
                errors: [errorMsg]
            };
        }

        // 确保输出目录存在
        ensureOutputDir();
        console.log('✓ 输出目录已准备');

        // 检测有改动的文件
        console.log('正在检测Excel文件改动...');
        const changedFiles = fileWatcher.detectChangedFiles(excelLocation);

        if (changedFiles.length === 0) {
            console.log('ℹ 没有检测到改动的Excel文件');
            return {
                success: true,
                message: '没有检测到改动的Excel文件',
                files: []
            };
        }

        console.log(`✓ 检测到 ${changedFiles.length} 个有改动的Excel文件:`);
        changedFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${path.basename(file)}`);
        });

        // 收集需要删除的表名
        const tableNamesToDelete = new Set();

        console.log('\n开始解析Excel文件...');
        // 解析所有改动的Excel文件，获取表名
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
                // 如果有错误，返回错误信息
                console.error(`    ❌ 解析失败: ${fileName}`);
                result.errors.forEach(err => console.error(`      - ${err}`));
                return {
                    success: false,
                    message: `Excel文件解析失败: ${fileName}`,
                    errors: result.errors
                };
            }
        }

        if (tableNamesToDelete.size === 0) {
            console.log('ℹ 本次改动的文件中没有可导出的有效表（可能都是空表/模板）');
            return {
                success: true,
                message: '没有可导出的有效表（可能都是空表/模板）',
                files: []
            };
        }

        // 删除对应的JSON文件
        console.log('\n删除旧的JSON文件...');
        const outputDir = getOutputDir();
        for (const tableName of tableNamesToDelete) {
            const jsonPath = path.join(outputDir, `${tableName}.json`);
            if (fs.existsSync(jsonPath)) {
                fs.unlinkSync(jsonPath);
                console.log(`  ✓ 已删除: ${tableName}.json`);
            }
        }

        // 重新解析所有相关Excel文件（包括相同表名的其他文件）
        console.log('\n重新解析所有相关Excel文件...');
        const allExcelFiles = fileWatcher.getAllExcelFiles(excelLocation);

        if (allExcelFiles.length === 0) {
            const errorMsg = `在路径 ${excelLocation} 中未找到任何Excel文件`;
            console.error('❌ ' + errorMsg);
            return {
                success: false,
                message: errorMsg,
                errors: [errorMsg]
            };
        }

        console.log(`  找到 ${allExcelFiles.length} 个Excel文件`);
        const tableDataMap = {};
        const allErrors = [];

        for (const filePath of allExcelFiles) {
            const result = excelParser.parseExcel(filePath);

            if (result && result.success && result.skipped) {
                continue;
            }
            if (result && result.success && result.tableName) {
                if (tableNamesToDelete.has(result.tableName)) {
                    // 合并数据
                    if (!tableDataMap[result.tableName]) {
                        tableDataMap[result.tableName] = {};
                    }
                    const beforeCount = Object.keys(tableDataMap[result.tableName]).length;
                    Object.assign(tableDataMap[result.tableName], result.data);
                    const afterCount = Object.keys(tableDataMap[result.tableName]).length;

                    // 更新缓存
                    fileWatcher.updateExcelCache(filePath, result.tableName);

                    if (afterCount > beforeCount) {
                        console.log(`    ✓ ${path.basename(filePath)} -> ${result.tableName} (新增 ${afterCount - beforeCount} 条数据)`);
                    }
                }
            } else if (result && result.errors && result.errors.length > 0) {
                console.error(`    ❌ ${path.basename(filePath)} 解析失败`);
                result.errors.forEach(err => console.error(`      - ${err}`));
                allErrors.push(...result.errors);
            }
        }

        // 如果有错误，返回错误信息
        if (allErrors.length > 0) {
            console.error('\n❌ Excel文件解析过程中出现错误:');
            allErrors.forEach(err => console.error(`  - ${err}`));
            return {
                success: false,
                message: `Excel文件解析过程中出现 ${allErrors.length} 个错误`,
                errors: allErrors
            };
        }

        // 生成JSON文件
        console.log('\n生成JSON文件...');
        const generatedFiles = [];
        const outputDirPath = getOutputDir();

        for (const tableName in tableDataMap) {
            const jsonPath = path.join(outputDirPath, `${tableName}.json`);
            const jsonData = {
                [tableName]: tableDataMap[tableName]
            };

            const dataCount = Object.keys(tableDataMap[tableName]).length;
            fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
            fileWatcher.updateJsonCache(jsonPath, [tableName]);
            const relativePath = path.relative(getProjectRoot(), jsonPath);
            generatedFiles.push(relativePath);
            console.log(`  ✓ ${tableName}.json (${dataCount} 条数据)`);
        }

        console.log('\n========== 导表成功 ==========');
        console.log(`✓ 成功导出 ${generatedFiles.length} 个JSON文件`);
        console.log(`✓ 输出目录: ${outputDirPath}`);
        generatedFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file}`);
        });

        return {
            success: true,
            message: `成功导出 ${generatedFiles.length} 个JSON文件`,
            files: generatedFiles
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
            errors: [error.message]
        };
    }
}

/**
 * 打开面板方法
 */
async function openPanel() {
    console.log('[一键导表] 开始导表');

    // 读取配置（默认已指向 D:\finalGame\reslgy\数据表\master\）
    const config = configManager.readConfig();
    const excelPath = config.excelLocation;

    if (!excelPath || excelPath.trim() === '') {
        Editor.Dialog.warn('配置缺失', '请先在 extensions/export-excel/settings.json 中配置 excelLocation 路径');
        console.error('[一键导表] Excel路径未配置');
        return false;
    }

    // 直接执行导出
    console.log('[一键导表] 使用Excel路径:', excelPath);
    const exportResult = await exportExcel(excelPath);

    if (exportResult.success) {
        const message = exportResult.message || 'Excel文件已成功转换为JSON';
        if (exportResult.files && exportResult.files.length > 0) {
            Editor.Dialog.info('导表成功', `${message}\n\n生成的文件:\n${exportResult.files.join('\n')}`);
        } else {
            Editor.Dialog.info('导表成功', message);
        }
    } else {
        const errorMsg = exportResult.message || '导出过程中出现错误';
        const errors = exportResult.errors || [];
        const fullErrorMsg = errors.length > 0
            ? `${errorMsg}\n\n错误详情:\n${errors.join('\n')}`
            : errorMsg;
        Editor.Dialog.error('导表失败', fullErrorMsg);
    }

    return exportResult.success;
}

// 获取配置
function getConfig(event) {
    const config = configManager.readConfig();
    event.reply(null, config);
}

// 设置配置
function setConfig(event, config) {
    if (config && config.excelLocation) {
        configManager.setExcelLocation(config.excelLocation);
    }
    event.reply(null, true);
}

// 执行导出
async function doExport(event, options) {
    console.log('========== 收到导表请求 ==========');
    console.log('Excel路径:', options ? options.excelLocation : '未提供');

    if (!options || !options.excelLocation) {
        const errorMsg = '未提供Excel路径';
        console.error('❌', errorMsg);
        event.reply(null, {
            success: false,
            message: errorMsg,
            errors: [errorMsg]
        });
        return;
    }

    try {
        const result = await exportExcel(options.excelLocation);
        if (result.success) {
            console.log('✓ 导表完成');
        } else {
            console.error('❌ 导表失败');
        }
        event.reply(null, result);
    } catch (error) {
        console.error('❌ 导表异常:', error);
        console.error('错误堆栈:', error.stack);
        event.reply(null, {
            success: false,
            message: `导出失败: ${error.message}`,
            errors: [error.message]
        });
    }
}

// 导出 methods 对象（必须使用 exports.methods，不能使用 module.exports）
exports.methods = {
    openPanel: openPanel,
    getConfig: getConfig,
    setConfig: setConfig,
    doExport: doExport
};

// 导出 load 和 unload 函数
exports.load = function() {
    console.log('[一键导表] 插件已加载');
};

exports.unload = function() {
    console.log('[一键导表] 插件已卸载');
};

