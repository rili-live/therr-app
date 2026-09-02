import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

// Matches the HABITS native bootsplash background (white) so the JS overlay
// hands off from the native splash with no visible color flash.
const BOOTSPLASH_BACKGROUND = '#ffffff';
const LOGO_SIZE = 100;
const SPIN_DURATION_MS = 700;
const FADE_OUT_DURATION_MS = 250;

// Two blinks, timed to fill roughly the same beat the other brands spend spinning.
const BLINK_CLOSE_MS = 100;
const BLINK_HOLD_MS = 60;
const BLINK_OPEN_MS = 120;
/** Eyes-open pause between the two blinks. */
const BLINK_GAP_MS = 120;

// Some brands (e.g. HABITS) use a combined splash logo that bundles the icon
// and the wordmark into a single image. Spinning that image rotates the text
// too, which reads poorly — so we only spin brands whose splash logo is an
// icon on its own. HABITS gets a blink of the chameleon's eyes instead.
const SHOULD_BLINK_LOGO = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

/**
 * Where the chameleon's eyes sit inside `bootsplash_logo.png`, as fractions of the
 * (square) logo box — the image is drawn `contain` into a `LOGO_SIZE` square, so a
 * fraction of the source maps 1:1 onto a fraction of the rendered box.
 *
 * These were measured off the committed artwork rather than off `habits-logo.svg`, whose
 * coordinates do not carry over: the bootsplash logo is the chameleon composited above the
 * wordmark, so it sits higher and smaller in its box than the app icon does.
 * `__tests__/components/splashLogoEyes.test.ts` re-measures the PNG and fails if a
 * regenerated logo moves the eyes out from under these lids.
 *
 * `lidColor` is sampled from the eye socket that rings each eye, so a closed lid reads as
 * the chameleon's own skin — and so the lid's square top corners, which overhang the round
 * sclera, are invisible against the socket they land on.
 */
export const SPLASH_LOGO_EYES = {
    /** Diameter of the white of the eye. A hair wider than measured, to cover its antialiased edge. */
    diameterRatio: 0.12,
    centerYRatio: 0.3475,
    left: { centerXRatio: 0.3438, lidColor: '#65507d' },
    right: { centerXRatio: 0.6563, lidColor: '#746a8b' },
};

const EYE_DIAMETER = LOGO_SIZE * SPLASH_LOGO_EYES.diameterRatio;
const EYE_RADIUS = EYE_DIAMETER / 2;

const eyelidLayout = (centerXRatio: number) => ({
    left: (LOGO_SIZE * centerXRatio) - EYE_RADIUS,
    top: (LOGO_SIZE * SPLASH_LOGO_EYES.centerYRatio) - EYE_RADIUS,
});

/**
 * The lid is a full-eye-sized box pinned to the top of the eye and scaled down to nothing
 * while open. Scaling happens about the box's center, so the translate re-pins its top
 * edge; the result is a lid sweeping down over the eye rather than one growing from its
 * middle. Kept on transforms (rather than an animated `height`) so the blink stays off the
 * layout path on the UI thread.
 */
const eyelidAnimation = (closed: number) => {
    'worklet';

    return {
        // A hairline bottom border on a zero-height lid would still draw a line across an
        // open eye.
        opacity: closed > 0 ? 1 : 0,
        transform: [
            { translateY: -EYE_RADIUS * (1 - closed) },
            { scaleY: closed },
        ],
    };
};

interface ISplashLogoSpinnerProps {
    start: boolean;
    onAnimationComplete: () => void;
}

const SplashLogoSpinner = ({ start, onAnimationComplete }: ISplashLogoSpinnerProps) => {
    const rotation = useSharedValue(0);
    /** 0 = eyes open, 1 = eyes closed. */
    const eyelid = useSharedValue(0);
    const opacity = useSharedValue(1);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (!start) {
            return;
        }

        const finish = () => {
            setHidden(true);
            onAnimationComplete();
        };

        const fadeOut = () => {
            opacity.value = withTiming(
                0,
                { duration: FADE_OUT_DURATION_MS, easing: Easing.out(Easing.quad) },
                (fadeFinished) => {
                    if (fadeFinished) {
                        runOnJS(finish)();
                    }
                },
            );
        };

        if (SHOULD_BLINK_LOGO) {
            const closing = { duration: BLINK_CLOSE_MS, easing: Easing.in(Easing.quad) };
            const opening = { duration: BLINK_OPEN_MS, easing: Easing.out(Easing.quad) };
            // A timing to the value the lid already holds is how a sequence waits.
            const holdClosed = { duration: BLINK_HOLD_MS };
            const holdOpen = { duration: BLINK_GAP_MS };

            eyelid.value = withSequence(
                withTiming(1, closing),
                withTiming(1, holdClosed),
                withTiming(0, opening),
                withTiming(0, holdOpen),
                withTiming(1, closing),
                withTiming(1, holdClosed),
                withTiming(0, opening, (blinkFinished) => {
                    if (blinkFinished) {
                        runOnJS(fadeOut)();
                    }
                }),
            );

            return;
        }

        rotation.value = withTiming(
            360,
            { duration: SPIN_DURATION_MS, easing: Easing.inOut(Easing.quad) },
            (spinFinished) => {
                if (spinFinished) {
                    runOnJS(fadeOut)();
                }
            },
        );
    }, [start, rotation, eyelid, opacity, onAnimationComplete]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    // One animated style per view — reanimated does not support sharing a single one.
    const leftEyelidStyle = useAnimatedStyle(() => eyelidAnimation(eyelid.value));
    const rightEyelidStyle = useAnimatedStyle(() => eyelidAnimation(eyelid.value));

    if (hidden) {
        return null;
    }

    return (
        <Animated.View style={[styles.overlay, overlayStyle]}>
            <View style={styles.logoContainer}>
                <Animated.Image
                    source={require('../assets/bootsplash_logo.png')}
                    style={[styles.logo, logoStyle]}
                    resizeMode="contain"
                />
                {SHOULD_BLINK_LOGO && (
                    <>
                        <Animated.View style={[styles.eyelid, styles.eyelidLeft, leftEyelidStyle]} />
                        <Animated.View style={[styles.eyelid, styles.eyelidRight, rightEyelidStyle]} />
                    </>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: BOOTSPLASH_BACKGROUND,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    logoContainer: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
    },
    eyelid: {
        position: 'absolute',
        width: EYE_DIAMETER,
        height: EYE_DIAMETER,
        borderBottomLeftRadius: EYE_RADIUS,
        borderBottomRightRadius: EYE_RADIUS,
        // Lash line along the lid's edge, in the ink the logo draws its smile and nostrils
        // with. Without it a closed eye reads as a missing eye rather than a shut one — and
        // a hairline is too faint to register at a 12dp eye.
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(46, 33, 64, 0.55)',
    },
    eyelidLeft: {
        ...eyelidLayout(SPLASH_LOGO_EYES.left.centerXRatio),
        backgroundColor: SPLASH_LOGO_EYES.left.lidColor,
    },
    eyelidRight: {
        ...eyelidLayout(SPLASH_LOGO_EYES.right.centerXRatio),
        backgroundColor: SPLASH_LOGO_EYES.right.lidColor,
    },
});

export default SplashLogoSpinner;
