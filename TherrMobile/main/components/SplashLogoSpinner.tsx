import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
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

// Some brands (e.g. HABITS) use a combined splash logo that bundles the icon
// and the wordmark into a single image. Spinning that image rotates the text
// too, which reads poorly — so we only spin brands whose splash logo is an
// icon on its own, and fade the rest out without rotating.
const SHOULD_SPIN_LOGO = CURRENT_BRAND_VARIATION !== BrandVariations.HABITS;

interface ISplashLogoSpinnerProps {
    start: boolean;
    onAnimationComplete: () => void;
}

const SplashLogoSpinner = ({ start, onAnimationComplete }: ISplashLogoSpinnerProps) => {
    const rotation = useSharedValue(0);
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

        if (!SHOULD_SPIN_LOGO) {
            fadeOut();
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
    }, [start, rotation, opacity, onAnimationComplete]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    if (hidden) {
        return null;
    }

    return (
        <Animated.View style={[styles.overlay, overlayStyle]}>
            <Animated.Image
                source={require('../assets/bootsplash_logo.png')}
                style={[styles.logo, logoStyle]}
                resizeMode="contain"
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: BOOTSPLASH_BACKGROUND,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
    },
});

export default SplashLogoSpinner;
