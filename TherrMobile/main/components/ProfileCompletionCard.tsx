import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { IUserState } from 'therr-react/types';
import { Button } from './BaseButton';
import { buildStyles } from '../styles/profileCompletionCard';
import {
    DEFAULT_PROFILE_COMPLETION_FLAGS,
    IProfileCompletionFlags,
    IProfileCompletionStep,
    getProfileCompletionFlags,
    getProfileCompletionSummary,
    syncInterestsFlag,
} from '../utilities/profileCompletion';

interface IProfileCompletionCardProps {
    navigation: any;
    translate: (key: string, params?: any) => string;
    user: IUserState;
    themeName?: string;
}

const PROGRESS_ANIMATION_DURATION_MS = 450;

/**
 * "Finish your profile" checklist card. Renders the remaining onboarding steps
 * as a tappable checklist with a progress bar, and hands off to the guided
 * CreateProfile flow at whichever stage the user picks. Renders nothing once
 * every step is resolved.
 */
const ProfileCompletionCard: React.FC<IProfileCompletionCardProps> = ({
    navigation,
    translate,
    user,
    themeName,
}) => {
    const theme = buildStyles(themeName as any);
    const [flags, setFlags] = useState<IProfileCompletionFlags | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const progressAnimation = useRef(new Animated.Value(0)).current;
    const userId = user?.details?.id;

    const refreshFlags = useCallback(() => {
        getProfileCompletionFlags(userId).then(setFlags).catch(() => setFlags(DEFAULT_PROFILE_COMPLETION_FLAGS));
    }, [userId]);

    useEffect(() => {
        // Seed the interests flag for accounts that picked interests before the
        // checklist existed, then read the merged result.
        syncInterestsFlag(userId)
            .then(setFlags)
            .catch(() => setFlags(DEFAULT_PROFILE_COMPLETION_FLAGS));
    }, [userId]);

    useEffect(() => {
        // Steps are completed on other screens (the guided flow, contact sync),
        // so re-read on focus rather than trusting the initial render.
        const unsubscribe = navigation?.addListener?.('focus', refreshFlags);

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [navigation, refreshFlags]);

    const summary = getProfileCompletionSummary(user, flags || DEFAULT_PROFILE_COMPLETION_FLAGS);

    useEffect(() => {
        const animation = Animated.timing(progressAnimation, {
            toValue: summary.percentComplete,
            duration: PROGRESS_ANIMATION_DURATION_MS,
            // Width is not supported by the native driver.
            useNativeDriver: false,
        });
        animation.start();

        // Without this the JS-driven animation keeps ticking (and setting state)
        // after the card unmounts or the target changes mid-flight.
        return () => animation.stop();
    }, [progressAnimation, summary.percentComplete]);

    const goToStage = (step?: IProfileCompletionStep) => {
        if (!step) {
            return;
        }

        // `isGuidedStep` tells CreateProfile it was entered from the checklist,
        // so finishing returns here instead of dropping the user on the map.
        navigation.navigate('CreateProfile', {
            stage: step.stage,
            isGuidedStep: true,
        });
    };

    // Wait for the persisted flags so the card never flashes steps the user
    // already finished, and drop out entirely once the profile is done.
    if (!flags || summary.isComplete) {
        return null;
    }

    const progressWidth = progressAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={theme.styles.container}>
            <View style={theme.styles.headerRow}>
                <View style={theme.styles.headerTextContainer}>
                    <Text style={theme.styles.title}>
                        {translate('components.profileCompletionCard.title')}
                    </Text>
                    <Text style={theme.styles.stepsLeft}>
                        {translate(
                            summary.remainingCount === 1
                                ? 'components.profileCompletionCard.stepLeft'
                                : 'components.profileCompletionCard.stepsLeft',
                            { count: summary.remainingCount },
                        )}
                    </Text>
                </View>
                <Pressable
                    onPress={() => setIsCollapsed(!isCollapsed)}
                    hitSlop={10}
                    style={theme.styles.collapseButton}
                    accessibilityRole="button"
                    accessibilityLabel={translate(
                        isCollapsed
                            ? 'components.profileCompletionCard.expand'
                            : 'components.profileCompletionCard.collapse',
                    )}
                >
                    <FontAwesomeIcon
                        name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                        size={16}
                        style={theme.styles.collapseIcon}
                    />
                </Pressable>
            </View>

            <View style={theme.styles.progressTrack}>
                <Animated.View style={[theme.styles.progressFill, { width: progressWidth }]} />
            </View>

            {
                !isCollapsed &&
                <View style={theme.styles.stepList}>
                    {
                        summary.steps.map((step) => (
                            <Pressable
                                key={step.key}
                                style={theme.styles.stepRow}
                                onPress={() => goToStage(step)}
                                accessibilityRole="button"
                                accessibilityLabel={translate(step.labelKey)}
                                accessibilityState={{ checked: step.isComplete }}
                            >
                                <View style={[
                                    theme.styles.stepIndicator,
                                    step.isComplete && theme.styles.stepIndicatorComplete,
                                    step.isSkipped && theme.styles.stepIndicatorSkipped,
                                ]}>
                                    <FontAwesomeIcon
                                        name={step.isComplete ? 'check' : (step.isSkipped ? 'minus' : step.icon)}
                                        size={12}
                                        style={[
                                            theme.styles.stepIndicatorIcon,
                                            step.isComplete && theme.styles.stepIndicatorIconComplete,
                                            step.isSkipped && theme.styles.stepIndicatorIconSkipped,
                                        ]}
                                    />
                                </View>
                                <View style={theme.styles.stepTextContainer}>
                                    <Text style={[
                                        theme.styles.stepLabel,
                                        step.isComplete && theme.styles.stepLabelComplete,
                                    ]}>
                                        {translate(step.labelKey)}
                                    </Text>
                                    {
                                        !step.isComplete &&
                                        <Text style={theme.styles.stepDescription}>
                                            {translate(
                                                step.isSkipped
                                                    ? 'components.profileCompletionCard.skipped'
                                                    : step.descriptionKey,
                                            )}
                                        </Text>
                                    }
                                </View>
                                {
                                    !step.isComplete &&
                                    <FontAwesomeIcon
                                        name="chevron-right"
                                        size={14}
                                        style={theme.styles.stepChevron}
                                    />
                                }
                            </Pressable>
                        ))
                    }
                </View>
            }

            {
                !!summary.nextStep &&
                <Button
                    containerStyle={theme.styles.continueButtonContainer}
                    buttonStyle={theme.styles.continueButton}
                    titleStyle={theme.styles.continueButtonTitle}
                    title={translate('components.profileCompletionCard.continue')}
                    onPress={() => goToStage(summary.nextStep)}
                />
            }
        </View>
    );
};

export default ProfileCompletionCard;
