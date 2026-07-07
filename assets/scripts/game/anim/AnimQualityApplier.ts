import { Animation, director, Node } from 'cc';
import { AnimQualityClip } from './AnimQualityClip';
import { AnimQualityLevel, resolveAnimQualityClipName } from './AnimQualityLevel';

function walkNode(node: Node, visit: (node: Node) => void): void {
    visit(node);
    for (const child of node.children) {
        walkNode(child, visit);
    }
}

function hasTierClips(animation: Animation): boolean {
    return animation.clips.some((clip) => clip?.name === 'animClip_mid');
}

function applyLevelToAnimation(animation: Animation, level: AnimQualityLevel): boolean {
    if (!hasTierClips(animation)) {
        return false;
    }

    const clipNames = animation.clips.map((clip) => clip?.name);
    const clipName = resolveAnimQualityClipName(clipNames, level);
    const clip = clipName
        ? animation.clips.find((item) => item?.name === clipName)
        : undefined;
    if (!clip) {
        return false;
    }

    const prevState = animation.defaultClip
        ? animation.getState(animation.defaultClip.name)
        : null;
    const normalizedTime = prevState && prevState.duration > 0
        ? (prevState.time % prevState.duration) / prevState.duration
        : 0;

    animation.stop();
    animation.defaultClip = clip;
    animation.play(clip.name);

    const nextState = animation.getState(clip.name);
    if (nextState && nextState.duration > 0) {
        nextState.time = normalizedTime * nextState.duration;
    }
    return true;
}

export class AnimQualityApplier {
    static refreshAll(level: AnimQualityLevel, root?: Node | null): number {
        const sceneRoot = root ?? director.getScene();
        if (!sceneRoot) {
            return 0;
        }

        let count = 0;
        walkNode(sceneRoot, (node) => {
            const qualityClip = node.getComponent(AnimQualityClip);
            if (qualityClip) {
                qualityClip.applyLevel(level);
                count += 1;
                return;
            }

            const animation = node.getComponent(Animation);
            if (animation && applyLevelToAnimation(animation, level)) {
                count += 1;
            }
        });
        return count;
    }
}
