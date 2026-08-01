import React from 'react';
import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import RNFB from 'react-native-blob-util';
import { FilePaths } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IStreak, IIdentitySnapshot } from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import BaseStatusBar from '../../components/BaseStatusBar';
import {
    CheckinButton,
    CheckinProofSheet,
    HabitCalendar,
    IdentityCard,
    IdentityPromptSheet,
    StreakWidget,
} from '../../components/Habits';
import { ISelectedProofImage } from '../../components/Habits/CheckinProofSheet';
import { IdentityPromptMode } from '../../components/Habits/IdentityPromptSheet';
import { signImageUrl } from '../../utilities/content';
import { showToast } from '../../utilities/toasts';

interface IHabitDetailDispatchProps {
    getCheckinsByRange: Function;
    getStreakByHabit: Function;
    createCheckin: Function;
    getIdentityByHabit: Function;
    setIdentityLabel: Function;
    createIdentityReflection: Function;
}

interface IStoreProps extends IHabitDetailDispatchProps {
    user: IUserState;
    habits: IHabitsState;
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
    identity: IIdentitySnapshot | null;
    isProofSheetVisible: boolean;
    /** null when no identity prompt is open. */
    identityPrompt: {
        mode: IdentityPromptMode;
        promptKey?: string;
        reflectionType?: string;
        checkinId?: string;
    } | null;
    isIdentitySubmitting: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getCheckinsByRange: HabitActions.getCheckinsByRange,
    getStreakByHabit: HabitActions.getStreakByHabit,
    createCheckin: HabitActions.createCheckin,
    getIdentityByHabit: HabitActions.getIdentityByHabit,
    setIdentityLabel: HabitActions.setIdentityLabel,
    createIdentityReflection: HabitActions.createIdentityReflection,
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
            identity: null,
            isProofSheetVisible: false,
            identityPrompt: null,
            isIdentitySubmitting: false,
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
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        };
    };

    handleRefresh = () => {
        const {
            getCheckinsByRange,
            getStreakByHabit,
            getIdentityByHabit,
            route,
        } = this.props;
        const { calendarMonth } = this.state;
        const { habitGoalId } = route.params;

        this.setState({ isRefreshing: true });

        const { startDate, endDate } = this.getDateRange(calendarMonth);

        Promise.all([
            getCheckinsByRange(startDate, endDate, habitGoalId),
            getStreakByHabit(habitGoalId),
            getIdentityByHabit(habitGoalId),
        ]).then(([checkinsData, streakData, identityData]) => {
            this.setState({
                checkins: checkinsData || [],
                streak: streakData || null,
                identity: identityData || null,
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

    handleCheckin = () => {
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
        const { createCheckin, route } = this.props;
        const { habitGoalId } = route.params;

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
            .then((response: any) => this.handleIdentityOutcome(response?.identity))
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
     * React to the identity payload the check-in response carries.
     *
     * A stage-up is celebrated immediately — it is the moment the app gets to tell
     * someone they are no longer just doing the thing. The reflection prompt is
     * opened after, and only when the server picked one; it enforces the cooldowns
     * so the client never decides to ask on its own.
     */
    handleIdentityOutcome = (identity?: any) => {
        if (!identity) {
            return;
        }

        this.setState({ identity });

        if (identity.stageAdvancedTo != null && identity.evaluation?.stageKey) {
            showToast.success({
                text1: this.translate('pages.habits.identity.stageUpTitle'),
                text2: this.translate(
                    `pages.habits.identity.stages.${identity.evaluation.stageKey}.stageUpBody`,
                ),
            });
        }

        if (identity.prompt) {
            this.setState({
                identityPrompt: {
                    mode: identity.prompt.responseFormat === 'scale' ? 'scale' : 'text',
                    promptKey: identity.prompt.promptKey,
                    reflectionType: identity.prompt.type,
                },
            });
        }
    };

    handleNameIdentity = () => {
        this.setState({ identityPrompt: { mode: 'label' } });
    };

    handleIdentityPromptCancel = () => {
        this.setState({ identityPrompt: null });
    };

    handleIdentityPromptConfirm = ({ text, score }: { text?: string; score?: number }) => {
        const { setIdentityLabel, createIdentityReflection, route } = this.props;
        const { identityPrompt } = this.state;
        const { habitGoalId } = route.params;

        if (!identityPrompt) {
            return;
        }

        this.setState({ isIdentitySubmitting: true });

        const request = identityPrompt.mode === 'label'
            ? setIdentityLabel(habitGoalId, text)
            : createIdentityReflection(habitGoalId, {
                reflectionType: identityPrompt.reflectionType,
                responseText: text,
                responseScore: score,
                checkinId: identityPrompt.checkinId,
            });

        request
            .then((snapshot: IIdentitySnapshot) => {
                if (snapshot) {
                    this.setState({ identity: snapshot });
                }
            })
            .catch((err: any) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: err?.message || this.translate('pages.habits.identity.saveFailed'),
                });
            })
            .finally(() => {
                this.setState({ isIdentitySubmitting: false, identityPrompt: null });
            });
    };

    handleDayPress = (date: Date, checkin?: IHabitCheckin) => {
        // Could show a modal with checkin details or allow editing
        if (checkin) {
            // Show checkin details
        }
    };

    getTodayCheckin = (): IHabitCheckin | undefined => {
        const { habits, route } = this.props;
        const { habitGoalId } = route.params;
        return habits.todayCheckins.find((c: IHabitCheckin) => c.habitGoalId === habitGoalId);
    };

    render() {
        const { user } = this.props;
        const {
            isRefreshing,
            isCheckinLoading,
            calendarMonth,
            checkins,
            streak,
            identity,
            isProofSheetVisible,
            identityPrompt,
            isIdentitySubmitting,
        } = this.state;

        const habitGoal = this.getHabitGoal();
        const todayCheckin = this.getTodayCheckin();
        const isCompletedToday = todayCheckin?.status === 'completed';

        if (!habitGoal) {
            return (
                <SafeAreaView style={this.theme.styles.safeAreaView}>
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
                <SafeAreaView style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}>
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

                        {/* Above the streak on purpose: the streak is the number
                            that resets, this is the one that doesn't. */}
                        <IdentityCard
                            snapshot={identity}
                            onNameIdentity={this.handleNameIdentity}
                            themeHabits={this.themeHabits}
                            translate={this.translate}
                        />

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
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
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
                <IdentityPromptSheet
                    isVisible={!!identityPrompt}
                    isSubmitting={isIdentitySubmitting}
                    mode={identityPrompt?.mode || 'label'}
                    promptKey={identityPrompt?.promptKey}
                    initialValue={identityPrompt?.mode === 'label' ? identity?.progress?.identityLabel : undefined}
                    habitName={habitGoal.name}
                    onCancel={this.handleIdentityPromptCancel}
                    onConfirm={this.handleIdentityPromptConfirm}
                    translate={this.translate}
                    themeHabits={this.themeHabits}
                    themeConfirmModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitDetail);
