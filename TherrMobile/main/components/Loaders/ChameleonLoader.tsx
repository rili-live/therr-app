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

/**
 * The Friends with Habits loader: the chameleon from the app icon, changing colour
 * and glancing about while it waits.
 *
 * Two properties matter here, and they are the same two `BrandedMediaPlaceholder`
 * is built on:
 *
 * 1. **The drawing is the logo's own geometry** (`assets/habits-logo.svg`, minus its
 *    white tile), so the loader, the icon and the landing page are one chameleon.
 * 2. **Every colour comes from the active theme**, so no baked Lottie has to be
 *    re-exported when the palette moves, and the colour cycle is literally the
 *    brand palette — brand purple to teal to lime and back.
 *
 * The Lottie loaders this stands in for on the Habits app were Therr's: a spinning
 * globe, a taco, a sports car. Fine for a local-discovery app, off-brand for a
 * habit tracker with a mascot.
 */

/** The logo's 1024-unit canvas, cropped to the face. */
const VIEW_BOX = '150 200 724 580';
const VIEW_BOX_ASPECT = 580 / 724;

const LEFT_PUPIL = { cx: 280, cy: 517 };
const RIGHT_PUPIL = { cx: 744, cy: 517 };
/** The pupil highlight sits up and to the right of the pupil in the logo. */
const HIGHLIGHT_OFFSET = { dx: 14, dy: -13 };
const PUPIL_RADIUS = 44;

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

    const gaze = (base: { cx: number; cy: number }, offset = { dx: 0, dy: 0 }) => () => ({
        cx: base.cx + offset.dx + interpolate(look.value, GAZE_STOPS, GAZE_DX),
        cy: base.cy + offset.dy + interpolate(look.value, GAZE_STOPS, GAZE_DY),
    });
    const leftPupilProps = useAnimatedProps(gaze(LEFT_PUPIL));
    const rightPupilProps = useAnimatedProps(gaze(RIGHT_PUPIL));
    const leftHighlightProps = useAnimatedProps(gaze(LEFT_PUPIL, HIGHLIGHT_OFFSET));
    const rightHighlightProps = useAnimatedProps(gaze(RIGHT_PUPIL, HIGHLIGHT_OFFSET));

    return (
        <View style={[styles.frame, { width: size, height: size * VIEW_BOX_ASPECT }]} testID={testID}>
            <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
                {/* Head */}
                <AnimatedPath
                    animatedProps={skinProps}
                    d="M 437 335 Q 512 205 587 335 Q 722 482 757 629 Q 832 759 682 759 Q 512 779 342 759 Q 192 759 267 629 Q 302 482 437 335 Z"
                />
                {/* Forehead stripe */}
                <Path
                    d="M 494 325 Q 494 305 512 305 Q 530 305 530 325 L 525 477 Q 525 493 512 493 Q 499 493 499 477 Z"
                    fill={colors.accent}
                />
                {/* Left eye */}
                <AnimatedCircle animatedProps={leftSocketProps} cx="260" cy="510" r="148" />
                <Circle cx="260" cy="510" r="95" fill={colors.brandingWhite} />
                <AnimatedCircle animatedProps={leftPupilProps} r={PUPIL_RADIUS} fill={colors.brandingBlack} />
                <AnimatedCircle animatedProps={leftHighlightProps} r="15" fill={colors.brandingWhite} />
                {/* Right eye */}
                <AnimatedCircle animatedProps={rightSocketProps} cx="764" cy="510" r="148" />
                <Circle cx="764" cy="510" r="95" fill={colors.brandingWhite} />
                <AnimatedCircle animatedProps={rightPupilProps} r={PUPIL_RADIUS} fill={colors.brandingBlack} />
                <AnimatedCircle animatedProps={rightHighlightProps} r="15" fill={colors.brandingWhite} />
                {/* Nostrils and smile */}
                <Circle cx="488" cy="653" r="11" fill={colors.brandingBlack} opacity={0.62} />
                <Circle cx="536" cy="653" r="11" fill={colors.brandingBlack} opacity={0.62} />
                <Path
                    d="M 418 718 Q 512 762 606 718"
                    stroke={colors.brandingBlack}
                    strokeWidth={12}
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
