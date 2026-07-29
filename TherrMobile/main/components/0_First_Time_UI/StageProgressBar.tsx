import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ITherrThemeColors } from '../../styles/themes';
import { radius } from '../../styles/radii';
import { space } from '../../styles/layouts/spacing';

interface IStageProgressBarProps {
    /** 1-based index of the stage the user is on. */
    currentStep: number;
    totalSteps: number;
    onBack?: () => void;
    /** Hides the back affordance on the first stage of a fresh sign-up. */
    canGoBack?: boolean;
    translate: (key: string, params?: any) => string;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const PROGRESS_ANIMATION_DURATION_MS = 350;

/**
 * Duolingo-style progress header for the guided profile flow: a back arrow and
 * a single bar that fills as the user advances, so a multi-screen form reads as
 * finite progress rather than an open-ended interrogation.
 */
const StageProgressBar: React.FC<IStageProgressBarProps> = ({
    currentStep,
    totalSteps,
    onBack,
    canGoBack = true,
    translate,
    theme,
}) => {
    const percentComplete = totalSteps > 0 ? Math.min(Math.max(currentStep / totalSteps, 0), 1) : 0;
    const progressAnimation = useRef(new Animated.Value(percentComplete)).current;

    useEffect(() => {
        Animated.timing(progressAnimation, {
            toValue: percentComplete,
            duration: PROGRESS_ANIMATION_DURATION_MS,
            // Width is not supported by the native driver.
            useNativeDriver: false,
        }).start();
    }, [progressAnimation, percentComplete]);

    const progressWidth = progressAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View
            style={localStyles.container}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: totalSteps, now: currentStep }}
        >
            {
                canGoBack && !!onBack &&
                <Pressable
                    onPress={onBack}
                    hitSlop={10}
                    style={localStyles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.createProfile.progress.back')}
                >
                    <FontAwesomeIcon
                        name="arrow-left"
                        size={20}
                        color={theme.colors.onSurfaceMuted}
                    />
                </Pressable>
            }
            <View style={[localStyles.track, { backgroundColor: theme.colors.border }]}>
                <Animated.View
                    style={[
                        localStyles.fill,
                        {
                            backgroundColor: theme.colors.brand,
                            width: progressWidth,
                        },
                    ]}
                />
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
    },
    backButton: {
        paddingRight: space.md,
        paddingVertical: space.xs,
    },
    track: {
        flex: 1,
        height: 14,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: radius.pill,
    },
});

export default StageProgressBar;
