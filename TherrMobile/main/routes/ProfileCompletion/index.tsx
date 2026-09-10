import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { IUserState } from 'therr-react/types';
import { Button } from '../../components/BaseButton';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import useProfileCompletion from '../../hooks/useProfileCompletion';
import translator from '../../utilities/translator';
import { IProfileCompletionStep } from '../../utilities/profileCompletion';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildProfileCompletionStyles } from '../../styles/profileCompletion';

const PROGRESS_ANIMATION_DURATION_MS = 450;

interface IProfileCompletionProps {
    navigation: any;
    user: IUserState;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

/**
 * "Finish your profile" checklist screen. Renders the onboarding steps as a
 * tappable checklist with a progress bar, and hands off to the guided
 * CreateProfile flow at whichever stage the user picks. Reached from the
 * profile-completion link on the user's own profile.
 */
export const ProfileCompletion = ({ navigation, user }: IProfileCompletionProps) => {
    const themeName = user.settings?.mobileThemeName;
    const theme = useMemo(() => buildStyles(themeName), [themeName]);
    const themeMenu = useMemo(() => buildMenuStyles(themeName), [themeName]);
    const themeProfileCompletion = useMemo(() => buildProfileCompletionStyles(themeName), [themeName]);
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale],
    );

    const { isReady, summary } = useProfileCompletion(user, navigation);
    const progressAnimation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.profileCompletion.headerTitle'),
        });
    }, [navigation, translate]);

    useEffect(() => {
        const animation = Animated.timing(progressAnimation, {
            toValue: summary.percentComplete,
            duration: PROGRESS_ANIMATION_DURATION_MS,
            // Width is not supported by the native driver.
            useNativeDriver: false,
        });
        animation.start();

        // Without this the JS-driven animation keeps ticking (and setting state)
        // after the screen unmounts or the target changes mid-flight.
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

    const progressWidth = progressAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const renderStep = (step: IProfileCompletionStep) => (
        <Pressable
            key={step.key}
            style={themeProfileCompletion.styles.stepRow}
            onPress={() => goToStage(step)}
            accessibilityRole="button"
            accessibilityLabel={translate(step.labelKey)}
            accessibilityState={{ checked: step.isComplete }}
        >
            <View style={[
                themeProfileCompletion.styles.stepIndicator,
                step.isComplete && themeProfileCompletion.styles.stepIndicatorComplete,
                step.isSkipped && themeProfileCompletion.styles.stepIndicatorSkipped,
            ]}>
                <FontAwesomeIcon
                    name={step.isComplete ? 'check' : (step.isSkipped ? 'minus' : step.icon)}
                    size={12}
                    style={[
                        themeProfileCompletion.styles.stepIndicatorIcon,
                        step.isComplete && themeProfileCompletion.styles.stepIndicatorIconComplete,
                        step.isSkipped && themeProfileCompletion.styles.stepIndicatorIconSkipped,
                    ]}
                />
            </View>
            <View style={themeProfileCompletion.styles.stepTextContainer}>
                <Text style={[
                    themeProfileCompletion.styles.stepLabel,
                    step.isComplete && themeProfileCompletion.styles.stepLabelComplete,
                ]}>
                    {translate(step.labelKey)}
                </Text>
                {
                    !step.isComplete &&
                    <Text style={themeProfileCompletion.styles.stepDescription}>
                        {translate(
                            step.isSkipped
                                ? 'pages.profileCompletion.skipped'
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
                    style={themeProfileCompletion.styles.stepChevron}
                />
            }
        </Pressable>
    );

    const renderChecklist = () => (
        <>
            <Text style={themeProfileCompletion.styles.title}>
                {translate('pages.profileCompletion.title')}
            </Text>
            <Text style={themeProfileCompletion.styles.stepsLeft}>
                {translate(
                    summary.remainingCount === 1
                        ? 'pages.profileCompletion.stepLeft'
                        : 'pages.profileCompletion.stepsLeft',
                    { count: summary.remainingCount },
                )}
            </Text>

            <View style={themeProfileCompletion.styles.progressTrack}>
                <Animated.View
                    style={[themeProfileCompletion.styles.progressFill, { width: progressWidth }]}
                />
            </View>

            <View style={themeProfileCompletion.styles.stepList}>
                {summary.steps.map(renderStep)}
            </View>

            {
                !!summary.nextStep &&
                <Button
                    containerStyle={themeProfileCompletion.styles.continueButtonContainer}
                    buttonStyle={themeProfileCompletion.styles.continueButton}
                    titleStyle={themeProfileCompletion.styles.continueButtonTitle}
                    title={translate('pages.profileCompletion.continue')}
                    onPress={() => goToStage(summary.nextStep)}
                />
            }
        </>
    );

    const renderComplete = () => (
        <View style={themeProfileCompletion.styles.completeContainer}>
            <FontAwesomeIcon
                name="check-circle"
                size={48}
                style={themeProfileCompletion.styles.completeIcon}
            />
            <Text style={themeProfileCompletion.styles.completeText}>
                {translate('pages.profileCompletion.allDone')}
            </Text>
        </View>
    );

    return (
        <>
            <BaseStatusBar therrThemeName={themeName} />
            <SafeAreaView edges={[]} style={theme.styles.safeAreaView}>
                <ScrollView contentContainerStyle={themeProfileCompletion.styles.scrollContent}>
                    {
                        // Render nothing until the persisted flags land, otherwise
                        // the checklist flashes steps the user already finished.
                        isReady && (summary.isComplete ? renderComplete() : renderChecklist())
                    }
                </ScrollView>
            </SafeAreaView>
            <MainButtonMenu
                navigation={navigation}
                translate={translate}
                user={user}
                themeMenu={themeMenu}
            />
        </>
    );
};

export default connect(mapStateToProps)(ProfileCompletion);
