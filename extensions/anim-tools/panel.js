'use strict';

const fs = require('fs');
const path = require('path');

const PKG = 'anim-tools';

module.exports = Editor.Panel.define({
    template: fs.readFileSync(path.join(__dirname, 'panel.html'), 'utf-8'),
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
        btnPick: '#btnPick',
        renameBtn: '#renameBtn',
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

        async loadConfig() {
            try {
                const config = await Editor.Message.request(PKG, 'anim-tools:get-config');
                if (!config) {
                    return;
                }
                if (config.lastFolder) {
                    this.$.folderPath.value = config.lastFolder;
                }
                if (config.lastPrefix) {
                    this.$.namePrefix.value = config.lastPrefix;
                }
            } catch (error) {
                console.warn('[anim-tools] 读取配置失败:', error);
            }
        },

        async pickFolder() {
            try {
                const folderPath = await Editor.Message.request(PKG, 'anim-tools:pick-folder');
                if (folderPath) {
                    this.$.folderPath.value = folderPath;
                }
            } catch (error) {
                this.showResult(false, '选择失败', [error.message || String(error)]);
            }
        },

        async doRename() {
            const folderPath = (this.$.folderPath.value || '').trim();
            const prefix = (this.$.namePrefix.value || '').trim();

            if (!folderPath) {
                this.showResult(false, '请先选择文件夹', []);
                return;
            }
            if (!prefix) {
                this.showResult(false, '请先输入命名前缀', []);
                return;
            }

            this.$.renameBtn.disabled = true;
            this.showResult(true, '正在重命名...', []);

            try {
                const resp = await Editor.Message.request(PKG, 'anim-tools:batch-rename', {
                    folderPath,
                    prefix,
                });
                if (resp && resp.success) {
                    this.showResult(true, resp.message || '重命名成功', resp.files || resp.renames || []);
                } else {
                    this.showResult(false, (resp && resp.message) || '重命名失败', (resp && (resp.files || resp.renames)) || []);
                }
            } catch (error) {
                this.showResult(false, '重命名失败', [error.message || String(error)]);
            } finally {
                this.$.renameBtn.disabled = false;
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
        this.$.renameBtn.addEventListener('confirm', () => {
            this.doRename();
        });
    },
    close() {},
});
