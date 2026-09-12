import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ImageSourcePropType,
    Platform,
    StyleSheet,
    TurboModuleRegistry,
    View,
} from 'react-native';
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
const SPIN_DURATION_MS = 700;
const FADE_OUT_DURATION_MS = 250;

// Two blinks, timed to fill roughly the same beat the other brands spend spinning.
const BLINK_CLOSE_MS = 100;
const BLINK_HOLD_MS = 60;
const BLINK_OPEN_MS = 120;
/** Eyes-open pause between the two blinks. */
const BLINK_GAP_MS = 120;

/** Every leg of the two-blink sequence, in the order `withSequence` runs them. */
const BLINK_SEQUENCE_MS = BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS + BLINK_GAP_MS
    + BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS;

// Some brands (e.g. HABITS) use a combined splash logo that bundles the icon
// and the wordmark into a single image. Spinning that image rotates the text
// too, which reads poorly — so we only spin brands whose splash logo is an
// icon on its own. HABITS gets a blink of the chameleon's eyes instead.
const SHOULD_BLINK_LOGO = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

/**
 * How long the overlay may legitimately stay up, and the grace on top of it before the
 * failsafe fires.
 *
 * This overlay is `absoluteFill` at `zIndex: 9999` over the whole NavigationContainer, and
 * the only thing that takes it down is a reanimated completion callback. Those callbacks run
 * with `finished: false` when an animation is interrupted rather than completed — and on that
 * path nothing calls `fadeOut`, nothing calls `finish`, and the app is left under an opaque
 * brand-colored sheet until the user force-kills it. The window is short (~1s) but it sits on
 * the cold-start path, where a stuck frame is indistinguishable from a crash.
 *
 * Derived rather than hardcoded so retiming the blink cannot leave the failsafe firing mid-
 * animation. The grace is deliberately large relative to the budget: this exists to bound a
 * hang, not to race a slow-but-working animation on a cold JS thread.
 */
const ANIMATION_BUDGET_MS = (SHOULD_BLINK_LOGO ? BLINK_SEQUENCE_MS : SPIN_DURATION_MS) + FADE_OUT_DURATION_MS;
const FAILSAFE_GRACE_MS = 3000;
export const SPLASH_FAILSAFE_MS = ANIMATION_BUDGET_MS + FAILSAFE_GRACE_MS;

/** What `assets/bootsplash/manifest.json` and `ios/Therr/BootSplash.storyboard` size the logo at. */
const MANIFEST_LOGO_SIZE = 100;

/**
 * The canvas Android hands a splash logo, per Google's splash-screen dimensions — and the size
 * react-native-bootsplash's generator composites its Android drawables onto.
 *
 * Exported for `__tests__/components/splashLogoEyes.test.ts`, which holds the committed
 * drawables to it.
 */
export const ANDROID_SPLASH_CANVAS_SIZE = 288;

/**
 * The size the *native* splash drew the logo at. The overlay has to redraw it at exactly that
 * size or the logo visibly jumps the moment the overlay takes over.
 *
 * iOS draws `BootSplash.storyboard`, whose image view is pinned to the manifest's 100dp.
 *
 * Android is the reason this is not simply the manifest size. The platform renders
 * `windowSplashScreenAnimatedIcon` in a 288dp canvas (pre-12, the compat layer draws the same
 * drawable centered at its intrinsic density size — 288dp again), and HABITS' per-density
 * `bootsplash_logo` drawables are artwork filling that whole canvas rather than a 100dp logo
 * centered inside one, which is what the generator would have produced. So on Android this
 * brand's splash logo lands at 288dp — 2.88x the size the overlay used to redraw it at.
 *
 * Scoped to the brand rather than to Android, because it is a property of these hand-made HABITS
 * assets: a brand whose drawables came out of the generator still draws at the manifest size.
 */
const DRAWS_ANDROID_SPLASH_CANVAS = SHOULD_BLINK_LOGO && Platform.OS === 'android';

/**
 * `logoSizeRatio` is Samsung One UI 4's half-size splash icon — see `getNativeLogoSizeRatio`.
 *
 * Exported (with the platform passed in rather than read) so
 * `__tests__/components/splashLogoEyes.test.ts` can hold both platforms to the size their native
 * splash actually draws, which is the whole point of this file's sizing.
 */
export const splashLogoSize = (platformOS: string, logoSizeRatio: number): number => (
    (SHOULD_BLINK_LOGO && platformOS === 'android' ? ANDROID_SPLASH_CANVAS_SIZE : MANIFEST_LOGO_SIZE)
    * logoSizeRatio
);

/**
 * On Android, draw the very drawable the native splash drew, addressed by resource name. The
 * bundled JS copy tops out at 400px — fine for a 100dp box, a 2.9x upscale in a 288dp one —
 * whereas the drawable set carries the density the system already picked (864px at xxhdpi).
 * Falls back to the JS copy if the resource cannot be resolved, which would otherwise leave the
 * eyelids blinking over nothing.
 */
const BUNDLED_LOGO_SOURCE = require('../assets/bootsplash_logo.png');
const NATIVE_LOGO_SOURCE: ImageSourcePropType = DRAWS_ANDROID_SPLASH_CANVAS
    ? { uri: 'bootsplash_logo' }
    : BUNDLED_LOGO_SOURCE;

/**
 * Samsung's One UI 4 draws the splash icon at half size. react-native-bootsplash reports that as
 * `logoSizeRatio` and scales its own hide-animation replica by it, but only exposes it through a
 * hook that would also take over hiding the splash — which `Layout` owns. So read the same
 * constant off the same native module. `TurboModuleRegistry.get` returns null instead of throwing
 * when the module is absent (Jest, web), and the ratio is optional, so both fall back to 1.
 */
const getNativeLogoSizeRatio = (): number => {
    try {
        const bootSplashModule = TurboModuleRegistry
            .get('RNBootSplash') as unknown as { getConstants: () => { logoSizeRatio?: number } } | null;
        const ratio = bootSplashModule?.getConstants().logoSizeRatio;

        return typeof ratio === 'number' && ratio > 0 ? ratio : 1;
    } catch {
        return 1;
    }
};

/**
 * Where the chameleon's eyes sit inside `bootsplash_logo.png`, as fractions of the (square)
 * logo box — the image is drawn `contain` into a square, so a fraction of the source maps 1:1
 * onto a fraction of the rendered box whatever size that box is. Both bitmaps the overlay can
 * draw (the bundled JS copy and the Android drawable) frame the artwork identically, so one set
 * of fractions covers both.
 *
 * These were measured off the committed artwork rather than off `habits-logo.svg`, whose
 * coordinates do not carry over: the bootsplash logo is the chameleon composited above the
 * wordmark, so it sits higher and smaller in its box than the app icon does.
 * `__tests__/components/splashLogoEyes.test.ts` re-measures both PNGs and fails if a
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

/** Lash-line weight, as a fraction of the logo box: 1dp at a 100dp logo, and proportional above. */
const LASH_WIDTH_RATIO = 0.01;
/** The ink the logo draws its smile and nostrils with. */
const LASH_COLOR = 'rgba(46, 33, 64, 0.55)';

/**
 * Everything is derived from the logo box rather than hard-coded in dp, because that box is
 * 100dp on iOS and 288dp on Android — see `NATIVE_LOGO_SIZE`.
 */
const buildLayout = (logoSize: number) => {
    const eyeDiameter = logoSize * SPLASH_LOGO_EYES.diameterRatio;
    const eyeRadius = eyeDiameter / 2;

    const eyelid = (eye: { centerXRatio: number; lidColor: string }) => ({
        position: 'absolute' as const,
        left: (logoSize * eye.centerXRatio) - eyeRadius,
        top: (logoSize * SPLASH_LOGO_EYES.centerYRatio) - eyeRadius,
        width: eyeDiameter,
        height: eyeDiameter,
        borderBottomLeftRadius: eyeRadius,
        borderBottomRightRadius: eyeRadius,
        // Lash line along the lid's edge. Without it a closed eye reads as a missing eye — and a
        // hairline is too faint to register at a 12dp eye.
        borderBottomWidth: Math.max(StyleSheet.hairlineWidth, logoSize * LASH_WIDTH_RATIO),
        borderBottomColor: LASH_COLOR,
        backgroundColor: eye.lidColor,
    });

    return {
        logo: { width: logoSize, height: logoSize },
        eyeRadius,
        leftEyelid: eyelid(SPLASH_LOGO_EYES.left),
        rightEyelid: eyelid(SPLASH_LOGO_EYES.right),
    };
};

/**
 * The lid is a full-eye-sized box pinned to the top of the eye and scaled down to nothing
 * while open. Scaling happens about the box's center, so the translate re-pins its top
 * edge; the result is a lid sweeping down over the eye rather than one growing from its
 * middle. Kept on transforms (rather than an animated `height`) so the blink stays off the
 * layout path on the UI thread.
 */
const eyelidAnimation = (closed: number, eyeRadius: number) => {
    'worklet';

    return {
        // A bottom border on a zero-height lid would still draw a line across an open eye.
        opacity: closed > 0 ? 1 : 0,
        transform: [
            { translateY: -eyeRadius * (1 - closed) },
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
    /** Guards the race between the animation's completion callback and the failsafe timer. */
    const hasFinishedRef = useRef(false);
    const [logoSource, setLogoSource] = useState(NATIVE_LOGO_SOURCE);
    // Read once on mount, as react-native-bootsplash does, rather than at import time.
    const [logoSize] = useState(() => splashLogoSize(Platform.OS, getNativeLogoSizeRatio()));
    const layout = useMemo(() => buildLayout(logoSize), [logoSize]);

    useEffect(() => {
        if (!start) {
            return;
        }

        // Idempotent: the animation callback and the failsafe timer race by design, and
        // whichever loses must not hide the splash a second time or fire
        // `onAnimationComplete` twice (Layout's handler is a setState, so a double call
        // would be harmless today — but that is the caller's business, not ours).
        const finish = () => {
            if (hasFinishedRef.current) {
                return;
            }
            hasFinishedRef.current = true;
            setHidden(true);
            onAnimationComplete();
        };

        // Bounds the hang described on SPLASH_FAILSAFE_MS. Cleared on unmount so a
        // component torn down mid-animation does not call back into a dead tree.
        const failsafe = setTimeout(finish, SPLASH_FAILSAFE_MS);

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

            return () => clearTimeout(failsafe);
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

        return () => clearTimeout(failsafe);
    }, [start, rotation, eyelid, opacity, onAnimationComplete]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    // One animated style per view — reanimated does not support sharing a single one.
    const leftEyelidStyle = useAnimatedStyle(() => eyelidAnimation(eyelid.value, layout.eyeRadius));
    const rightEyelidStyle = useAnimatedStyle(() => eyelidAnimation(eyelid.value, layout.eyeRadius));

    if (hidden) {
        return null;
    }

    return (
        <Animated.View style={[styles.overlay, overlayStyle]}>
            <View style={layout.logo}>
                <Animated.Image
                    source={logoSource}
                    // Android fades a freshly decoded image in over 300ms by default, which is
                    // one more thing for the eye to catch at the handoff.
                    fadeDuration={0}
                    onError={() => setLogoSource(BUNDLED_LOGO_SOURCE)}
                    style={[layout.logo, logoStyle]}
                    resizeMode="contain"
                />
                {SHOULD_BLINK_LOGO && (
                    <>
                        <Animated.View style={[layout.leftEyelid, leftEyelidStyle]} />
                        <Animated.View style={[layout.rightEyelid, rightEyelidStyle]} />
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
});

export default SplashLogoSpinner;
