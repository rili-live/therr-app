import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    interpolateColor,
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import {
    BODY_PIVOT,
    CASQUE_RIDGE,
    EYE,
    HEAD,
    HEAD_ORIGIN,
    ILimb,
    LINE_OPACITY,
    LINE_WIDTH,
    MOUTH,
    MOUTH_LINE,
    MOUTH_OPEN,
    NOSTRIL,
    NOSTRIL_OPACITY,
    NOSTRIL_RADIUS,
    Point,
    SCENE_HEIGHT,
    SCENE_WIDTH,
    TAIL,
    TONGUE,
    VIEW_BOX,
} from './geometry';
import {
    BREATH_SCALE_X,
    BREATH_SCALE_Y,
    RISE_SCALE,
    SQUASH_WIDEN,
} from './motion';
import { IScenePalette, SKIN_STOPS } from './palette';
import {
    bodyPath,
    closedSpline,
    limbsPath,
    openSpline,
    stripePath,
    toesPath,
    tongueShape,
} from './rig';

/**
 * The chameleon's animated layers. Every value that moves is a shared value owned by
 * `ChameleonCatch`; these components only read them, on the UI thread.
 */
export interface IRigValues {
    /** 0 purple, 1 teal, 2 lime, 3 gold — fractional while a colour blends. */
    skin: SharedValue<number>;
    /** 0..1, one breath. */
    breath: SharedValue<number>;
    /** −1..1, the tail coil loosening and tightening. */
    coil: SharedValue<number>;
    /** Share of the body's height lost to the anticipation squash. */
    squash: SharedValue<number>;
    /** 0..1, the body rising on its legs in the triumph. */
    rise: SharedValue<number>;
    /** Head offset along x: negative pulls back, positive snaps forward. */
    headX: SharedValue<number>;
    /** Head tilt, in degrees. */
    tilt: SharedValue<number>;
    /** Share of the mouth-to-rock gap the tongue covers. */
    reach: SharedValue<number>;
    /** 0..1, the tongue tip flattening on the rock. */
    contact: SharedValue<number>;
    /** 0..1, the lid closing. */
    blink: SharedValue<number>;
    gazeX: SharedValue<number>;
    gazeY: SharedValue<number>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HEAD_PATH = closedSpline(HEAD);
const RIDGE_PATH = openSpline(CASQUE_RIDGE);
const MOUTH_LINE_PATH = openSpline(MOUTH_LINE);
const STRIPE_PATH = stripePath();
/** The ridge and lid ring are drawn in ink at low opacity, so they suit every skin colour. */
const DETAIL_OPACITY = 0.2;

/** The body's scale about its pivot: breathing, the anticipation squash and the triumphant rise. */
export const getBodyScale = (breath: number, squash: number, rise: number): [number, number] => {
    'worklet';

    return [
        1 + breath * BREATH_SCALE_X + squash * SQUASH_WIDEN - rise * RISE_SCALE * SQUASH_WIDEN,
        1 + breath * BREATH_SCALE_Y - squash + rise * RISE_SCALE,
    ];
};

/** Where the aperture points, kept inside the turret. */
const clampGaze = (x: number, y: number): Point => {
    'worklet';

    const length = Math.hypot(x, y);
    const share = length > EYE.maxSwivel ? EYE.maxSwivel / length : 1;
    return [x * share, y * share];
};

/**
 * The tongue in the body's frame (it is drawn inside the body's transform, under the head):
 * the mouth is carried through the head's own offset and tilt, and the rock is brought in
 * through the inverse of the body's scale, so the tip still lands on the rock face.
 */
const tongueInBodyFrame = (values: IRigValues) => {
    'worklet';

    const [scaleX, scaleY] = getBodyScale(values.breath.value, values.squash.value, values.rise.value);
    const angle = (values.tilt.value * Math.PI) / 180;
    const dx = MOUTH[0] - HEAD_ORIGIN[0];
    const dy = MOUTH[1] - HEAD_ORIGIN[1];
    const mouth: Point = [
        HEAD_ORIGIN[0] + dx * Math.cos(angle) - dy * Math.sin(angle) + values.headX.value,
        HEAD_ORIGIN[1] + dx * Math.sin(angle) + dy * Math.cos(angle),
    ];
    const target: Point = [
        BODY_PIVOT[0] + (TONGUE.target[0] - BODY_PIVOT[0]) / scaleX,
        BODY_PIVOT[1] + (TONGUE.target[1] - BODY_PIVOT[1]) / scaleY,
    ];
    return tongueShape(mouth, target, values.reach.value);
};

/** An ellipse as a path, for the tongue tip (circles cannot squash). */
const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
    'worklet';

    if (rx <= 0 || ry <= 0) {
        return `M ${cx} ${cy}`;
    }
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
};

const styles = StyleSheet.create({
    /** Every layer is the full scene, stacked, so all of them share one coordinate space. */
    layer: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
    },
});
const { layer } = styles;

interface ILimbsProps {
    limbs: ILimb[];
    width: number;
    colors: string[];
    values: IRigValues;
}

/**
 * One side's legs. The roots ride on the body; the feet stay on the stick, so they are drawn
 * outside the body's transform.
 */
export const ChameleonLimbs = React.memo(({
    limbs, width, colors, values,
}: ILimbsProps) => {
    const toes = React.useMemo(() => toesPath(limbs), [limbs]);
    const legProps = useAnimatedProps(() => {
        const [scaleX, scaleY] = getBodyScale(values.breath.value, values.squash.value, values.rise.value);
        return {
            d: limbsPath(limbs, scaleX, scaleY),
            stroke: interpolateColor(values.skin.value, SKIN_STOPS, colors, 'HSV'),
        };
    });
    const toeProps = useAnimatedProps(() => ({
        fill: interpolateColor(values.skin.value, SKIN_STOPS, colors, 'HSV'),
    }));

    return (
        <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX} pointerEvents="none">
            <AnimatedPath
                animatedProps={legProps}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            <AnimatedPath animatedProps={toeProps} d={toes} />
        </Svg>
    );
});

interface IChameleonBodyProps {
    palette: IScenePalette;
    values: IRigValues;
}

/** The body, tail, stripe, tongue and head, scaling together from the feet. */
export const ChameleonBody = React.memo(({ palette, values }: IChameleonBodyProps) => {
    const frameStyle = useAnimatedStyle(() => {
        const [scaleX, scaleY] = getBodyScale(values.breath.value, values.squash.value, values.rise.value);
        return { transform: [{ scaleX }, { scaleY }] };
    });
    const headStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: values.headX.value }, { rotate: `${values.tilt.value}deg` }],
    }));

    const bodyProps = useAnimatedProps(() => ({
        d: bodyPath(1 + values.coil.value * TAIL.breathe),
        fill: interpolateColor(values.skin.value, SKIN_STOPS, palette.skins, 'HSV'),
    }));
    const stripeProps = useAnimatedProps(() => ({
        fill: interpolateColor(values.skin.value, SKIN_STOPS, palette.stripes, 'HSV'),
    }));
    const headProps = useAnimatedProps(() => ({
        fill: interpolateColor(values.skin.value, SKIN_STOPS, palette.skins, 'HSV'),
    }));
    const turretProps = useAnimatedProps(() => ({
        fill: interpolateColor(values.skin.value, SKIN_STOPS, palette.turrets, 'HSV'),
    }));

    const tongueProps = useAnimatedProps(() => ({
        d: tongueInBodyFrame(values).d,
    }));
    const tipProps = useAnimatedProps(() => {
        const tongue = tongueInBodyFrame(values);
        const squashX = 1 - (1 - TONGUE.contactSquash) * values.contact.value;
        return { d: ellipse(tongue.tipX, tongue.tipY, tongue.tipRadius * squashX, tongue.tipRadius) };
    });
    const mouthOpenProps = useAnimatedProps(() => ({
        opacity: Math.min(1, Math.max(0, values.reach.value) / TONGUE.tipFadeReach),
    }));

    const ringProps = useAnimatedProps(() => {
        const [x, y] = clampGaze(values.gazeX.value, values.gazeY.value);
        return { cx: EYE.center[0] + x * EYE.ringFollow, cy: EYE.center[1] + y * EYE.ringFollow };
    });
    const apertureProps = useAnimatedProps(() => {
        const [x, y] = clampGaze(values.gazeX.value, values.gazeY.value);
        return {
            cx: EYE.center[0] + x,
            cy: EYE.center[1] + y,
            r: EYE.turretRadius * EYE.apertureRadius * (1 - values.blink.value),
        };
    });
    const pupilProps = useAnimatedProps(() => {
        const [x, y] = clampGaze(values.gazeX.value, values.gazeY.value);
        return {
            cx: EYE.center[0] + x + EYE.pupilLead,
            cy: EYE.center[1] + y,
            r: EYE.turretRadius * EYE.pupilRadius * (1 - values.blink.value),
        };
    });
    const highlightProps = useAnimatedProps(() => {
        const [x, y] = clampGaze(values.gazeX.value, values.gazeY.value);
        const pupil = EYE.turretRadius * EYE.pupilRadius;
        return {
            cx: EYE.center[0] + x + EYE.pupilLead + pupil * EYE.highlight[0],
            cy: EYE.center[1] + y + pupil * EYE.highlight[1],
            r: EYE.turretRadius * EYE.highlightRadius * (1 - values.blink.value),
        };
    });
    // The cone lid closes to a slit around the pupil, the way a chameleon's does.
    const slitProps = useAnimatedProps(() => {
        const [x, y] = clampGaze(values.gazeX.value, values.gazeY.value);
        const half = EYE.turretRadius * EYE.apertureRadius;
        const cx = EYE.center[0] + x;
        const cy = EYE.center[1] + y;
        return {
            d: `M ${cx - half} ${cy} Q ${cx} ${cy + half * 0.4} ${cx + half} ${cy}`,
            opacity: Math.min(1, Math.max(0, (values.blink.value - 0.6) / 0.4)),
        };
    });

    return (
        <Animated.View
            style={[layer, { transformOrigin: [BODY_PIVOT[0], BODY_PIVOT[1], 0] }, frameStyle]}
            pointerEvents="none"
        >
            <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX}>
                <AnimatedPath animatedProps={bodyProps} />
                <AnimatedPath animatedProps={stripeProps} d={STRIPE_PATH} />
            </Svg>
            <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX}>
                <AnimatedPath
                    animatedProps={tongueProps}
                    stroke={palette.tongue}
                    strokeWidth={TONGUE.width}
                    strokeLinecap="round"
                    fill="none"
                />
                <AnimatedPath animatedProps={tipProps} fill={palette.tongue} />
            </Svg>
            <Animated.View style={[layer, { transformOrigin: [HEAD_ORIGIN[0], HEAD_ORIGIN[1], 0] }, headStyle]}>
                <Svg style={layer} width={SCENE_WIDTH} height={SCENE_HEIGHT} viewBox={VIEW_BOX}>
                    <AnimatedPath animatedProps={headProps} d={HEAD_PATH} />
                    <Path
                        d={RIDGE_PATH}
                        stroke={palette.ink}
                        strokeOpacity={DETAIL_OPACITY}
                        strokeWidth={EYE.ringWidth}
                        strokeLinecap="round"
                        fill="none"
                    />
                    <AnimatedCircle animatedProps={turretProps} cx={EYE.center[0]} cy={EYE.center[1]} r={EYE.turretRadius} />
                    <AnimatedCircle
                        animatedProps={ringProps}
                        r={EYE.turretRadius * EYE.ringRadius}
                        stroke={palette.ink}
                        strokeOpacity={DETAIL_OPACITY}
                        strokeWidth={EYE.ringWidth}
                        fill="none"
                    />
                    <AnimatedCircle animatedProps={apertureProps} fill={palette.eyeWhite} />
                    <AnimatedCircle animatedProps={pupilProps} fill={palette.ink} />
                    <AnimatedCircle animatedProps={highlightProps} fill={palette.eyeWhite} />
                    <AnimatedPath
                        animatedProps={slitProps}
                        stroke={palette.ink}
                        strokeWidth={LINE_WIDTH}
                        strokeLinecap="round"
                        fill="none"
                    />
                    <Circle
                        cx={NOSTRIL[0]}
                        cy={NOSTRIL[1]}
                        r={NOSTRIL_RADIUS}
                        fill={palette.ink}
                        opacity={NOSTRIL_OPACITY}
                    />
                    <AnimatedPath animatedProps={mouthOpenProps} d={MOUTH_OPEN} fill={palette.ink} />
                    <Path
                        d={MOUTH_LINE_PATH}
                        stroke={palette.ink}
                        strokeOpacity={LINE_OPACITY}
                        strokeWidth={LINE_WIDTH}
                        strokeLinecap="round"
                        fill="none"
                    />
                </Svg>
            </Animated.View>
        </Animated.View>
    );
});

export const rigLayerStyle = layer;
