import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    BackHandler,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import LottieView from 'lottie-react-native';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import WeekStrip from '../../components/Celebrations/WeekStrip';
import { PlacementHero, StreakHero } from '../../components/Celebrations/CelebrationHero';
import celebrationQueue, { ICelebration } from '../../utilities/celebrationQueue';
import { triggerRewardCelebration } from '../../utilities/rewardFeedback';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildCelebrationStyles } from '../../styles/celebrations';

const celebrationConfetti = require('../../assets/achievement-confetti-2.json');

/** Ordinals are locale-shaped, so they come from the dictionary rather than a suffix rule. */
const PLACEMENT_KEYS: Record<number, string> = {
    1: 'pages.celebration.placement.first',
    2: 'pages.celebration.placement.second',
    3: 'pages.celebration.placement.third',
};

interface ICelebrationProps {
    navigation: any;
    // `any` rather than `{ params: ICelebration }`: a narrower `route` makes the connected
    // component unassignable to React Navigation's ScreenComponentType. The params are read
    // through one typed local below instead.
    route: any;
    user: IUserState;
    markDailyStreakCelebrated: Function;
    acknowledgePlacement: Function;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    markDailyStreakCelebrated: HabitActions.markDailyStreakCelebrated,
    acknowledgePlacement: HabitActions.acknowledgePlacement,
}, dispatch);

/**
 * The full-screen celebration: a streak day, a streak milestone, or an end-of-period
 * leaderboard placement.
 *
 * It is only ever reached through `celebrationQueue`, never navigated to directly — the queue
 * is what keeps it from pre-empting the check-in toast and the note/photo screen, and what
 * orders a placement ahead of a streak when both are owed. The screen's own job on the way out
 * is to tell the server it was seen (so it is not shown again) and to release the queue.
 */
export const Celebration = ({
    navigation,
    route,
    user,
    markDailyStreakCelebrated,
    acknowledgePlacement,
}: ICelebrationProps) => {
    const celebration: ICelebration = route.params;
    const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
    // The dismiss path is reachable from two buttons and the hardware back button; a ref rather
    // than state because the guard has to hold within a single tick, before a re-render.
    const hasDismissedRef = useRef(false);
    const scaleAnim = useRef(new Animated.Value(0.6)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeCelebration = useMemo(
        () => buildCelebrationStyles(user.settings?.mobileThemeName),
        [user.settings?.mobileThemeName],
    );
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale],
    );

    const isMilestone = celebration.type === 'streak' && celebration.milestone;

    useEffect(() => {
        let isMounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (isMounted) {
                setIsReduceMotionEnabled(enabled);
            }
        }).catch(() => {
            // An unavailable accessibility bridge is not a reason to skip the celebration;
            // fall through to the animated path, which is the default experience.
        });

        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            if (isMounted) {
                setIsReduceMotionEnabled(enabled);
            }
        });

        return () => {
            isMounted = false;
            subscription?.remove?.();
        };
    }, []);

    // Haptics + entrance. `triggerRewardCelebration` returns its own cancel function, which has
    // to run on unmount or a queued haptic fires against a screen that is gone.
    useEffect(() => {
        const cancelHaptics = triggerRewardCelebration();

        return () => {
            cancelHaptics?.();
        };
    }, []);

    useEffect(() => {
        if (isReduceMotionEnabled) {
            scaleAnim.setValue(1);
            fadeAnim.setValue(1);
            return undefined;
        }

        const animation = Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 80,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 320,
                delay: 180,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
        ]);
        animation.start();

        return () => animation.stop();
    }, [isReduceMotionEnabled, scaleAnim, fadeAnim]);

    /**
     * Record that this celebration was seen, then leave. The write is fire-and-forget and its
     * local half is optimistic (see the action): the screen has already been shown, so a failed
     * request must not leave the queue believing it is still owed and re-showing it. The queue
     * is released in the unmount effect below rather than here, so the next celebration cannot
     * mount before this one is actually gone.
     */
    const dismiss = useCallback((goToLeaderboard = false) => {
        if (hasDismissedRef.current) {
            return;
        }
        hasDismissedRef.current = true;

        if (celebration.type === 'streak') {
            // The device zone rides along, as it does on the fetch: the server clamps `date` to
            // the user's local today and needs the zone to know which day that is when the
            // account has none saved.
            markDailyStreakCelebrated(
                celebration.date,
                Intl.DateTimeFormat().resolvedOptions().timeZone,
            )?.catch?.(() => {});
        } else {
            acknowledgePlacement(celebration.periodId)?.catch?.(() => {});
        }

        navigation.goBack();
        if (goToLeaderboard) {
            navigation.navigate('Leaderboard');
        }
    }, [celebration, markDailyStreakCelebrated, acknowledgePlacement, navigation]);

    // Hardware back must count as a dismissal, or the server is never told and the same screen
    // returns on the next foreground.
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            dismiss();
            return true;
        });

        return () => subscription.remove();
    }, [dismiss]);

    // One release per mount, whatever route the exit took (button, back, or a navigation the
    // user made some other way).
    useEffect(() => () => {
        celebrationQueue.onDismissed();
    }, []);

    const renderStreakBody = () => {
        if (celebration.type !== 'streak') {
            return null;
        }

        const frozenDay = celebration.week?.find((day) => day.status === 'frozen');
        let copy: string;
        if (celebration.perfectWeek) {
            copy = translate('pages.celebration.streak.perfectWeek');
        } else if (frozenDay) {
            copy = translate('pages.celebration.streak.freezeSaved', {
                day: translate(`pages.celebration.weekdaysLong.${frozenDay.dow}`),
            });
        } else {
            copy = translate('pages.celebration.streak.default');
        }

        const weekdayLabels = Array.from(
            { length: 7 },
            (_, index) => translate(`pages.celebration.weekdaysShort.${index}`),
        );

        return (
            <>
                <Text style={themeCelebration.styles.bigNumber}>{celebration.streak}</Text>
                <Text style={themeCelebration.styles.label}>
                    {translate('pages.celebration.streak.dayStreak', { count: celebration.streak })}
                </Text>
                {celebration.week?.length ? (
                    <WeekStrip
                        days={celebration.week}
                        dayLabels={weekdayLabels}
                        colors={theme.colors}
                        accessibilityLabel={translate('pages.celebration.streak.weekAccessibility')}
                    />
                ) : null}
                <Text style={themeCelebration.styles.copy}>{copy}</Text>
                {isMilestone ? (
                    <Text style={themeCelebration.styles.copy}>
                        {translate('pages.celebration.streak.milestoneBody', {
                            count: celebration.streak,
                            weeks: Math.round(celebration.streak / 7),
                        })}
                    </Text>
                ) : null}
                {celebration.newLongest ? (
                    <Text style={themeCelebration.styles.copyStrong}>
                        {translate('pages.celebration.streak.newPersonalBest')}
                    </Text>
                ) : null}
            </>
        );
    };

    const renderPlacementBody = () => {
        if (celebration.type !== 'placement') {
            return null;
        }

        return (
            <>
                <Text style={themeCelebration.styles.bigNumber}>
                    {translate(PLACEMENT_KEYS[celebration.placement] || PLACEMENT_KEYS[3])}
                </Text>
                <Text style={themeCelebration.styles.label}>
                    {translate('pages.celebration.placement.place')}
                </Text>
                <Text style={themeCelebration.styles.copy}>
                    {translate('pages.celebration.placement.subtitle', {
                        period: celebration.periodStart,
                        score: celebration.score,
                        participants: celebration.participants,
                    })}
                </Text>
                {/* Leagues are deferred. The line stays so the seam is visible, and renders
                    nothing until `leagueTo` is ever populated. */}
                {celebration.leagueTo ? (
                    <Text style={themeCelebration.styles.copyStrong}>
                        {translate('pages.celebration.placement.promoted', { league: celebration.leagueTo })}
                    </Text>
                ) : null}
            </>
        );
    };

    const isPlacement = celebration.type === 'placement';

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView style={[theme.styles.safeAreaView, { backgroundColor: theme.colors.backgroundGray }]}>
                <View style={themeCelebration.styles.root}>
                    {isMilestone && !isReduceMotionEnabled ? (
                        // Wrapped rather than given `pointerEvents` directly: LottieView does
                        // not accept it, and the confetti must not swallow taps on the CTA.
                        <View style={StyleSheet.absoluteFill} pointerEvents="none">
                            <LottieView
                                source={celebrationConfetti}
                                resizeMode="cover"
                                speed={1}
                                autoPlay
                                loop={false}
                                style={StyleSheet.absoluteFill}
                            />
                        </View>
                    ) : null}
                    <Animated.View
                        style={[themeCelebration.styles.hero, { transform: [{ scale: scaleAnim }] }]}
                    >
                        {celebration.type === 'streak' ? (
                            <StreakHero
                                size={isMilestone ? 220 : 160}
                                burst={isMilestone}
                                colors={theme.colors}
                            />
                        ) : (
                            <PlacementHero tier={celebration.placement} colors={theme.colors} />
                        )}
                    </Animated.View>
                    <Animated.View style={[themeCelebration.styles.center, { opacity: fadeAnim }]}>
                        {celebration.type === 'streak' ? renderStreakBody() : renderPlacementBody()}
                    </Animated.View>
                    <View style={themeCelebration.styles.actions}>
                        {isPlacement ? (
                            <Pressable
                                onPress={() => dismiss(true)}
                                accessibilityRole="button"
                                style={[themeCelebration.styles.button, themeCelebration.styles.buttonPrimary]}
                            >
                                <Text style={themeCelebration.styles.buttonPrimaryText}>
                                    {translate('pages.celebration.actions.seeLeaderboard')}
                                </Text>
                            </Pressable>
                        ) : null}
                        <Pressable
                            onPress={() => dismiss()}
                            accessibilityRole="button"
                            style={[
                                themeCelebration.styles.button,
                                isPlacement
                                    ? themeCelebration.styles.buttonSecondary
                                    : themeCelebration.styles.buttonPrimary,
                            ]}
                        >
                            <Text style={isPlacement
                                ? themeCelebration.styles.buttonSecondaryText
                                : themeCelebration.styles.buttonPrimaryText}
                            >
                                {translate(isPlacement
                                    ? 'pages.celebration.actions.done'
                                    : 'pages.celebration.actions.continue')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
};

export default connect(mapStateToProps, mapDispatchToProps)(Celebration);
