/** 三档画质（低 / 中 / 高） */
export enum EGraphicsQuality {
    Low = 'low',
    Medium = 'medium',
    High = 'high',
}

/** 各档位相对设计分辨率的比例 */
export const GRAPHICS_QUALITY_SCALE: Readonly<Record<EGraphicsQuality, number>> = {
    [EGraphicsQuality.Low]: 0.6,
    [EGraphicsQuality.Medium]: 0.8,
    [EGraphicsQuality.High]: 1.0,
};

export const GRAPHICS_QUALITY_CYCLE_ORDER: readonly EGraphicsQuality[] = [
    EGraphicsQuality.High,
    EGraphicsQuality.Medium,
    EGraphicsQuality.Low,
];

export const DEFAULT_GRAPHICS_QUALITY = EGraphicsQuality.High;

const QUALITY_SET = new Set<string>([
    EGraphicsQuality.Low,
    EGraphicsQuality.Medium,
    EGraphicsQuality.High,
]);

export function isSupportedGraphicsQuality(value: unknown): value is EGraphicsQuality {
    return typeof value === 'string' && QUALITY_SET.has(value);
}

export function getGraphicsQualityLabel(quality: EGraphicsQuality): string {
    switch (quality) {
        case EGraphicsQuality.Low:
            return '低';
        case EGraphicsQuality.Medium:
            return '中';
        case EGraphicsQuality.High:
            return '高';
        default:
            return quality;
    }
}
