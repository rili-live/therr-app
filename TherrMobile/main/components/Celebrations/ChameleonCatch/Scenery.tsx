import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import {
    BRANCH,
    BURST_RING,
    BRANCH_UNDERSIDE,
    HILL,
    LEAVES,
    Point,
    ROCK,
    SCENE_HEIGHT,
    SCENE_WIDTH,
    SET_BLEED,
    SHARD_BOX,
    SHARD_CORNER,
    SHARD_DISTANCE,
    SHARD_DROP,
    SHARD_SPIN_DEG,
    SHARDS,
    TWIG,
    TWIG_WIDTH,
    VIEW_BOX,
} from './geometry';
import { rigLayerStyle as layer } from './ChameleonRig';
import { IScenePalette } from './palette';
import { leafPath, roundedPolygon } from './rig';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LEAF_PATHS = LEAVES.map(({ base, tip, bulge }) => leafPath(base, tip, bulge));
const ROCK_OUTLINE = roundedPolygon(ROCK.outline, ROCK.outlineRadius);
const ROCK_LIGHT = roundedPolygon(ROCK.lightFacet, ROCK.facetRadius);
const ROCK_DARK = roundedPolygon(ROCK.darkFacet, ROCK.facetRadius);
const SHARD_PATHS = SHARDS.map(({ points }) => roundedPolygon(points, SHARD_CORNER));

/** A four-point glint, `size` from its centre to each point; nothing when `size` is 0. */
const glintPath = (centre: Point, size: number) => {
    'worklet';

    const [x, y] = centre;
    if (size <= 0) {
        return `M ${x} ${y}`;
    }
    return `M ${x} ${y - size} Q ${x} ${y} ${x + size} ${y} Q ${x} ${y} ${x} ${y + size}`
        + ` Q ${x} ${y} ${x - size} ${y} Q ${x} ${y} ${x} ${y - size} Z`;
};

interface IStaticProps {
    palette: IScenePalette;
}

/** The ground the rock sits on. */
export const Hill = React.memo(({ palette }: IStaticProps) => (
    <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX} pointerEvents="none">
        <Path d={HILL} fill={palette.hill} />
    </Svg>
));

/** The brown stick off a tree branch, with a twig and a few leaves. It bleeds off the left edge. */
export const Branch = React.memo(({ palette }: IStaticProps) => (
    <Svg
        style={styles.bleed}
        width={SCENE_WIDTH + SET_BLEED}
        height={SCENE_HEIGHT}
        viewBox={`${-SET_BLEED} 0 ${SCENE_WIDTH + SET_BLEED} ${SCENE_HEIGHT}`}
        pointerEvents="none"
    >
        <Path d={TWIG} stroke={palette.bark} strokeWidth={TWIG_WIDTH} strokeLinecap="round" fill="none" />
        <Path d={BRANCH} fill={palette.bark} />
        <Path d={BRANCH_UNDERSIDE} fill={palette.barkUnderside} />
        {LEAF_PATHS.map((d, index) => (
            <Path key={d} d={d} fill={palette.leaves[index % palette.leaves.length]} />
        ))}
    </Svg>
));

export interface IRockValues {
    /** Degrees, rocking on its base. */
    tilt: SharedValue<number>;
    scale: SharedValue<number>;
    opacity: SharedValue<number>;
    /** 0..1, the crack drawing across it. */
    crack: SharedValue<number>;
    /** 0..1..0, the glint on its light facet. */
    glint: SharedValue<number>;
    /** 0..1, the shards flying off as it bursts. */
    shards: SharedValue<number>;
}

interface IRockProps {
    palette: IScenePalette;
    values: IRockValues;
}

export const Rock = React.memo(({ palette, values }: IRockProps) => {
    const rockStyle = useAnimatedStyle(() => ({
        opacity: values.opacity.value,
        transform: [{ rotate: `${values.tilt.value}deg` }, { scale: values.scale.value }],
    }));
    const crackProps = useAnimatedProps(() => ({
        strokeDashoffset: ROCK.crackLength * (1 - values.crack.value),
        opacity: values.crack.value > 0 ? 1 : 0,
    }));
    const glintProps = useAnimatedProps(() => ({
        d: glintPath(ROCK.glint, ROCK.glintSize * values.glint.value),
    }));

    return (
        <Animated.View
            style={[layer, { transformOrigin: [ROCK.pivot[0], ROCK.pivot[1], 0] }, rockStyle]}
            pointerEvents="none"
        >
            <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX}>
                <Path d={ROCK_OUTLINE} fill={palette.rock} />
                <Path d={ROCK_DARK} fill={palette.rockDark} />
                <Path d={ROCK_LIGHT} fill={palette.rockLight} />
                <AnimatedPath
                    animatedProps={crackProps}
                    d={ROCK.crack}
                    stroke={palette.crack}
                    strokeWidth={ROCK.crackWidth}
                    strokeDasharray={[ROCK.crackLength, ROCK.crackLength]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <AnimatedPath animatedProps={glintProps} fill={palette.eyeWhite} />
            </Svg>
        </Animated.View>
    );
});

interface IShardProps {
    index: number;
    palette: IScenePalette;
    progress: SharedValue<number>;
}

const Shard = ({ index, palette, progress }: IShardProps) => {
    const { from, tone } = SHARDS[index];
    const style = useAnimatedStyle(() => {
        const t = progress.value;
        return {
            opacity: t > 0 && t < 1 ? 1 - t : 0,
            transform: [
                { translateX: from[0] * SHARD_DISTANCE * t },
                { translateY: from[1] * SHARD_DISTANCE * t + SHARD_DROP * t * t },
                { rotate: `${(index % 2 ? 1 : -1) * SHARD_SPIN_DEG * t}deg` },
            ],
        };
    });
    const fill = { base: palette.rock, light: palette.rockLight, dark: palette.rockDark }[tone];

    return (
        <Animated.View
            style={[styles.shard, style]}
            pointerEvents="none"
        >
            <Svg width={SHARD_BOX} height={SHARD_BOX} viewBox={`${-SHARD_BOX / 2} ${-SHARD_BOX / 2} ${SHARD_BOX} ${SHARD_BOX}`}>
                <Path d={SHARD_PATHS[index]} fill={fill} />
            </Svg>
        </Animated.View>
    );
};

/** The rock's last moment: three pieces of it, in its own facet colours. */
export const Shards = React.memo(({ palette, progress }: { palette: IScenePalette; progress: SharedValue<number> }) => (
    <>
        {SHARDS.map((shard, index) => (
            <Shard key={shard.tone} index={index} palette={palette} progress={progress} />
        ))}
    </>
));

/** The impact ring at the burst, on the same 0..1 clock as the shards. */
export const BurstRing = React.memo(({ color, progress }: { color: string; progress: SharedValue<number> }) => {
    const ringProps = useAnimatedProps(() => {
        const t = progress.value;
        const eased = 1 - (1 - t) * (1 - t);
        return {
            r: BURST_RING.fromRadius + (BURST_RING.toRadius - BURST_RING.fromRadius) * eased,
            strokeWidth: BURST_RING.width * (1 - t),
            opacity: t > 0 && t < 1 ? 1 - t : 0,
        };
    });

    return (
        <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX} pointerEvents="none">
            <AnimatedCircle animatedProps={ringProps} cx={ROCK.centre[0]} cy={ROCK.centre[1]} stroke={color} fill="none" />
        </Svg>
    );
});

const styles = StyleSheet.create({
    bleed: {
        position: 'absolute',
        left: -SET_BLEED,
        top: 0,
        width: SCENE_WIDTH + SET_BLEED,
        height: SCENE_HEIGHT,
    },
    // Centred on the rock; each shard's transform carries it outward.
    shard: {
        position: 'absolute',
        left: ROCK.centre[0] - SHARD_BOX / 2,
        top: ROCK.centre[1] - SHARD_BOX / 2,
        width: SHARD_BOX,
        height: SHARD_BOX,
    },
});
