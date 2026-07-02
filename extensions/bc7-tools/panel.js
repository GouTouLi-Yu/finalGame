'use strict';

const fs = require('fs');
const path = require('path');

const PKG = 'bc7-tools';

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
        .hint.small {
            margin: -4px 0 4px;
            font-size: 11px;
        }
        .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .folder-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .folder-row ui-input,
        .folder-row ui-text-area {
            flex: 1;
            min-height: 28px;
        }
        .btn-row {
            display: flex;
            gap: 8px;
        }
        .result {
            margin-top: 4px;
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 12px;
        }
        .result.hidden { display: none; }
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
            max-height: 220px;
            overflow: auto;
        }
        .resultList li {
            margin: 2px 0;
            word-break: break-all;
        }
    `,
    $: {
        texconvPath: '#texconvPath',
        folderPath: '#folderPath',
        btnPickTexconv: '#btnPickTexconv',
        btnPick: '#btnPick',
        compressBtn: '#compressBtn',
        restoreBtn: '#restoreBtn',
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
                const config = await Editor.Message.request(PKG, 'bc7-tools:get-config');
                if (!config) {
                    return;
                }
                if (config.texconvPath) {
                    this.$.texconvPath.value = config.texconvPath;
                }
                if (config.lastFolder) {
                    this.$.folderPath.value = config.lastFolder;
                }
            } catch (error) {
                console.warn('[bc7-tools] 读取配置失败:', error);
            }
        },

        async saveTexconvPath() {
            const texconvPath = (this.$.texconvPath.value || '').trim();
            if (!texconvPath) {
                return;
            }
            try {
                await Editor.Message.request(PKG, 'bc7-tools:set-config', { texconvPath });
            } catch (error) {
                console.warn('[bc7-tools] 保存 texconv 路径失败:', error);
            }
        },

        async pickTexconv() {
            try {
                const picked = await Editor.Message.request(PKG, 'bc7-tools:pick-texconv');
                if (picked) {
                    this.$.texconvPath.value = picked;
                    await this.saveTexconvPath();
                }
            } catch (error) {
                this.showResult(false, '选择失败', [error.message || String(error)]);
            }
        },

        async pickFolder() {
            try {
                const folderPath = await Editor.Message.request(PKG, 'bc7-tools:pick-folder');
                if (folderPath) {
                    this.$.folderPath.value = folderPath;
                }
            } catch (error) {
                this.showResult(false, '选择失败', [error.message || String(error)]);
            }
        },

        async doCompress() {
            const folderPath = (this.$.folderPath.value || '').trim();
            const texconvPath = (this.$.texconvPath.value || '').trim();
            if (!folderPath) {
                this.showResult(false, '请先选择文件夹', []);
                return;
            }
            if (!texconvPath) {
                this.showResult(false, '请先配置 texconv.exe 路径', []);
                return;
            }

            this.$.compressBtn.disabled = true;
            this.showResult(true, '正在 BC7 压缩，请稍候...', []);

            try {
                const resp = await Editor.Message.request(PKG, 'bc7-tools:compress-folder', {
                    folderPath,
                    texconvPath,
                });
                this.showOpResult(resp);
            } catch (error) {
                this.showResult(false, '压缩失败', [error.message || String(error)]);
            } finally {
                this.$.compressBtn.disabled = false;
            }
        },

        async doRestore() {
            const folderPath = (this.$.folderPath.value || '').trim();
            if (!folderPath) {
                this.showResult(false, '请先选择要还原的文件夹', []);
                return;
            }

            this.$.restoreBtn.disabled = true;
            this.showResult(true, '正在从备份还原...', []);

            try {
                const resp = await Editor.Message.request(PKG, 'bc7-tools:restore-folder', { folderPath });
                this.showOpResult(resp);
            } catch (error) {
                this.showResult(false, '还原失败', [error.message || String(error)]);
            } finally {
                this.$.restoreBtn.disabled = false;
            }
        },

        showOpResult(resp) {
            if (!resp) {
                this.showResult(false, '操作失败', []);
                return;
            }
            const lines = (resp.files || []).slice(0, 50);
            if ((resp.files || []).length > 50) {
                lines.push(`... 还有 ${resp.files.length - 50} 项，详见 Console`);
            }
            if (resp.errors && resp.errors.length) {
                lines.push(...resp.errors.map((e) => `失败: ${e}`));
            }
            if (resp.backupDir) {
                lines.unshift(`备份: ${resp.backupDir}`);
            }
            const ok = resp.success || (resp.converted > 0) || (resp.restored > 0);
            this.showResult(ok, resp.message || (ok ? '完成' : '失败'), lines);
        },
    },
    ready() {
        const missing = Object.entries(this.$).filter(([, el]) => !el).map(([key]) => key);
        if (missing.length) {
            console.error('[bc7-tools] 面板元素未找到:', missing.join(', '));
            return;
        }

        this.loadConfig();
        this.$.texconvPath.addEventListener('confirm', () => {
            this.saveTexconvPath();
        });
        this.$.btnPickTexconv.addEventListener('confirm', () => {
            this.pickTexconv();
        });
        this.$.btnPick.addEventListener('confirm', () => {
            this.pickFolder();
        });
        this.$.compressBtn.addEventListener('confirm', () => {
            this.doCompress();
        });
        this.$.restoreBtn.addEventListener('confirm', () => {
            this.doRestore();
        });
    },
    close() {},
});
