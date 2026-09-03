import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import RNFB from 'react-native-blob-util';
import { FilePaths } from 'therr-js-utilities/constants';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { HabitActions, MapActions } from 'therr-react/redux/actions';
import {
    IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IHabitCheckinProof, IStreak,
} from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import BaseStatusBar from '../../components/BaseStatusBar';
import {
    CheckinButton, CheckinDayDetailSheet, CheckinProofSheet, HabitCalendar, StreakWidget,
} from '../../components/Habits';
import { getProofMediaRequests, resolveProofUris } from './checkinDayDetail';
import {
    getFreezeConsumed,
    getStreakSavedByFreeze,
    streakFreezeRuleParams,
} from '../../utilities/streakFreezes';
import { ISelectedProofImage } from '../../components/Habits/CheckinProofSheet';
import { signImageUrl } from '../../utilities/content';
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
    isProofSheetVisible: boolean;
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
            isProofSheetVisible: false,
            selectedDay: null,
            selectedDayCheckin: undefined,
            dayProofs: [],
            isLoadingDayProofs: false,
            hasDayProofError: false,
        };

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
        this.submitCheckin({});
    };

    handleAddCheckinDetail = () => {
        Toast.hide();
        this.setState({ isProofSheetVisible: true });
    };

    handleProofSheetCancel = () => {
        this.setState({ isProofSheetVisible: false });
    };

    uploadProofImage = (habitGoalId: string, image: ISelectedProofImage): Promise<{ path: string; type: 'image'; fileSizeBytes?: number }> => {
        const extSplit = image.path?.split('.');
        const fileExtension = extSplit && extSplit.length > 1 ? extSplit[extSplit.length - 1] : 'jpeg';
        const filename = `${FilePaths.CONTENT}/habits_proof_${habitGoalId}_${Date.now()}.${fileExtension}`;

        return signImageUrl(false, { action: 'write', filename }).then((response: any) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];
            const storedPath = response?.data?.path;
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': image.mime,
                    'Content-Length': image.size.toString(),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(image.path),
            ).then(() => ({
                path: storedPath,
                type: 'image' as const,
                fileSizeBytes: image.size,
            }));
        });
    };

    handleProofSheetConfirm = ({ notes, image }: { notes?: string; image?: ISelectedProofImage }) => {
        this.submitCheckin({ notes, image });
    };

    /**
     * The single write path for both entry points. `scheduledDate` stays on the
     * UTC calendar day: users-service defines a habit day in UTC
     * (`getTodayDateString`), so the local-calendar `toLocalDateKey` used to
     * render the month grid must not be used for the write.
     */
    submitCheckin = ({ notes, image }: { notes?: string; image?: ISelectedProofImage }) => {
        const { createCheckin, route } = this.props;
        const { habitGoalId } = route.params;
        const isAddingDetail = !!notes || !!image;

        this.setState({ isCheckinLoading: true });

        const today = new Date().toISOString().split('T')[0];

        const uploadPromise = image
            ? this.uploadProofImage(habitGoalId, image).then((media) => [media])
            : Promise.resolve(undefined);

        uploadPromise
            .then((proofMedias) => createCheckin({
                habitGoalId,
                scheduledDate: today,
                status: 'completed',
                notes,
                proofMedias,
            }))
            .then((checkin: any) => {
                if (isAddingDetail) {
                    showToast.success({
                        text1: this.translate('pages.habits.checkinToast.detailSavedTitle'),
                    });
                    return;
                }

                // See the note on the same event in Habits/Dashboard.tsx: the
                // isAddingDetail path above is a second call attaching proof to
                // the check-in this one created, so only this branch counts.
                logEvent(getAnalytics(), 'habit_checkin_complete', {
                    userId: this.props.user?.details?.id,
                    source: 'habitDetail',
                    hasProof: false,
                }).catch((err) => console.log(err));

                // A freeze was spent covering a day this user missed. Say so
                // here rather than leaving them to infer it from a streak
                // number that did not drop — this is the moment the safety net
                // either becomes a known rule or stays invisible.
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
                });
            })
            .catch((err) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: err?.message || this.translate('pages.habits.checkinProof.uploadFailed'),
                });
            })
            .finally(() => {
                this.setState({
                    isCheckinLoading: false,
                    isProofSheetVisible: false,
                });
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
            isProofSheetVisible,
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
                <SafeAreaView edges={['bottom']} style={this.theme.styles.safeAreaView}>
                    <View style={this.themeHabits.styles.emptyStateContainer}>
                        <Text style={this.themeHabits.styles.emptyStateTitle}>
                            {this.translate('pages.habits.habitNotFound')}
                        </Text>
                    </View>
                </SafeAreaView>
            );
        }

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                {/* `edges={['bottom']}`: Layout pads the header, but this screen has no
                    ButtonMenu and its ScrollView runs to the bottom edge. React Native's
                    own SafeAreaView is a no-op on Android, so that last row sat under the
                    gesture handle. */}
                <SafeAreaView
                    edges={['bottom']}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView
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
                    translate={this.translate}
                    themeConfirmModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
                <CheckinProofSheet
                    isVisible={isProofSheetVisible}
                    isSubmitting={isCheckinLoading}
                    habitName={habitGoal.name}
                    userId={user?.details?.id}
                    onCancel={this.handleProofSheetCancel}
                    onConfirm={this.handleProofSheetConfirm}
                    translate={this.translate}
                    themeConfirmModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitDetail);
