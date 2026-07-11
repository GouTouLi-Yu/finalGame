import { AnimQualityLevel } from '../../../anim/AnimQualityLevel';
import { AnimQualityService } from '../../../anim/AnimQualityService';

/** 拖牌弧光 / 舞台追光按画质档位的绘制预算 */
export interface IAimFxBudget {
    /** 弧光贝塞尔采样段数 */
    sampleSegs: number;
    /** 弧光星尘/碎晶数量（高档刻意堆三角形） */
    dust: number;
    /** 梦雾：每隔几个 dust 画一团 */
    fogStride: number;
    /** 丝带柔光层数 */
    ribbonPasses: number;
    /** 额外闪星爆发数 */
    sparkBurst: number;
    /** 指尖雾层 */
    tipLayers: number;
    /** 指尖碎星环点数 */
    tipRing: number;
    /** 柔光团多边形边数（影响三角形量） */
    blobSteps: number;
    /** 追光粒子 */
    motes: number;
    /** 光带分段 */
    beamSegs: number;
    /** 追光旁雾团数 */
    fogCount: number;
    /** 脚下碎星数 */
    poolStars: number;
    /** 翅膀羽层 1~4 */
    wingFeathers: number;
    /** 闪电折点 */
    zigN: number;
    /** 侧枝步长：2密 / 3中 / 0无 */
    forkStep: number;
    drawDust: boolean;
    drawFog: boolean;
    drawSparks: boolean;
    drawWings: boolean;
    drawPoolDecor: boolean;
}

const BUDGET_HIGH: IAimFxBudget = {
    sampleSegs: 72,
    dust: 180,
    fogStride: 2,
    ribbonPasses: 4,
    sparkBurst: 28,
    tipLayers: 7,
    tipRing: 18,
    blobSteps: 18,
    motes: 120,
    beamSegs: 56,
    fogCount: 32,
    poolStars: 28,
    wingFeathers: 4,
    zigN: 18,
    forkStep: 2,
    drawDust: true,
    drawFog: true,
    drawSparks: true,
    drawWings: true,
    drawPoolDecor: true,
};

const BUDGET_MID: IAimFxBudget = {
    sampleSegs: 40,
    dust: 56,
    fogStride: 2,
    ribbonPasses: 3,
    sparkBurst: 12,
    tipLayers: 5,
    tipRing: 10,
    blobSteps: 12,
    motes: 40,
    beamSegs: 36,
    fogCount: 14,
    poolStars: 12,
    wingFeathers: 3,
    zigN: 11,
    forkStep: 2,
    drawDust: true,
    drawFog: true,
    drawSparks: true,
    drawWings: true,
    drawPoolDecor: true,
};

const BUDGET_LOW: IAimFxBudget = {
    sampleSegs: 20,
    dust: 16,
    fogStride: 4,
    ribbonPasses: 2,
    sparkBurst: 4,
    tipLayers: 3,
    tipRing: 6,
    blobSteps: 8,
    motes: 12,
    beamSegs: 20,
    fogCount: 4,
    poolStars: 0,
    wingFeathers: 2,
    zigN: 7,
    forkStep: 0,
    drawDust: true,
    drawFog: false,
    drawSparks: false,
    drawWings: true,
    drawPoolDecor: false,
};

export function getAimFxBudget(level: AnimQualityLevel = AnimQualityService.getCurrent()): IAimFxBudget {
    if (level === AnimQualityLevel.Low) {
        return BUDGET_LOW;
    }
    if (level === AnimQualityLevel.Mid) {
        return BUDGET_MID;
    }
    return BUDGET_HIGH;
}
