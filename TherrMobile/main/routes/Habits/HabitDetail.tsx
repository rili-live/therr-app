import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions, MapActions } from 'therr-react/redux/actions';
import {
    IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IHabitCheckinProof, IStreak,
} from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles, buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import {
    CheckinButton, CheckinDayDetailSheet, HabitCalendar, StreakWidget,
} from '../../components/Habits';
import { getProofMediaRequests, resolveProofUris } from './checkinDayDetail';
import {
    getFreezeConsumed,
    getStreakSavedByFreeze,
    streakFreezeRuleParams,
} from '../../utilities/streakFreezes';
import celebrationQueue, { enqueueStreakCelebration } from '../../utilities/celebrationQueue';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { toLocalDateKey } from '../../utilities/localDateKey';
import { DURATION, showToast } from '../../utilities/toasts';

interface IHabitDetailDispatchProps {
    getCheckinsByRange: Function;
    getStreakByHabit: Function;
    createCheckin: Function;
    getCheckinProofs: Function;
    fetchMedia: Function;
}

interface IStoreProps extends IHabitDetailDispatchProps {
    user: IUserState;
    habits: IHabitsState;
    content: any;
}

export interface IHabitDetailProps extends IStoreProps {
    navigation: any;
    route: {
        params: {
            habitGoalId: string;
        };
    };
}

interface IHabitDetailState {
    isRefreshing: boolean;
    isCheckinLoading: boolean;
    calendarMonth: Date;
    checkins: IHabitCheckin[];
    streak: IStreak | null;
    selectedDay: Date | null;
    selectedDayCheckin?: IHabitCheckin;
    dayProofs: IHabitCheckinProof[];
    isLoadingDayProofs: boolean;
    hasDayProofError: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
    // `content.media` is the path -> displayable-URL map `fetchMedia` fills.
    // Proofs live in the private bucket, so they cannot be built from a path
    // client-side the way public content can.
    content: state.content,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getCheckinsByRange: HabitActions.getCheckinsByRange,
    getStreakByHabit: HabitActions.getStreakByHabit,
    createCheckin: HabitActions.createCheckin,
    getCheckinProofs: HabitActions.getCheckinProofs,
    fetchMedia: MapActions.fetchMedia,
}, dispatch);

export class HabitDetail extends React.Component<IHabitDetailProps, IHabitDetailState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonsStyles();

    constructor(props: IHabitDetailProps) {
        super(props);

        const today = new Date();
        this.state = {
            isRefreshing: false,
            isCheckinLoading: false,
            calendarMonth: new Date(today.getFullYear(), today.getMonth(), 1),
            checkins: [],
            streak: null,
            selectedDay: null,
            selectedDayCheckin: undefined,
            dayProofs: [],
            isLoadingDayProofs: false,
            hasDayProofError: false,
        };

        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        const habitGoal = this.getHabitGoal();
        this.props.navigation.setOptions({
            title: habitGoal?.name || this.translate('pages.habits.detailTitle'),
        });

        this.handleRefresh();
    };

    getHabitGoal = (): IHabitGoal | undefined => {
        const { habits, route } = this.props;
        const { habitGoalId } = route.params;
        return habits.habitGoals.find((g: IHabitGoal) => g.id === habitGoalId);
    };

    getDateRange = (month: Date): { startDate: string; endDate: string } => {
        const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
        const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

        return {
            startDate: toLocalDateKey(startDate),
            endDate: toLocalDateKey(endDate),
        };
    };

    handleRefresh = () => {
        const { getCheckinsByRange, getStreakByHabit, route } = this.props;
        const { calendarMonth } = this.state;
        const { habitGoalId } = route.params;

        this.setState({ isRefreshing: true });

        const { startDate, endDate } = this.getDateRange(calendarMonth);

        Promise.all([
            getCheckinsByRange(startDate, endDate, habitGoalId),
            getStreakByHabit(habitGoalId),
        ]).then(([checkinsData, streakData]) => {
            this.setState({
                checkins: checkinsData || [],
                streak: streakData || null,
            });
        }).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    handleMonthChange = (month: Date) => {
        this.setState({ calendarMonth: month }, () => {
            this.handleRefresh();
        });
    };

    /**
     * Commits the check-in on the first tap — see the note on the dashboard's
     * `handleCheckin`. The proof sheet is offered afterwards, from the success
     * toast, rather than standing between the user and their streak.
     */
    handleCheckin = () => {
        this.submitCheckin();
    };

    /**
     * Opens the note/photo screen for the check-in that was just logged. This used to toggle a
     * bottom sheet in this screen's state; it is a route now, so back navigation works like the
     * rest of the app and the note field gets the whole screen. The screen owns the submit.
     */
    handleAddCheckinDetail = () => {
        Toast.hide();
        this.props.navigation.navigate('CheckinDetail', {
            habitGoalId: this.props.route.params.habitGoalId,
            habitName: this.getHabitGoal()?.name || '',
            source: 'habitDetail',
        });
    };

    /**
     * The one-tap check-in. Notes and photos go through the CheckinDetail screen, which does
     * its own POST, so this is always the bare "I did it".
     *
     * `scheduledDate` uses the same `toLocalDateKey` the month grid is rendered from, and that
     * agreement is the point. While the write went through `toISOString()` (the UTC day) and
     * the grid through local components, an evening check-in was written under one date and
     * drawn on the next day's cell. `timeZone` still travels so the service can resolve the
     * day itself for a client that sends no date.
     */
    submitCheckin = () => {
        const { createCheckin, route } = this.props;
        const { habitGoalId } = route.params;

        this.setState({ isCheckinLoading: true });

        const today = toLocalDateKey(new Date());

        createCheckin({
            habitGoalId,
            scheduledDate: today,
            localDate: today,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            status: 'completed',
        })
            .then((checkin: any) => {
                logAppEvent('habit_checkin_complete', {
                    userId: this.props.user?.details?.id,
                    source: 'habitDetail',
                    hasProof: false,
                });

                // A freeze was spent covering a day this user missed. Say so here rather than
                // leaving them to infer it from a streak number that did not drop — this is the
                // moment the safety net either becomes a known rule or stays invisible.
                //
                // The toast holds the celebration queue for as long as it is up, so a streak
                // celebration cannot pre-empt the offer to add a note. See
                // utilities/celebrationQueue.
                celebrationQueue.block();
                const freezeConsumed = getFreezeConsumed(checkin);
                showToast.success({
                    text1: freezeConsumed
                        ? this.translate('pages.habits.checkinToast.freezeUsedTitle', {
                            count: getStreakSavedByFreeze(checkin),
                        })
                        : this.translate('pages.habits.checkinToast.title', {
                            habitName: this.getHabitGoal()?.name || '',
                        }),
                    text2: freezeConsumed
                        ? this.translate('pages.habits.checkinToast.freezeUsedBody')
                        : this.translate('pages.habits.checkinToast.addDetailAction'),
                    duration: DURATION.LONG,
                    onPress: this.handleAddCheckinDetail,
                    onHide: () => celebrationQueue.unblock(),
                });

                enqueueStreakCelebration(checkin?.dailyStreak);
            })
            .catch((err) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: err?.message || this.translate('pages.habits.checkinProof.uploadFailed'),
                });
            })
            .finally(() => {
                this.setState({ isCheckinLoading: false });
                this.handleRefresh();
            });
    };

    /**
     * Opens the day-detail sheet.
     *
     * Every day opens, including days with no check-in — the sheet's empty
     * state distinguishes "nothing recorded" from "hasn't happened yet", and a
     * tap that does nothing on half the grid reads as a broken control.
     *
     * The check-in row is handed over from the month the calendar already
     * loaded rather than refetched; only proof paths need a round trip, and
     * only when the row says there are any.
     */
    handleDayPress = (date: Date, checkin?: IHabitCheckin) => {
        this.setState({
            selectedDay: date,
            selectedDayCheckin: checkin,
            dayProofs: [],
            hasDayProofError: false,
            isLoadingDayProofs: !!checkin?.hasProof,
        }, () => {
            if (checkin?.hasProof) {
                this.loadDayProofs(checkin.id);
            }
        });
    };

    /**
     * Fetch a check-in's proof rows, then resolve their paths to displayable
     * URLs.
     *
     * Two steps, not one: the users-service endpoint returns paths, and proofs
     * live in the *private* bucket, so a URL has to come from the maps-service
     * media endpoint (`fetchMedia`, which fills `content.media`). Building a
     * URL from the path client-side works only for public content.
     *
     * A failure in either step lands on the same error state — from the user's
     * side "the photo didn't load" is one outcome with one retry.
     */
    loadDayProofs = (checkinId: string) => {
        const { getCheckinProofs, fetchMedia } = this.props;

        this.setState({ isLoadingDayProofs: true, hasDayProofError: false });

        return getCheckinProofs(checkinId)
            .then((proofs: IHabitCheckinProof[]) => {
                // The sheet may have been closed, or another day opened, while
                // this was in flight. Writing the response in either case would
                // show one day's photos under another day's date.
                if (this.state.selectedDayCheckin?.id !== checkinId) {
                    return undefined;
                }

                const resolved = proofs || [];
                this.setState({ dayProofs: resolved });

                const mediaRequests = getProofMediaRequests(resolved);
                if (!mediaRequests.length) {
                    return undefined;
                }

                return fetchMedia(undefined, mediaRequests);
            })
            .catch(() => {
                if (this.state.selectedDayCheckin?.id === checkinId) {
                    this.setState({ hasDayProofError: true });
                }
            })
            .finally(() => {
                if (this.state.selectedDayCheckin?.id === checkinId) {
                    this.setState({ isLoadingDayProofs: false });
                }
            });
    };

    handleRetryDayProofs = () => {
        const { selectedDayCheckin } = this.state;

        if (selectedDayCheckin?.id) {
            this.loadDayProofs(selectedDayCheckin.id);
        }
    };

    handleDayDetailClose = () => {
        this.setState({
            selectedDay: null,
            selectedDayCheckin: undefined,
            dayProofs: [],
            isLoadingDayProofs: false,
            hasDayProofError: false,
        });
    };

    // Open the public post a shared check-in became. ViewThought renders the sparse thought
    // handed in immediately and merges its own (brand-scoped) fetch on top, so a bare id is
    // enough; `previousView` sends the back button here rather than to the author's profile.
    handleViewSharedPost = () => {
        const { navigation } = this.props;
        const { selectedDayCheckin } = this.state;
        const sharedThoughtId = selectedDayCheckin?.sharedThoughtId;

        if (!sharedThoughtId) {
            return;
        }

        this.handleDayDetailClose();
        navigation.navigate('ViewThought', {
            isMyContent: true,
            previousView: 'HabitDetail',
            thought: { id: sharedThoughtId },
        });
    };

    getTodayCheckin = (): IHabitCheckin | undefined => {
        const { habits, route } = this.props;
        const { habitGoalId } = route.params;
        return habits.todayCheckins.find((c: IHabitCheckin) => c.habitGoalId === habitGoalId);
    };

    render() {
        const { content, user } = this.props;
        const {
            isRefreshing,
            isCheckinLoading,
            calendarMonth,
            checkins,
            streak,
            selectedDay,
            selectedDayCheckin,
            dayProofs,
            isLoadingDayProofs,
            hasDayProofError,
        } = this.state;

        const resolvedDayProofs = resolveProofUris(dayProofs, content?.media || {});

        const habitGoal = this.getHabitGoal();
        const todayCheckin = this.getTodayCheckin();
        const isCompletedToday = todayCheckin?.status === 'completed';

        if (!habitGoal) {
            return (
                <>
                    <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                    <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                        <View style={this.themeHabits.styles.emptyStateContainer}>
                            <Text style={this.themeHabits.styles.emptyStateTitle}>
                                {this.translate('pages.habits.habitNotFound')}
                            </Text>
                        </View>
                    </SafeAreaView>
                    {/* A habit reached by a stale deep link or notification may not resolve;
                        the menu is the way back to a main page rather than a dead end. */}
                    <MainButtonMenu
                        navigation={this.props.navigation}
                        onActionButtonPress={this.handleRefresh}
                        translate={this.translate}
                        user={user}
                        themeMenu={this.themeMenu}
                    />
                </>
            );
        }

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                {/* `edges={[]}`: Layout pads the header and the MainButtonMenu below pads
                    the bottom, so this view applies no inset of its own. The ScrollView
                    reserves `buttonMenuHeight` of bottom padding so its last row clears the
                    fixed menu. */}
                <SafeAreaView
                    edges={[]}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handleRefresh}
                            />
                        }
                    >
                        <View style={this.themeHabits.styles.habitCardContainer}>
                            <View style={this.themeHabits.styles.habitCardHeader}>
                                <Text style={this.themeHabits.styles.habitCardEmoji}>
                                    {habitGoal.emoji || '\uD83C\uDFAF'}
                                </Text>
                                <View style={this.themeHabits.styles.habitCardTitleContainer}>
                                    <Text style={this.themeHabits.styles.habitCardTitle}>
                                        {habitGoal.name}
                                    </Text>
                                    {habitGoal.description && (
                                        <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                            {habitGoal.description}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <CheckinButton
                                isCompleted={isCompletedToday}
                                isLoading={isCheckinLoading}
                                onPress={this.handleCheckin}
                                onAddDetail={this.handleAddCheckinDetail}
                                addDetailTitle={this.translate('pages.habits.checkinProof.addDetailButton')}
                                title={this.translate('pages.habits.checkin')}
                                completedTitle={this.translate('pages.habits.completed')}
                                themeHabits={this.themeHabits}
                            />
                        </View>

                        {streak && streak.currentStreak > 0 && (
                            <StreakWidget
                                streak={streak}
                                title={this.translate('pages.habits.currentStreak')}
                                themeHabits={this.themeHabits}
                                translate={this.translate}
                            />
                        )}

                        <HabitCalendar
                            checkins={checkins}
                            month={calendarMonth}
                            onMonthChange={this.handleMonthChange}
                            onDayPress={this.handleDayPress}
                            themeHabits={this.themeHabits}
                            translate={this.translate}
                        />

                        {streak && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.habits.stats')}
                                </Text>
                                <View style={this.themeHabits.styles.pactComparisonContainer}>
                                    <View style={this.themeHabits.styles.pactComparisonItem}>
                                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                                            {streak.longestStreak}
                                        </Text>
                                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                                            {this.translate('pages.habits.longestStreak')}
                                        </Text>
                                    </View>
                                    <View style={this.themeHabits.styles.pactComparisonItem}>
                                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                                            {streak.gracePeriodDays - streak.graceDaysUsed}
                                        </Text>
                                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                                            {this.translate('pages.habits.graceDays')}
                                        </Text>
                                    </View>
                                </View>
                                {/*
                                  * The number on its own reads as a score. It is
                                  * a rule, and it only changes behaviour if the
                                  * user knows the terms before the day they need
                                  * it.
                                  */}
                                <Text style={[
                                    this.themeHabits.styles.streakMilestoneText,
                                    { marginTop: 8 },
                                ]}>
                                    {this.translate('pages.habits.streak.freezeRule', streakFreezeRuleParams)}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={this.props.navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
                <CheckinDayDetailSheet
                    isVisible={!!selectedDay}
                    date={selectedDay}
                    checkin={selectedDayCheckin}
                    proofs={resolvedDayProofs}
                    // Still loading while the paths are back but their URLs are
                    // not: `content.media` fills asynchronously, and treating
                    // that gap as "done" flashes the unavailable state.
                    isLoadingProofs={isLoadingDayProofs
                        || (!!selectedDayCheckin?.hasProof
                            && !!dayProofs.length
                            && !resolvedDayProofs.length)}
                    hasProofError={hasDayProofError}
                    onClose={this.handleDayDetailClose}
                    onRetryProofs={this.handleRetryDayProofs}
                    onViewSharedPost={selectedDayCheckin?.sharedThoughtId
                        ? this.handleViewSharedPost
                        : undefined}
                    translate={this.translate}
                    themeConfirmModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitDetail);
