export enum AnimQualityLevel {
    High = 'high',
    Mid = 'mid',
    Low = 'low',
}

/** 编辑器 number 档位与运行时画质枚举的对应：0=高档 1=中档 2=低档 */
export const ANIM_QUALITY_LEVEL_NUMBERS: Record<AnimQualityLevel, number> = {
    [AnimQualityLevel.High]: 0,
    [AnimQualityLevel.Mid]: 1,
    [AnimQualityLevel.Low]: 2,
};

export function animQualityLevelToNumber(level: AnimQualityLevel): number {
    return ANIM_QUALITY_LEVEL_NUMBERS[level];
}

export function isAnimQualityLevelNumber(value: number): boolean {
    return value === 0 || value === 1 || value === 2;
}

/** qualityLevel>=1 时，当前画质序号 >= qualityLevel 则隐藏（1=中档及以下，2=仅低档，0=不隐藏） */
export function shouldHideAtQualityLevel(qualityLevel: number, level: AnimQualityLevel): boolean {
    if (qualityLevel <= 0 || !isAnimQualityLevelNumber(qualityLevel)) {
        return false;
    }
    return animQualityLevelToNumber(level) >= qualityLevel;
}

export const ANIM_QUALITY_CYCLE_ORDER: AnimQualityLevel[] = [
    AnimQualityLevel.High,
    AnimQualityLevel.Mid,
    AnimQualityLevel.Low,
];

export const ANIM_QUALITY_CLIP_NAMES: Record<AnimQualityLevel, string> = {
    [AnimQualityLevel.High]: 'animClip',
    [AnimQualityLevel.Mid]: 'animClip_mid',
    [AnimQualityLevel.Low]: 'animClip_low',
};

/**
 * true：三档都播最高档 animClip（抽帧 mid/low 资源与工具链保留，暂不启用）。
 * false：按档位选 animClip / animClip_mid / animClip_low。
 */
export const ANIM_QUALITY_FORCE_HIGH_CLIP = true;

/** 按当前 Animation 已挂载 clip 解析实际应播放的 clip 名 */
export function resolveAnimQualityClipName(
    clipNames: ReadonlyArray<string | undefined>,
    level: AnimQualityLevel,
): string | null {
    if (ANIM_QUALITY_FORCE_HIGH_CLIP) {
        if (clipNames.includes(ANIM_QUALITY_CLIP_NAMES[AnimQualityLevel.High])) {
            return ANIM_QUALITY_CLIP_NAMES[AnimQualityLevel.High];
        }
        if (clipNames.includes('animClip')) {
            return 'animClip';
        }
        return null;
    }

    const preferred = ANIM_QUALITY_CLIP_NAMES[level];
    if (clipNames.includes(preferred)) {
        return preferred;
    }
    // 两档资源：低档回落到中档
    if (level === AnimQualityLevel.Low && clipNames.includes(ANIM_QUALITY_CLIP_NAMES[AnimQualityLevel.Mid])) {
        return ANIM_QUALITY_CLIP_NAMES[AnimQualityLevel.Mid];
    }
    if (clipNames.includes('animClip')) {
        return 'animClip';
    }
    return null;
}

export function isAnimQualityLevel(value: unknown): value is AnimQualityLevel {
    return value === AnimQualityLevel.High
        || value === AnimQualityLevel.Mid
        || value === AnimQualityLevel.Low;
}
