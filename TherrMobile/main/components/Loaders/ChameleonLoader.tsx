import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    interpolate,
    interpolateColor,
    ReduceMotion,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { ITherrThemeColors } from '../../styles/themes';
import {
    EYE_SOCKET_RADIUS,
    EYE_WHITE_RADIUS,
    FACE_ASPECT,
    FACE_VIEW_BOX,
    HEAD_PATH,
    HIGHLIGHT_OFFSET,
    HIGHLIGHT_RADIUS,
    LEFT_EYE,
    LEFT_PUPIL,
    NOSTRIL_OPACITY,
    NOSTRIL_RADIUS,
    NOSTRILS,
    PUPIL_RADIUS,
    RIGHT_EYE,
    RIGHT_PUPIL,
    SMILE_PATH,
    SMILE_STROKE_WIDTH,
    STRIPE_PATH,
} from '../Chameleon/geometry';

/**
 * The Friends with Habits loader: the chameleon from the app icon, changing colour
 * and glancing about while it waits.
 *
 * Two properties matter here, and they are the same two `BrandedMediaPlaceholder`
 * is built on:
 *
 * 1. **The drawing is the logo's own geometry** (`components/Chameleon/geometry`, the
 *    one copy every in-app chameleon shares), so the loader, the icon and the
 *    landing page are one chameleon. The still version is `ChameleonFace`.
 * 2. **Every colour comes from the active theme**, so no baked Lottie has to be
 *    re-exported when the palette moves, and the colour cycle is literally the
 *    brand palette — brand purple to teal to lime and back.
 *
 * The Lottie loaders this stands in for on the Habits app were Therr's: a spinning
 * globe, a taco, a sports car. Fine for a local-discovery app, off-brand for a
 * habit tracker with a mascot.
 */

/**
 * Where the eyes look, in logo units, as the gaze keyframes `look` walks through:
 * ahead, to the viewer's left, to the right, up, and back ahead.
 */
const GAZE_STOPS = [0, 1, 2, 3, 4];
const GAZE_DX = [0, -24, 24, 0, 0];
const GAZE_DY = [0, -4, -4, -18, 0];

const GLANCE_MS = 380;
const HOLD_MS = 720;
const COLOUR_CYCLE_MS = 4800;

const NO_OFFSET = { dx: 0, dy: 0 };

/**
 * Where a pupil (or its highlight) sits for the current gaze keyframe. Runs on the UI
 * runtime — hence the directive — so it is a plain function of its arguments and the
 * module-level gaze tables, never of anything held by the component.
 */
export const gazeAt = (
    base: { cx: number; cy: number },
    offset: { dx: number; dy: number },
    lookValue: number,
): { cx: number; cy: number } => {
    'worklet';

    return {
        cx: base.cx + offset.dx + interpolate(lookValue, GAZE_STOPS, GAZE_DX),
        cy: base.cy + offset.dy + interpolate(lookValue, GAZE_STOPS, GAZE_DY),
    };
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface IChameleonLoaderProps {
    /** Rendered width in dp. Height follows the logo's aspect. */
    size?: number;
    /** Multiplier on the animation tempo, matching the `speed` prop of the Lottie loaders. */
    speed?: number;
    theme: {
        colors: ITherrThemeColors;
    };
    testID?: string;
}

const ChameleonLoader = ({
    size = 100,
    speed = 1,
    theme,
    testID = 'chameleon-loader',
}: IChameleonLoaderProps) => {
    const { colors } = theme;
    /** 0..1, one lap through the colour cycle. */
    const hue = useSharedValue(0);
    /** Index into GAZE_STOPS, tweened between stops so the pupils slide rather than jump. */
    const look = useSharedValue(0);

    useEffect(() => {
        // `ReduceMotion.System` parks both animations at their end value when the OS
        // reduce-motion setting is on, so the loader still reads as the chameleon —
        // just a still one.
        const tempo = speed > 0 ? speed : 1;
        const linear = { easing: Easing.linear, reduceMotion: ReduceMotion.System };
        const glance = { duration: GLANCE_MS / tempo, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System };
        // A timing to the value already held is how a sequence pauses.
        const hold = { duration: HOLD_MS / tempo, reduceMotion: ReduceMotion.System };

        hue.value = withRepeat(withTiming(1, { ...linear, duration: COLOUR_CYCLE_MS / tempo }), -1, false);
        look.value = withRepeat(withSequence(
            withTiming(1, glance), withTiming(1, hold),
            withTiming(2, glance), withTiming(2, hold),
            withTiming(3, glance), withTiming(3, hold),
            withTiming(4, glance), withTiming(4, hold),
        ), -1, false);

        return () => {
            cancelAnimation(hue);
            cancelAnimation(look);
        };
    }, [hue, look, speed]);

    const skinProps = useAnimatedProps(() => ({
        fill: interpolateColor(
            hue.value,
            [0, 0.25, 0.5, 0.75, 1],
            [colors.brand, colors.accentTeal, colors.accentLime, colors.brandDark, colors.brand],
        ),
    }));
    // One animated-props object per element: reanimated does not share them.
    const leftSocketProps = useAnimatedProps(() => ({
        fill: interpolateColor(
            hue.value,
            [0, 0.25, 0.5, 0.75, 1],
            [colors.brand, colors.accentTeal, colors.accentLime, colors.brandDark, colors.brand],
        ),
    }));
    const rightSocketProps = useAnimatedProps(() => ({
        fill: interpolateColor(
            hue.value,
            [0, 0.25, 0.5, 0.75, 1],
            [colors.brand, colors.accentTeal, colors.accentLime, colors.brandDark, colors.brand],
        ),
    }));

    // Each callback is written inline so the worklets babel plugin sees it as the
    // argument of useAnimatedProps and compiles it for the UI runtime. A factory that
    // *returned* the callback (the previous shape) produced a plain JS function, and
    // the UI runtime's first frame threw "Tried to synchronously call a Remote
    // Function" — a fatal crash on every Habits screen that shows a loader.
    const leftPupilProps = useAnimatedProps(() => gazeAt(LEFT_PUPIL, NO_OFFSET, look.value));
    const rightPupilProps = useAnimatedProps(() => gazeAt(RIGHT_PUPIL, NO_OFFSET, look.value));
    const leftHighlightProps = useAnimatedProps(() => gazeAt(LEFT_PUPIL, HIGHLIGHT_OFFSET, look.value));
    const rightHighlightProps = useAnimatedProps(() => gazeAt(RIGHT_PUPIL, HIGHLIGHT_OFFSET, look.value));

    return (
        <View style={[styles.frame, { width: size, height: size * FACE_ASPECT }]} testID={testID}>
            <Svg width="100%" height="100%" viewBox={FACE_VIEW_BOX}>
                {/* Head */}
                <AnimatedPath animatedProps={skinProps} d={HEAD_PATH} />
                {/* Forehead stripe */}
                <Path d={STRIPE_PATH} fill={colors.accent} />
                {/* Left eye */}
                <AnimatedCircle animatedProps={leftSocketProps} cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={EYE_SOCKET_RADIUS} />
                <Circle cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={EYE_WHITE_RADIUS} fill={colors.brandingWhite} />
                <AnimatedCircle animatedProps={leftPupilProps} r={PUPIL_RADIUS} fill={colors.brandingBlack} />
                <AnimatedCircle animatedProps={leftHighlightProps} r={HIGHLIGHT_RADIUS} fill={colors.brandingWhite} />
                {/* Right eye */}
                <AnimatedCircle animatedProps={rightSocketProps} cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={EYE_SOCKET_RADIUS} />
                <Circle cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={EYE_WHITE_RADIUS} fill={colors.brandingWhite} />
                <AnimatedCircle animatedProps={rightPupilProps} r={PUPIL_RADIUS} fill={colors.brandingBlack} />
                <AnimatedCircle animatedProps={rightHighlightProps} r={HIGHLIGHT_RADIUS} fill={colors.brandingWhite} />
                {/* Nostrils and smile */}
                {NOSTRILS.map((nostril) => (
                    <Circle
                        key={nostril.cx}
                        cx={nostril.cx}
                        cy={nostril.cy}
                        r={NOSTRIL_RADIUS}
                        fill={colors.brandingBlack}
                        opacity={NOSTRIL_OPACITY}
                    />
                ))}
                <Path
                    d={SMILE_PATH}
                    stroke={colors.brandingBlack}
                    strokeWidth={SMILE_STROKE_WIDTH}
                    strokeLinecap="round"
                    fill="none"
                />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    frame: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ChameleonLoader;
