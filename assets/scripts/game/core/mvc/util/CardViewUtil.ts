import { Node } from 'cc';

import { Card } from '../model/card/Card';

import { CardQualityFx } from './CardQualityFx';
import { CardDescKind, CardUtil, ICardConfigRow } from './CardUtil';
import { ElementUtil } from './ElementUtil';

/** Card 预制体子节点名（与 prefab 一致） */
export const CARD_VIEW_NODES = {
    di: 'di',
    quality: 'quality',
    elem1: 'elem1',
    elem2: 'elem2',
    icon: 'icon',
    resonance: 'resonance',
    name: 'name',
    level: 'level2',
    manaPoint: 'manaPoint',
    /** 预制体路径 Layout/weak（非 Card 根下直接子节点） */
    weak: 'Layout/weak',
    desc: 'desc',
} as const;

type CardViewNodeKey = keyof typeof CARD_VIEW_NODES;

export interface ICardViewOptions {
    /** 描述类型；默认 brief（战斗手牌） */
    descKind?: CardDescKind;
}

/** 将 Card 配置与实例数据绑定到 Card 预制体节点 */
export class CardViewUtil {
    /** 克隆模板并绑定卡牌数据（常用于手牌/列表） */
    static instantiate(
        template: Node,
        card: Card,
        options?: { index?: number; namePrefix?: string } & ICardViewOptions,
    ): Node {
        const node = template.clone() as Node;
        node.active = true;
        if (options?.index != null) {
            const prefix = options.namePrefix ?? 'Card';
            node.name = `${prefix}_${options.index + 1}`;
        }
        this.apply(node, card, options);
        return node;
    }

    /** 按 Card 实例刷新整张卡牌 UI（默认简单描述） */
    static apply(cardNode: Node, card: Card, options?: ICardViewOptions): void {
        const cfg = CardUtil.getCfg(card.id);
        if (cfg == null) {
            console.warn(`[CardViewUtil] 未找到卡牌配置: ${card.id}`);
            return;
        }
        this.applyConfig(cardNode, cfg, card.level, options);
    }

    /** 按 cardId + level 刷新（无 Card 实例时使用，如预览/图鉴） */
    static applyById(cardNode: Node, cardId: string, level: number = 1, options?: ICardViewOptions): void {
        const cfg = CardUtil.getCfg(cardId);
        if (cfg == null) {
            console.warn(`[CardViewUtil] 未找到卡牌配置: ${cardId}`);
            return;
        }
        this.applyConfig(cardNode, cfg, level, options);
    }

    private static applyConfig(
        cardNode: Node,
        cfg: ICardConfigRow,
        level: number,
        options?: ICardViewOptions,
    ): void {
        const descKind = options?.descKind ?? 'brief';
        this.setTexture(cardNode, 'di', CardUtil.getQualityBgPath(cfg.quality));
        this.setTexture(cardNode, 'quality', CardUtil.getQualityBadgePath(cfg.quality));
        this.setElement(cardNode, 'elem1', cfg.elem1);
        this.setElement(cardNode, 'elem2', cfg.elem2);
        this.setOptionalTexture(cardNode, 'icon', CardUtil.getIconPath(cfg.iconName));
        this.setVisible(cardNode, 'resonance', CardUtil.isResonance(cfg));
        this.setText(cardNode, 'name', CardUtil.getDisplayName(cfg.id));
        this.setText(cardNode, 'level', String(level));
        this.setText(cardNode, 'manaPoint', String(cfg.manaPoint ?? 0));
        this.setText(cardNode, 'weak', cfg.weak != null ? String(cfg.weak) : '');
        this.setText(cardNode, 'desc', CardUtil.getDisplayDesc(cfg.id, level, descKind));
        CardQualityFx.apply(cardNode, cfg.quality);
    }

    private static part(cardNode: Node, key: CardViewNodeKey): Node | null {
        const segment = CARD_VIEW_NODES[key];
        return cardNode.getChildByPath(segment) ?? cardNode.getChildByName(segment);
    }

    private static setTexture(cardNode: Node, key: CardViewNodeKey, res: string): void {
        this.part(cardNode, key)?.loadTexture(res);
    }

    /** 有资源则显示并加载，无资源则隐藏 */
    private static setOptionalTexture(cardNode: Node, key: CardViewNodeKey, res: string | null): void {
        const node = this.part(cardNode, key);
        if (node == null) {
            return;
        }
        if (!res) {
            node.setVisible(false);
            return;
        }
        node.setVisible(true);
        node.loadTexture(res);
    }

    private static setElement(cardNode: Node, key: 'elem1' | 'elem2', elem: unknown): void {
        const node = this.part(cardNode, key);
        if (node == null) {
            return;
        }
        const element = ElementUtil.parseElement(elem);
        if (element == null) {
            node.setVisible(false);
            return;
        }
        node.setVisible(true);
        node.loadTexture(ElementUtil.getIconPath(element));
    }

    private static setVisible(cardNode: Node, key: CardViewNodeKey, visible: boolean): void {
        this.part(cardNode, key)?.setVisible(visible);
    }

    private static setText(cardNode: Node, key: CardViewNodeKey, text: string): void {
        this.part(cardNode, key)?.setString(text);
    }
}
