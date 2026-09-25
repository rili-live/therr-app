import React from 'react';
import {
    View, Text, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions, MapActions } from 'therr-react/redux/actions';
import {
    IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IHabitCheckinProof, IStreak,
    IUserHabit, UserHabitNotificationCategory,
} from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { HabitGoalTypes, hasReachedSavingsTarget } from 'therr-js-utilities/constants';
import { formatSavingsAmount, getSavingsProgressFraction } from '../../utilities/savingsFormat';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles, buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import BaseModal from '../../components/Modals/BaseModal';
import ModalButton from '../../components/Modals/ModalButton';
import {
    CheckinButton, CheckinDayDetailSheet, HabitCalendar, HabitNotificationSettings, StreakWidget,
} from '../../components/Habits';
import CadencePicker from '../../components/Habits/CadencePicker';
import {
    canEditCadence,
    fromGoal as cadenceFromGoal,
    isComplete as isCadenceComplete,
    isSameCadence,
    toGoalFields as cadenceToGoalFields,
    CadenceChoice,
} from '../Pacts/cadenceOptions';
import { getProofMediaRequests, resolveProofUris } from './checkinDayDetail';
import {
    getFreezeConsumed,
    getStreakSavedByFreeze,
    streakFreezeRuleParams,
} from '../../utilities/streakFreezes';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { getHabitCapPaywallParams } from '../../utilities/habitCapPaywall';
import celebrationQueue, { enqueueStreakCelebration } from '../../utilities/celebrationQueue';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { toLocalDateKey } from '../../utilities/localDateKey';
import { DURATION, showToast } from '../../utilities/toasts';

/** Sunday-first, matching `targetDaysOfWeek` and the `daysOfWeekShort` dictionary. */
const CADENCE_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface IHabitDetailDispatchProps {
    getCheckinsByRange: Function;
    getStreakByHabit: Function;
    createCheckin: Function;
    getCheckinProofs: Function;
    fetchMedia: Function;
    getUserHabits: Function;
    archiveUserHabit: Function;
    updateHabitNotificationPreferences: Function;
    updateGoal: Function;
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
    /** True while the archive confirmation modal is up. */
    isConfirmingArchive: boolean;
    isArchiving: boolean;
    /**
     * The cadence editor. `draftCadence` is null while the sheet is closed — it is seeded from
     * the goal on open rather than kept in sync, so a refresh landing mid-edit cannot overwrite
     * what the user is in the middle of choosing.
     */
    draftCadence: CadenceChoice | null;
    isSavingCadence: boolean;
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
    getUserHabits: HabitActions.getUserHabits,
    archiveUserHabit: HabitActions.archiveUserHabit,
    updateHabitNotificationPreferences: HabitActions.updateHabitNotificationPreferences,
    updateGoal: HabitActions.updateGoal,
}, dispatch);

export class HabitDetail extends React.Component<IHabitDetailProps, IHabitDetailState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonsStyles();
    /**
     * Set on teardown so the archive write, which pops this screen on success,
     * does not then set state on an unmounted component.
     */
    private isUnmounted = false;

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
            isConfirmingArchive: false,
            isArchiving: false,
            draftCadence: null,
            isSavingCadence: false,
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

    componentWillUnmount() {
        this.isUnmounted = true;
    }

    getHabitGoal = (): IHabitGoal | undefined => {
        const { habits, route } = this.props;
        const { habitGoalId } = route.params;
        return habits.habitGoals.find((g: IHabitGoal) => g.id === habitGoalId);
    };

    /**
     * The tracking row for this habit — the thing archive and the notification
     * switches actually address. Keyed on the goal, because that is all the route
     * carries and it is what the user tapped.
     *
     * Not guaranteed to be loaded: this screen is reachable from a push
     * notification deep link with nothing else fetched. Both features render only
     * once it resolves, rather than guessing an id.
     */
    /**
     * The running total for a savings habit, on the solo/habit view.
     *
     * Deliberately simpler than the pact card: there is one participant, so there is no
     * breakdown to show and the per-member/group distinction collapses — both scopes
     * compute the same number for one person.
     *
     * `totalSaved` is absent on a response from a users-service that predates the
     * feature. That is "unknown", not zero, so the card is not rendered at all rather
     * than claiming the user has saved nothing.
     */
    renderSavingsCard = (userHabit?: IUserHabit) => {
        if (userHabit?.goalType !== HabitGoalTypes.SAVINGS_GOAL || userHabit.totalSaved === undefined) {
            return null;
        }

        const { totalSaved, targetAmount, currencyCode } = userHabit;
        const locale = this.props.user?.settings?.locale;
        const fraction = getSavingsProgressFraction(totalSaved, targetAmount);
        const hasReached = hasReachedSavingsTarget(totalSaved, targetAmount);

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <Text style={this.themeHabits.styles.streakWidgetTitle}>
                    {this.translate('pages.habits.savings.cardTitle')}
                </Text>
                <Text style={{ fontSize: 30, fontWeight: '700', paddingTop: 4 }}>
                    {formatSavingsAmount(totalSaved, currencyCode, locale)}
                </Text>
                <Text style={this.themeHabits.styles.habitCardSubtitle}>
                    {targetAmount
                        ? this.translate('pages.habits.savings.totalSavedOfTarget', {
                            target: formatSavingsAmount(targetAmount, currencyCode, locale),
                        })
                        : this.translate('pages.habits.savings.totalSavedNoTarget')}
                </Text>
                {fraction !== null && (
                    <View
                        accessibilityRole="progressbar"
                        style={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: 'rgba(0,0,0,0.12)',
                            marginTop: 12,
                            overflow: 'hidden',
                        }}
                    >
                        <View
                            style={{
                                height: 8,
                                borderRadius: 4,
                                width: `${Math.round(fraction * 100)}%`,
                                backgroundColor: this.themeHabits.colors.primary3,
                            }}
                        />
                    </View>
                )}
                {hasReached && (
                    <Text
                        style={{
                            paddingTop: 8,
                            fontSize: 14,
                            fontWeight: '600',
                            color: this.themeHabits.colors.alertSuccess,
                        }}
                    >
                        {this.translate('pages.habits.savings.goalReached')}
                    </Text>
                )}
            </View>
        );
    };

    getUserHabit = (): IUserHabit | undefined => {
        const { habits, route } = this.props;
        const { habitGoalId } = route.params;
        return (habits.userHabits || []).find((h: IUserHabit) => h.habitGoalId === habitGoalId);
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
        const {
            getCheckinsByRange, getStreakByHabit, getUserHabits, route,
        } = this.props;
        const { calendarMonth } = this.state;
        const { habitGoalId } = route.params;

        this.setState({ isRefreshing: true });

        const { startDate, endDate } = this.getDateRange(calendarMonth);

        Promise.all([
            getCheckinsByRange(startDate, endDate, habitGoalId),
            getStreakByHabit(habitGoalId),
            // The tracking rows, for archive and the notification switches. Fetched
            // here rather than only on the dashboard because this screen is a push
            // deep-link target: arriving from a notification, nothing else has run.
            // A failure only costs those two controls, so it must not take the
            // calendar down with it.
            getUserHabits().catch(() => undefined),
        ]).then(([checkinsData, streakData]) => {
            this.setState({
                checkins: checkinsData || [],
                streak: streakData || null,
            });
        }).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    /**
     * The cadence in words, for the stats row. Reads through `cadenceFromGoal` so the label and
     * the schedule the server actually keeps cannot drift — see `routes/Pacts/cadenceOptions`.
     */
    describeCadence = (habitGoal: IHabitGoal): string => {
        const cadence = cadenceFromGoal(habitGoal);

        if (cadence.kind === 'weekdays') {
            return cadence.days
                .map((d) => this.translate(`pages.habits.daysOfWeekShort.${CADENCE_DAY_KEYS[d]}`))
                .join(', ');
        }
        if (cadence.kind === 'weeklyCount') {
            return this.translate('pages.habits.frequency.weekly', { count: cadence.count });
        }
        return this.translate('pages.habits.frequency.daily');
    };

    handleEditCadencePress = () => {
        const habitGoal = this.getHabitGoal();
        if (!canEditCadence(habitGoal, this.props.user?.details?.id)) {
            return;
        }
        this.setState({ draftCadence: cadenceFromGoal(habitGoal) });
    };

    handleCancelCadence = () => {
        this.setState({ draftCadence: null });
    };

    handleDraftCadenceChange = (draftCadence: CadenceChoice) => {
        this.setState({ draftCadence });
    };

    /**
     * Save the new cadence.
     *
     * Forward-only, which the confirm copy states before the user commits: the server stamps
     * `cadenceEffectiveFrom` and never re-judges a day lived under the old schedule, so the
     * running streak survives. Dialling a habit back after an injury should not cost the streak
     * that motivated it.
     *
     * An unchanged cadence short-circuits rather than sending a no-op PUT — the request would
     * still stamp a new effective-from date, which quietly moves the boundary the server
     * refuses to evaluate before.
     */
    handleSaveCadence = () => {
        const { updateGoal, getUserHabits } = this.props;
        const habitGoal = this.getHabitGoal();
        const { draftCadence } = this.state;

        if (!habitGoal || !draftCadence || !isCadenceComplete(draftCadence)) {
            return;
        }

        if (isSameCadence(draftCadence, cadenceFromGoal(habitGoal))) {
            this.setState({ draftCadence: null });
            return;
        }

        this.setState({ isSavingCadence: true });

        updateGoal(habitGoal.id, cadenceToGoalFields(draftCadence))
            .then(() => {
                // Closed only on success. A failed save leaves the editor open on the user's
                // draft, so they can retry instead of rebuilding the schedule from scratch.
                if (!this.isUnmounted) {
                    this.setState({ draftCadence: null });
                }
                showToast.success({
                    text1: this.translate('pages.habits.cadence.editSaved'),
                });
                // `updateGoal` replaces the row in `habits.habitGoals`, which is what this
                // screen reads — so the label here is already right. The dashboard's cards
                // read `habits.userHabits`, where the same three cadence columns arrive
                // *joined onto* the tracking row, and nothing in that action touches them.
                // Without this the user would go back and see the schedule they just changed.
                return getUserHabits().catch(() => undefined);
            })
            .catch(() => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.habits.cadence.editFailed'),
                });
            })
            .finally(() => {
                if (!this.isUnmounted) {
                    this.setState({ isSavingCadence: false });
                }
            });
    };

    handleArchivePress = () => {
        this.setState({ isConfirmingArchive: true });
    };

    handleCancelArchive = () => {
        this.setState({ isConfirmingArchive: false });
    };

    /**
     * Archive, not delete. The row stays and every check-in, streak and journal
     * entry attached to the habit goal survives — so this is reversible from the
     * archived list, and it frees a slot against the free-tier habit cap.
     *
     * Navigates back on success: the screen the user is standing on is about a
     * habit that is no longer in their active list, and leaving them there with a
     * stale calendar invites them to check into something they just archived.
     */
    handleConfirmArchive = () => {
        const { archiveUserHabit, navigation } = this.props;
        const userHabit = this.getUserHabit();

        if (!userHabit) {
            this.setState({ isConfirmingArchive: false });
            return;
        }

        this.setState({ isConfirmingArchive: false, isArchiving: true });

        archiveUserHabit(userHabit.id)
            .then(() => {
                showToast.success({
                    text1: this.translate('pages.habits.habitArchived.successTitle'),
                    text2: this.translate('pages.habits.habitArchived.successMessage'),
                });
                navigation.goBack();
            })
            .catch(() => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.habits.habitArchived.errorMessage'),
                });
            })
            .finally(() => {
                // Guarded because the success path above pops this screen — a bare
                // setState here would write into a torn-down tree on every
                // successful archive, which is the common case rather than the edge.
                if (!this.isUnmounted) {
                    this.setState({ isArchiving: false });
                }
            });
    };

    /**
     * One category at a time, and only that category in the body — the endpoint
     * writes a partial, so sending the whole set would let this screen reset a
     * category a newer build knows about and this one does not.
     *
     * Rethrows so `HabitNotificationSettings` can revert its optimistic flip; a
     * swallowed rejection leaves the switch showing a value the server never took.
     */
    handleNotificationPreferenceChange = (
        category: UserHabitNotificationCategory,
        nextValue: boolean,
    ): Promise<any> => {
        const { updateHabitNotificationPreferences } = this.props;
        const userHabit = this.getUserHabit();

        if (!userHabit) {
            return Promise.reject(new Error('No tracking row for this habit'));
        }

        return updateHabitNotificationPreferences(userHabit.id, { [category]: nextValue })
            .catch((err: any) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.habits.notificationPrefs.saveFailed'),
                });
                throw err;
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
        const habitGoal = this.getHabitGoal();

        this.props.navigation.navigate('CheckinDetail', {
            habitGoalId: this.props.route.params.habitGoalId,
            habitName: habitGoal?.name || '',
            source: 'habitDetail',
            goalType: habitGoal?.goalType,
            currencyCode: habitGoal?.currencyCode,
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
                // A 402 is the free-tier cap refusing to start tracking this goal —
                // route to the offer rather than reporting a failure.
                const paywallParams = getHabitCapPaywallParams(err, 'habit-detail');
                if (paywallParams) {
                    this.props.navigation.navigate('UpgradePaywall', paywallParams);
                    return;
                }

                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    // A 5xx body is an internal grep token, not copy. See
                    // utilities/apiErrorMessage.
                    text2: getApiErrorMessage(err) || this.translate('pages.habits.checkinError'),
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
            isConfirmingArchive,
            isArchiving,
            draftCadence,
            isSavingCadence,
        } = this.state;

        const resolvedDayProofs = resolveProofUris(dayProofs, content?.media || {});

        const habitGoal = this.getHabitGoal();
        const userHabit = this.getUserHabit();
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

                        {this.renderSavingsCard(userHabit)}

                        {streak && streak.currentStreak > 0 && (
                            <StreakWidget
                                streak={streak}
                                title={this.translate('pages.habits.currentStreak')}
                                cadenceKind={cadenceFromGoal(habitGoal).kind}
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
                                        {/*
                                          * Coerced and clamped, not subtracted raw. A habit with
                                          * no streak row yet — every habit, between being created
                                          * and being checked into once — used to make this tile
                                          * read "NaN", because the endpoint's placeholder carried
                                          * no grace fields and `undefined - undefined` is NaN.
                                          *
                                          * The server-side fix (getStreakByHabit now returns the
                                          * allowance a new streak starts with) is the real one;
                                          * this stays because the screen cannot control which
                                          * build of the API it is talking to, and a stat tile is
                                          * the wrong place to find out.
                                          */}
                                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                                            {Math.max(
                                                0,
                                                (Number(streak.gracePeriodDays) || 0)
                                                    - (Number(streak.graceDaysUsed) || 0),
                                            )}
                                        </Text>
                                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                                            {this.translate('pages.habits.graceDays')}
                                        </Text>
                                    </View>
                                </View>
                                {/*
                                  * The cadence sits in the stats block rather than the header
                                  * because it is now the thing the freeze rule below is stated
                                  * against: "days your cadence does not ask for cost nothing"
                                  * means nothing without saying what it asks for.
                                  */}
                                <View style={this.themeHabits.styles.cadenceRow}>
                                    <Text style={this.themeHabits.styles.cadenceRowLabel}>
                                        {this.translate('pages.habits.cadence.sectionLabel')}
                                    </Text>
                                    <Text style={this.themeHabits.styles.cadenceRowValue}>
                                        {this.describeCadence(habitGoal)}
                                    </Text>
                                    {canEditCadence(habitGoal, this.props.user?.details?.id) && (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={this.translate('pages.habits.cadence.editTitle')}
                                            onPress={this.handleEditCadencePress}
                                            style={({ pressed }) => [
                                                this.themeHabits.styles.cadenceRowEditButton,
                                                pressed && this.themeHabits.styles.pressedOpacity,
                                            ]}
                                        >
                                            <Text style={this.themeHabits.styles.cadenceRowEditText}>
                                                {this.translate('pages.habits.cadence.editTitle')}
                                            </Text>
                                        </Pressable>
                                    )}
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

                        {/*
                          * Both of these address the tracking row rather than the goal, so
                          * they wait for it. `userHabit` is undefined for the first render
                          * of a deep link, and briefly on a cold open.
                          */}
                        <HabitNotificationSettings
                            userHabit={userHabit}
                            onChange={this.handleNotificationPreferenceChange}
                            themeHabits={this.themeHabits}
                            translate={this.translate}
                        />

                        {/*
                          * Archiving was reachable from exactly one place — the
                          * "continue solo or archive?" prompt on a habit whose invite
                          * nobody had answered — so a habit the user simply stopped
                          * doing could not be put away at all. The detail screen is
                          * where someone goes when they are done with a habit, so the
                          * action lives here, under everything else, with the hint that
                          * it keeps the history.
                          */}
                        {!!userHabit && userHabit.status === 'active' && (
                            <View style={this.themeHabits.styles.habitDangerZone}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={this.translate('pages.habits.archiveHabit')}
                                    disabled={isArchiving}
                                    style={({ pressed }) => [
                                        this.themeHabits.styles.habitArchiveAction,
                                        (pressed || isArchiving) && this.themeHabits.styles.pressedOpacity,
                                    ]}
                                    onPress={this.handleArchivePress}
                                >
                                    <Text style={this.themeHabits.styles.habitArchiveActionText}>
                                        {this.translate('pages.habits.archiveHabit')}
                                    </Text>
                                </Pressable>
                                <Text style={this.themeHabits.styles.habitArchiveHint}>
                                    {this.translate('pages.habits.habitArchived.hint')}
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
                {/*
                  * Forward-only, and the copy says so before the user commits rather than after.
                  * Someone dialling a habit back mid-injury is exactly the person who would
                  * otherwise not touch this at all, for fear of what it does to their streak.
                  */}
                <BaseModal
                    isVisible={!!draftCadence}
                    onDismiss={this.handleCancelCadence}
                    headerText={this.translate('pages.habits.cadence.editTitle')}
                    actions={(
                        <>
                            <ModalButton
                                title={this.translate('pages.habits.cadence.editCancel')}
                                iconName="close"
                                iconRight={false}
                                onPress={this.handleCancelCadence}
                                themeButtons={this.themeButtons}
                                disabled={isSavingCadence}
                            />
                            <ModalButton
                                title={this.translate('pages.habits.cadence.editSave')}
                                iconName="check"
                                iconRight={false}
                                onPress={this.handleSaveCadence}
                                themeButtons={this.themeButtons}
                                loading={isSavingCadence}
                                disabled={isSavingCadence || !draftCadence || !isCadenceComplete(draftCadence)}
                            />
                        </>
                    )}
                >
                    {draftCadence && (
                        <>
                            <CadencePicker
                                value={draftCadence}
                                onChange={this.handleDraftCadenceChange}
                                hideLabel
                                themeHabits={this.themeHabits}
                                translate={this.translate}
                            />
                            <Text style={this.themeHabits.styles.cadenceHint}>
                                {this.translate('pages.habits.cadence.editForwardOnly')}
                            </Text>
                        </>
                    )}
                </BaseModal>

                <ConfirmModal
                    isVisible={isConfirmingArchive}
                    onCancel={this.handleCancelArchive}
                    onConfirm={this.handleConfirmArchive}
                    text={this.translate('pages.habits.habitArchived.confirm')}
                    textConfirm={this.translate('pages.habits.habitArchived.confirmButton')}
                    textCancel={this.translate('modals.confirmModal.cancel')}
                    translate={this.translate}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitDetail);
