import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const BOOTSPLASH_BACKGROUND = '#1c7f8a';
const LOGO_SIZE = 100;
const SPIN_DURATION_MS = 700;
const FADE_OUT_DURATION_MS = 250;

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

        rotation.value = withTiming(
            360,
            { duration: SPIN_DURATION_MS, easing: Easing.inOut(Easing.quad) },
            (spinFinished) => {
                if (!spinFinished) {
                    return;
                }
                opacity.value = withTiming(
                    0,
                    { duration: FADE_OUT_DURATION_MS, easing: Easing.out(Easing.quad) },
                    (fadeFinished) => {
                        if (fadeFinished) {
                            runOnJS(finish)();
                        }
                    },
                );
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
