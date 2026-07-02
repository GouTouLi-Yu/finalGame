'use strict';

const fs = require('fs');
const path = require('path');

const PKG = 'tinypng-tools';

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
        .hint strong {
            color: var(--color-normal-contrast-weakest);
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
        .hint.small {
            margin: -4px 0 4px;
            font-size: 11px;
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
            max-height: 220px;
            overflow: auto;
        }
        .resultList li {
            margin: 2px 0;
            word-break: break-all;
        }
    `,
    $: {
        apiKey: '#apiKey',
        folderPath: '#folderPath',
        btnPick: '#btnPick',
        btnPasteKey: '#btnPasteKey',
        compressBtn: '#compressBtn',
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
                const config = await Editor.Message.request(PKG, 'tinypng-tools:get-config');
                if (!config) {
                    return;
                }
                if (config.apiKey) {
                    this.$.apiKey.value = config.apiKey;
                }
                if (config.lastFolder) {
                    this.$.folderPath.value = config.lastFolder;
                }
            } catch (error) {
                console.warn('[tinypng-tools] 读取配置失败:', error);
            }
        },

        async saveApiKey() {
            const apiKey = (this.$.apiKey.value || '').trim();
            if (!apiKey) {
                return;
            }
            try {
                await Editor.Message.request(PKG, 'tinypng-tools:set-config', { apiKey });
            } catch (error) {
                console.warn('[tinypng-tools] 保存 API Key 失败:', error);
            }
        },

        async pasteApiKey() {
            try {
                let text = '';
                if (typeof require === 'function') {
                    try {
                        const { clipboard } = require('electron');
                        text = clipboard.readText();
                    } catch (error) {
                        // ignore
                    }
                }
                if (!text && navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
                if (!text || !text.trim()) {
                    this.showResult(false, '剪贴板为空', ['请先复制 API Key，或编辑 settings.json']);
                    return;
                }
                this.$.apiKey.value = text.trim();
                await this.saveApiKey();
            } catch (error) {
                this.showResult(false, '粘贴失败', [
                    error.message || String(error),
                    '请手动输入，或编辑 extensions/tinypng-tools/settings.json',
                ]);
            }
        },

        async pickFolder() {
            try {
                const folderPath = await Editor.Message.request(PKG, 'tinypng-tools:pick-folder');
                if (folderPath) {
                    this.$.folderPath.value = folderPath;
                }
            } catch (error) {
                this.showResult(false, '选择失败', [error.message || String(error)]);
            }
        },

        async doCompress() {
            const folderPath = (this.$.folderPath.value || '').trim();
            const apiKey = (this.$.apiKey.value || '').trim();

            if (!folderPath) {
                this.showResult(false, '请先选择文件夹', []);
                return;
            }
            if (!apiKey) {
                this.showResult(false, '请先填写 TinyPNG API Key', []);
                return;
            }

            this.$.compressBtn.disabled = true;
            this.showResult(true, '正在压缩，请稍候...', []);

            try {
                const resp = await Editor.Message.request(PKG, 'tinypng-tools:compress-folder', {
                    folderPath,
                    apiKey,
                });
                if (resp && resp.compressed > 0) {
                    const lines = (resp.files || []).slice(0, 50);
                    if ((resp.files || []).length > 50) {
                        lines.push(`... 还有 ${resp.files.length - 50} 张，详见 Console`);
                    }
                    if (resp.errors && resp.errors.length) {
                        lines.push(...resp.errors.map((e) => `失败: ${e}`));
                    }
                    this.showResult(!resp.failed, resp.message || '压缩完成', lines);
                } else if (resp && resp.success) {
                    this.showResult(true, resp.message || '压缩完成', resp.files || []);
                } else {
                    this.showResult(false, (resp && resp.message) || '压缩失败', (resp && resp.errors) || []);
                }
            } catch (error) {
                this.showResult(false, '压缩失败', [error.message || String(error)]);
            } finally {
                this.$.compressBtn.disabled = false;
            }
        },
    },
    ready() {
        const missing = Object.entries(this.$).filter(([, el]) => !el).map(([key]) => key);
        if (missing.length) {
            console.error('[tinypng-tools] 面板元素未找到:', missing.join(', '));
            return;
        }

        this.loadConfig();
        this.$.apiKey.addEventListener('confirm', () => {
            this.saveApiKey();
        });
        this.$.btnPasteKey.addEventListener('confirm', () => {
            this.pasteApiKey();
        });
        this.$.btnPick.addEventListener('confirm', () => {
            this.pickFolder();
        });
        this.$.compressBtn.addEventListener('confirm', () => {
            this.doCompress();
        });
    },
    close() {},
});
