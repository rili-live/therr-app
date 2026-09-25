import React from 'react';
import {
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { FeatureFlags } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import { WeeklyRecapService } from 'therr-react/services';
import type { IWeeklyRecap, IWeeklyRecapDay } from 'therr-react/services';
import { IHabitsLifetimeOffer, IUserState } from 'therr-react/types';
import getConfig from '../../utilities/getConfig';
import { shouldShowFounderCta } from '../../components/Habits/founderCtaState';
import { UpgradeNudgeCard } from '../../components/Habits';
import { formatSeatCount } from '../Habits/paywallPresentation';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles, buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { HabitsListLoader } from '../../components/Habits';
import translator from '../../utilities/translator';
import { logAppEvent } from '../../utilities/analyticsEvents';
import {
    formatWeekRange,
    getDeviceTimeZone,
    shiftWeek,
} from './weekMath';

interface IStoreProps {
    user: IUserState;
    lifetimeOffer?: IHabitsLifetimeOffer | null;
    getLifetimeOffer?: Function;
}

export interface IWeeklyRecapProps extends IStoreProps {
    navigation: any;
    route: {
        params?: {
            /**
             * The Monday of the week to open, as carried by the `weeklyRecap` push payload.
             * Absent for an in-app entry, which means "the week that just closed" — the same
             * default the server applies.
             */
            weekStartDate?: string;
        };
    };
}

interface IWeeklyRecapState {
    recap: IWeeklyRecap | null;
    /** Distinct from `recap === null`: a refresh keeps the old week on screen while it loads. */
    hasFetched: boolean;
    isLoading: boolean;
    hasError: boolean;
    /** null until the first response names a week; after that, what the arrows move. */
    weekStartDate: string | null;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    lifetimeOffer: state.habits?.lifetimeOffer,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getLifetimeOffer: HabitActions.getLifetimeOffer,
}, dispatch);

/**
 * One Monday–Sunday week of habit activity, told back to the user.
 *
 * The destination of the `weeklyRecap` push, and reachable from the habits dashboard. Two
 * things about it are deliberate:
 *
 * 1. **The server decides what the week means.** `recap.headline` picks the heading; nothing
 *    here re-derives "your best week yet" from the totals. The push body was written from that
 *    same value, so a screen that made its own judgement could open contradicting the
 *    notification that sent the user here.
 *
 * 2. **The notification names its week.** `route.params.weekStartDate` comes off the FCM data
 *    map, so a recap opened on Wednesday still shows the week it was about rather than the one
 *    in progress. Without it the screen would silently show the wrong week to exactly the
 *    users who did not tap immediately.
 *
 * Read-only and fetched locally rather than through a redux slice: one screen consumes it,
 * nothing else in the app needs a recap in its store, and the week being viewed is screen
 * state by definition.
 */
class WeeklyRecap extends React.Component<IWeeklyRecapProps, IWeeklyRecapState> {
    private theme = buildStyles();

    private themeMenu = buildMenuStyles();

    private themeHabits = buildHabitStyles();

    private translate: (key: string, params?: any) => string;

    private isMounted_ = false;

    constructor(props: IWeeklyRecapProps) {
        super(props);

        this.state = {
            recap: null,
            hasFetched: false,
            isLoading: false,
            hasError: false,
            weekStartDate: props.route?.params?.weekStartDate || null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.isMounted_ = true;
        this.loadRecap(this.state.weekStartDate);

        // For the founder card under the recap. Fire-and-forget and flag-gated,
        // as everywhere else: the card fails closed without an offer.
        if (getConfig().featureFlags?.[FeatureFlags.ENABLE_HABITS_LIFETIME_OFFER] === true) {
            this.props.getLifetimeOffer?.()?.catch?.(() => {});
        }

        logAppEvent('weekly_recap_view', {
            userId: this.props.user?.details?.id,
            // Whether the user arrived from the notification or from the dashboard is the
            // number that says whether the push is earning its place.
            source: this.props.route?.params?.weekStartDate ? 'pushNotification' : 'inApp',
        });
    }

    componentWillUnmount() {
        // The fetch below resolves into setState, and a recap request outliving a quick back
        // press is entirely possible on a cold open from the tray.
        this.isMounted_ = false;
    }

    loadRecap = (weekStartDate: string | null) => {
        this.setState({ isLoading: true, hasError: false });

        return WeeklyRecapService.getMine(weekStartDate || undefined, getDeviceTimeZone())
            .then((response: any) => {
                if (!this.isMounted_) {
                    return;
                }
                const recap: IWeeklyRecap = response?.data;
                this.setState({
                    recap: recap || null,
                    // The server normalizes whatever was asked for, so the week the arrows move
                    // from is the week that came back — never the one that was requested.
                    weekStartDate: recap?.weekStartDate || weekStartDate,
                    hasError: !recap,
                });
            })
            .catch(() => {
                if (!this.isMounted_) {
                    return;
                }
                this.setState({ hasError: true });
            })
            .finally(() => {
                if (!this.isMounted_) {
                    return;
                }
                this.setState({ isLoading: false, hasFetched: true });
            });
    };

    onRefresh = () => this.loadRecap(this.state.weekStartDate);

    goToWeek = (offsetWeeks: number) => {
        const { recap } = this.state;
        if (!recap) {
            return;
        }
        this.loadRecap(shiftWeek(recap.weekStartDate, offsetWeeks));
    };

    /**
     * Forward is blocked once the week on screen is the one in progress: there is no later week
     * to look at, and the server would simply answer with this same one — an arrow that visibly
     * does nothing.
     */
    canGoForward = (): boolean => !!this.state.recap && !this.state.recap.isCurrentWeek;

    renderDay = (day: IWeeklyRecapDay) => {
        const { styles } = this.themeHabits;
        const dayLabels: string[] = this.translate('pages.weeklyRecap.dayInitials').split(',');

        const isUpheld = day.status === 'upheld';
        const isFrozen = day.status === 'frozen';

        return (
            <View key={day.date} style={styles.weeklyRecapDay}>
                <Text style={styles.weeklyRecapDayLabel}>{dayLabels[day.dow] || ''}</Text>
                <View
                    accessible
                    accessibilityLabel={this.translate(`pages.weeklyRecap.dayStatus.${day.status}`, {
                        date: day.date,
                        checkinCount: day.checkinCount,
                    })}
                    style={[
                        styles.weeklyRecapDayDot,
                        isUpheld && styles.weeklyRecapDayDotUpheld,
                        isFrozen && styles.weeklyRecapDayDotFrozen,
                    ]}
                >
                    {day.checkinCount > 0 && (
                        <Text style={isUpheld ? styles.weeklyRecapDayCount : styles.weeklyRecapDayCountMuted}>
                            {day.checkinCount}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    renderDelta = (current: number, previous: number) => {
        const { recap } = this.state;
        const { styles } = this.themeHabits;

        // Nothing to compare against is not the same as "no change", and rendering "+3" against
        // a week the user was not yet a user is manufactured praise.
        if (!recap?.hasPreviousWeek) {
            return null;
        }

        const delta = current - previous;
        if (delta === 0) {
            return null;
        }

        return (
            <Text
                style={[
                    styles.weeklyRecapDelta,
                    delta > 0 ? styles.weeklyRecapDeltaUp : styles.weeklyRecapDeltaDown,
                ]}
            >
                {this.translate(
                    delta > 0 ? 'pages.weeklyRecap.deltaUp' : 'pages.weeklyRecap.deltaDown',
                    { count: Math.abs(delta) },
                )}
            </Text>
        );
    };

    renderRecap = (recap: IWeeklyRecap) => {
        const { styles } = this.themeHabits;

        return (
            <>
                <View style={styles.weeklyRecapHeader}>
                    <Text style={styles.weeklyRecapHeadline}>
                        {this.translate(`pages.weeklyRecap.headlines.${recap.headline}`, {
                            checkinCount: recap.totals.checkinCount,
                            perfectDays: recap.totals.upheldDays,
                            habitName: recap.topHabit?.name || '',
                        })}
                    </Text>
                    <Text style={styles.weeklyRecapDateRange}>
                        {formatWeekRange(recap.weekStartDate, recap.weekEndDate, this.translate)}
                    </Text>
                </View>

                <View style={styles.weeklyRecapCard}>
                    <Text style={styles.weeklyRecapCardTitle}>
                        {this.translate('pages.weeklyRecap.sections.days')}
                    </Text>
                    <View style={styles.weeklyRecapStrip}>
                        {recap.days.map(this.renderDay)}
                    </View>
                </View>

                <View style={styles.weeklyRecapCard}>
                    <Text style={styles.weeklyRecapCardTitle}>
                        {this.translate('pages.weeklyRecap.sections.totals')}
                    </Text>
                    <View style={styles.weeklyRecapStatRow}>
                        <View style={styles.weeklyRecapStat}>
                            <Text style={styles.weeklyRecapStatValue}>{recap.totals.checkinCount}</Text>
                            <Text style={styles.weeklyRecapStatLabel}>
                                {this.translate('pages.weeklyRecap.stats.checkins')}
                            </Text>
                            {this.renderDelta(recap.totals.checkinCount, recap.previousTotals.checkinCount)}
                        </View>
                        <View style={styles.weeklyRecapStat}>
                            <Text style={styles.weeklyRecapStatValue}>{recap.totals.upheldDays}</Text>
                            <Text style={styles.weeklyRecapStatLabel}>
                                {this.translate('pages.weeklyRecap.stats.daysUpheld')}
                            </Text>
                            {this.renderDelta(recap.totals.upheldDays, recap.previousTotals.upheldDays)}
                        </View>
                        <View style={styles.weeklyRecapStat}>
                            <Text style={styles.weeklyRecapStatValue}>{recap.streakAtWeekEnd}</Text>
                            <Text style={styles.weeklyRecapStatLabel}>
                                {this.translate('pages.weeklyRecap.stats.streak')}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.weeklyRecapCard}>
                    <Text style={styles.weeklyRecapCardTitle}>
                        {this.translate('pages.weeklyRecap.sections.habits')}
                    </Text>
                    {recap.habits.length === 0
                        ? (
                            <Text style={styles.weeklyRecapEmptyText}>
                                {this.translate('pages.weeklyRecap.messages.noCheckins')}
                            </Text>
                        )
                        : recap.habits.map((habit, index) => (
                            <View
                                key={habit.habitGoalId}
                                style={[
                                    styles.weeklyRecapHabitRow,
                                    index === 0 && styles.weeklyRecapHabitRowFirst,
                                ]}
                            >
                                {!!habit.emoji && <Text style={styles.weeklyRecapHabitEmoji}>{habit.emoji}</Text>}
                                <Text style={styles.weeklyRecapHabitName} numberOfLines={1}>
                                    {/* A check-in whose goal row was deleted keeps its count but has no name. */}
                                    {habit.name || this.translate('pages.weeklyRecap.messages.deletedHabit')}
                                </Text>
                                <Text style={styles.weeklyRecapHabitCount}>{habit.completedCount}</Text>
                            </View>
                        ))}
                </View>
            </>
        );
    };

    /**
     * The founder offer, after the week's numbers. A recap is the one screen a
     * user opens having just been told they showed up — the moment "keep every
     * feature for life" is a reward rather than an interruption. Shown only
     * while the offer is live and purchasable (`shouldShowFounderCta`), so it
     * disappears for founders, subscribers and once the seats are gone.
     */
    renderFounderCard = () => {
        const { lifetimeOffer, navigation, user } = this.props;

        if (getConfig().featureFlags?.[FeatureFlags.ENABLE_HABITS_LIFETIME_OFFER] !== true) {
            return null;
        }

        if (!shouldShowFounderCta(lifetimeOffer)) {
            return null;
        }

        return (
            <UpgradeNudgeCard
                variant="card"
                source="weekly-recap"
                title={this.translate('pages.weeklyRecap.founderCard.title')}
                body={this.translate('pages.weeklyRecap.founderCard.body', {
                    remaining: formatSeatCount(lifetimeOffer?.remaining, user.settings?.locale || 'en-us'),
                })}
                onPress={() => navigation.navigate('UpgradePaywall', { source: 'weekly-recap' })}
                themeHabits={this.themeHabits}
            />
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { hasError, hasFetched, isLoading, recap } = this.state;
        const { styles } = this.themeHabits;

        return (
            <SafeAreaView
                edges={[]}
                style={[this.theme.styles.safeAreaView, styles.weeklyRecapContainer]}
            >
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <ScrollView
                    style={[this.theme.styles.scrollView]}
                    contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                    refreshControl={<RefreshControl refreshing={isLoading && hasFetched} onRefresh={this.onRefresh} />}
                >
                    {/*
                      * Three states, matching MyHabits: a screen that has not loaded is not an
                      * empty screen, and a pull-to-refresh must not flicker the loader back in
                      * under the user's finger.
                      */}
                    {!hasFetched
                        ? (
                            <View style={styles.weeklyRecapHeader}>
                                <HabitsListLoader
                                    label={this.translate('pages.weeklyRecap.loading')}
                                    theme={this.themeHabits}
                                />
                            </View>
                        )
                        : null}

                    {hasFetched && !recap && (
                        <View style={styles.weeklyRecapCard}>
                            <Text style={styles.weeklyRecapEmptyText}>
                                {this.translate(
                                    hasError
                                        ? 'pages.weeklyRecap.messages.loadFailed'
                                        : 'pages.weeklyRecap.messages.noRecap',
                                )}
                            </Text>
                        </View>
                    )}

                    {!!recap && this.renderRecap(recap)}

                    {!!recap && this.renderFounderCard()}

                    {!!recap && (
                        <View style={styles.weeklyRecapNavRow}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={this.translate('pages.weeklyRecap.buttons.previousWeek')}
                                style={({ pressed }) => [
                                    styles.weeklyRecapNavButton,
                                    pressed && styles.pressedOpacity,
                                ]}
                                onPress={() => this.goToWeek(-1)}
                            >
                                <Text style={styles.weeklyRecapNavButtonText}>
                                    {this.translate('pages.weeklyRecap.buttons.previousWeek')}
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={this.translate('pages.weeklyRecap.buttons.nextWeek')}
                                accessibilityState={{ disabled: !this.canGoForward() }}
                                disabled={!this.canGoForward()}
                                style={({ pressed }) => [
                                    styles.weeklyRecapNavButton,
                                    !this.canGoForward() && styles.weeklyRecapNavButtonDisabled,
                                    pressed && styles.pressedOpacity,
                                ]}
                                onPress={() => this.goToWeek(1)}
                            >
                                <Text style={styles.weeklyRecapNavButtonText}>
                                    {this.translate('pages.weeklyRecap.buttons.nextWeek')}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.onRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </SafeAreaView>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(WeeklyRecap);
