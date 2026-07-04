import { Label, Node, NodeEventType, RichText } from 'cc';
import { EventDispatcher, EventListener } from '../../frame/event/EventDispatcher';
import { Injector } from '../../frame/Injector/Injector';
import { PCEventType } from '../../frame/event/PCEventType';
import Strings from '../utils/Strings';

/** 节点名 `xxx@STRING_KEY`：`xxx` 为本名，`STRING_KEY` 对应 Strings.get 的 id */
const LOCALIZED_NAME_RE = /^(.+)@([A-Za-z0-9_]+)$/;

const LOCALIZED_KEY_PROP = '__localizedStringKey';

export interface LocalizedNodeInfo {
    baseName: string;
    stringKey: string;
}

export function parseLocalizedNodeName(name: string): LocalizedNodeInfo | null {
    const m = LOCALIZED_NAME_RE.exec(name);
    if (!m) {
        return null;
    }
    return { baseName: m[1], stringKey: m[2] };
}

/** 按节点名约定绑定 Label / RichText 文案，并将节点重命名为本名 */
export function bindLocalizedTextOnNode(node: Node): boolean {
    const info = parseLocalizedNodeName(node.name);
    if (!info) {
        return false;
    }

    const label = node.getComponent(Label);
    const richText = label ? null : node.getComponent(RichText);
    if (!label && !richText) {
        return false;
    }

    (node as any)[LOCALIZED_KEY_PROP] = info.stringKey;
    const text = Strings.get(info.stringKey);
    if (label) {
        label.string = text;
    } else if (richText) {
        richText.string = text;
    }

    if (node.name !== info.baseName) {
        node.name = info.baseName;
    }
    return true;
}

function refreshLocalizedTextOnNode(node: Node): void {
    const key = (node as any)[LOCALIZED_KEY_PROP] as string | undefined;
    if (!key) {
        bindLocalizedTextOnNode(node);
        return;
    }

    const label = node.getComponent(Label);
    const richText = label ? null : node.getComponent(RichText);
    if (!label && !richText) {
        return;
    }

    const text = Strings.get(key);
    if (label) {
        label.string = text;
    } else if (richText) {
        richText.string = text;
    }
}

function walkNodeTree(root: Node, visitor: (node: Node) => void): void {
    const stack: Node[] = [root];
    while (stack.length > 0) {
        const node = stack.pop()!;
        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
        }
        visitor(node);
    }
}

/**
 * 运行时自动解析界面树中带 Label / RichText 且命名为 `xxx@STRING_KEY` 的节点。
 */
export class LocalizedTextBinder {
    private static _inited = false;
    private static readonly _roots = new Set<Node>();

    static init(): void {
        if (this._inited) {
            return;
        }
        this._inited = true;

        let dispatcher: EventDispatcher | null = null;
        try {
            dispatcher = Injector.shared.getInstanceOnlyRead('SharedEventDispatcher') as EventDispatcher;
        } catch {
            /* UI 框架尚未初始化 */
        }
        dispatcher?.addEventListener(PCEventType.EVT_LANGUAGE_CHANGED, this._createLanguageListener());
    }

    private static _createLanguageListener(): EventListener {
        const listener = new EventListener();
        listener.fun = () => {
            LocalizedTextBinder._onLanguageChanged();
        };
        listener.beDelete = false;
        listener.callthis = null;
        return listener;
    }

    static bindDeep(root: Node): void {
        if (root == null || !root.isValid) {
            return;
        }
        walkNodeTree(root, bindLocalizedTextOnNode);
        this._trackRoot(root);
    }

    static refreshDeep(root: Node): void {
        if (root == null || !root.isValid) {
            return;
        }
        walkNodeTree(root, refreshLocalizedTextOnNode);
    }

    private static _trackRoot(root: Node): void {
        if (this._roots.has(root)) {
            return;
        }
        this._roots.add(root);
        root.once(NodeEventType.NODE_DESTROYED, () => {
            this._roots.delete(root);
        });
    }

    private static _onLanguageChanged(): void {
        for (const root of this._roots) {
            if (root?.isValid) {
                this.refreshDeep(root);
            } else {
                this._roots.delete(root);
            }
        }
    }
}
