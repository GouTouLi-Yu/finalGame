'use strict';

const fs = require('fs');
const path = require('path');

const PKG = 'anim-tools';

module.exports = Editor.Panel.define({
    template: fs.readFileSync(path.join(__dirname, 'panel-build.html'), 'utf-8'),
    style: `
        :host {
            display: flex;
            flex-direction: column;
            padding: 12px;
            gap: 8px;
        }
        .title {
            margin: 0;
            font-size: 16px;
            color: var(--color-normal-contrast-weakest);
        }
        .hint {
            margin: 0 0 4px;
            font-size: 12px;
            line-height: 1.6;
            color: var(--color-normal-contrast-weaker);
        }
        .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .folder-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .folder-row ui-input {
            flex: 1;
        }
        .scale-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .scale-row ui-input {
            width: 80px;
            flex: none;
        }
        .scale-hint {
            font-size: 12px;
            color: var(--color-normal-contrast-weaker);
        }
        .result {
            margin-top: 4px;
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 12px;
        }
        .result.hidden {
            display: none;
        }
        .result.success {
            background: rgba(82, 196, 26, 0.12);
            border: 1px solid rgba(82, 196, 26, 0.35);
            color: #52c41a;
        }
        .result.error {
            background: rgba(255, 77, 79, 0.12);
            border: 1px solid rgba(255, 77, 79, 0.35);
            color: #ff4d4f;
        }
        .resultTitle {
            margin-bottom: 4px;
            font-weight: 600;
        }
        .resultList {
            margin: 0;
            padding-left: 16px;
            max-height: 200px;
            overflow: auto;
        }
        .resultList li {
            margin: 2px 0;
            word-break: break-all;
        }
    `,
    $: {
        folderPath: '#folderPath',
        namePrefix: '#namePrefix',
        scaleInput: '#scaleInput',
        btnPick: '#btnPick',
        buildBtn: '#buildBtn',
        result: '#result',
        resultTitle: '#resultTitle',
        resultList: '#resultList',
    },
    methods: {
        showResult(ok, title, lines) {
            const box = this.$.result;
            box.classList.remove('hidden', 'success', 'error');
            box.classList.add(ok ? 'success' : 'error');
            this.$.resultTitle.textContent = title || '';
            this.$.resultList.innerHTML = '';
            if (lines && lines.length) {
                lines.forEach((line) => {
                    const li = document.createElement('li');
                    li.textContent = String(line);
                    this.$.resultList.appendChild(li);
                });
            }
        },

        parseScale(value) {
            const raw = (value || '').trim();
            if (raw === '') {
                return 1;
            }
            const scale = Number(raw);
            if (!Number.isFinite(scale) || scale < 0 || scale > 2) {
                return null;
            }
            return scale;
        },

        async loadConfig() {
            try {
                const config = await Editor.Message.request(PKG, 'anim-tools:get-config');
                if (config && config.lastBuildFolder) {
                    this.$.folderPath.value = config.lastBuildFolder;
                }
                if (config && config.lastPrefix) {
                    this.$.namePrefix.value = config.lastPrefix;
                }
                if (config && config.lastBuildScale !== undefined && config.lastBuildScale !== '') {
                    this.$.scaleInput.value = String(config.lastBuildScale);
                } else {
                    this.$.scaleInput.value = '1';
                }
            } catch (error) {
                console.warn('[anim-tools] 读取配置失败:', error);
            }
        },

        async suggestPrefixForFolder(folderPath) {
            try {
                const prefix = await Editor.Message.request(PKG, 'anim-tools:suggest-prefix', { folderPath });
                if (prefix) {
                    this.$.namePrefix.value = prefix;
                }
            } catch (error) {
                console.warn('[anim-tools] 推测命名前缀失败:', error);
            }
        },

        async pickFolder() {
            try {
                const folderPath = await Editor.Message.request(PKG, 'anim-tools:pick-folder');
                if (folderPath) {
                    this.$.folderPath.value = folderPath;
                    await this.suggestPrefixForFolder(folderPath);
                }
            } catch (error) {
                this.showResult(false, '选择失败', [error.message || String(error)]);
            }
        },

        async doBuild() {
            const folderPath = (this.$.folderPath.value || '').trim();
            const prefix = (this.$.namePrefix.value || '').trim();
            if (!folderPath) {
                this.showResult(false, '请先选择美术序列帧目录', []);
                return;
            }
            if (!prefix) {
                this.showResult(false, '请先输入命名前缀', []);
                return;
            }

            const scale = this.parseScale(this.$.scaleInput.value);
            if (scale === null) {
                this.showResult(false, '缩放比例无效', ['请输入 0 ~ 2 之间的数值，1 表示原尺寸']);
                return;
            }

            this.$.buildBtn.disabled = true;
            this.showResult(true, '正在重命名并制作帧动画，请稍候...', []);

            try {
                const resp = await Editor.Message.request(PKG, 'anim-tools:build-frame-anim', {
                    folderPath,
                    prefix,
                    scale,
                });
                if (resp && resp.success) {
                    const lines = [];
                    if (resp.renames && resp.renames.length) {
                        lines.push(`已重命名 ${resp.renameCount || resp.renames.length} 张序列帧`);
                        lines.push(...resp.renames);
                    }
                    if (resp.files && resp.files.length) {
                        if (lines.length) {
                            lines.push('');
                        }
                        lines.push('生成资源：');
                        lines.push(...resp.files);
                    }
                    this.showResult(true, resp.message || '制作成功', lines);
                } else {
                    this.showResult(
                        false,
                        (resp && resp.message) || '制作失败',
                        (resp && (resp.renames || resp.files)) || []
                    );
                }
            } catch (error) {
                this.showResult(false, '制作失败', [error.message || String(error)]);
            } finally {
                this.$.buildBtn.disabled = false;
            }
        },
    },
    ready() {
        const missing = Object.entries(this.$).filter(([, el]) => !el).map(([key]) => key);
        if (missing.length) {
            console.error('[anim-tools] 面板元素未找到:', missing.join(', '));
            return;
        }

        this.loadConfig();
        this.$.btnPick.addEventListener('confirm', () => {
            this.pickFolder();
        });
        this.$.buildBtn.addEventListener('confirm', () => {
            this.doBuild();
        });
    },
    close() {},
});
