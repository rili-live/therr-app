import React from 'react';
import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import RNFB from 'react-native-blob-util';
import { FilePaths } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IStreak } from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import BaseStatusBar from '../../components/BaseStatusBar';
import { HabitCard, CheckinProofSheet } from '../../components/Habits';
import { ISelectedProofImage } from '../../components/Habits/CheckinProofSheet';
import PactOnboardingGuard from '../../components/Habits/PactOnboardingGuard';
import { signImageUrl } from '../../utilities/content';
import { showToast } from '../../utilities/toasts';
import { IHabitWithPactState, splitHabitsByPactState } from './pactState';

interface IHabitsDashboardDispatchProps {
    getUserGoals: Function;
    getTodayCheckins: Function;
    getActiveStreaks: Function;
    getActivePacts: Function;
    getUserPacts: Function;
    createCheckin: Function;
}

interface IStoreProps extends IHabitsDashboardDispatchProps {
    user: IUserState;
    habits: IHabitsState;
}

export interface IHabitsDashboardProps extends IStoreProps {
    navigation: any;
}

interface IHabitsDashboardState {
    isRefreshing: boolean;
    checkinLoadingIds: Set<string>;
    proofSheetHabit: IHabitGoal | null;
    isSubmittingCheckin: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserGoals: HabitActions.getUserGoals,
    getTodayCheckins: HabitActions.getTodayCheckins,
    getActiveStreaks: HabitActions.getActiveStreaks,
    getActivePacts: HabitActions.getActivePacts,
    getUserPacts: HabitActions.getUserPacts,
    createCheckin: HabitActions.createCheckin,
}, dispatch);

export class HabitsDashboard extends React.Component<IHabitsDashboardProps, IHabitsDashboardState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonsStyles();
    private unsubscribeNavigationListener: any;

    constructor(props: IHabitsDashboardProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            checkinLoadingIds: new Set(),
            proofSheetHabit: null,
            isSubmittingCheckin: false,
        };

        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.habits.headerTitle'),
        });

        this.unsubscribeNavigationListener = this.props.navigation.addListener('focus', () => {
            this.handleRefresh();
        });

        this.handleRefresh();
    };

    componentWillUnmount() {
        if (this.unsubscribeNavigationListener) {
            this.unsubscribeNavigationListener();
        }
    }

    handleRefresh = () => {
        const {
            getUserGoals, getTodayCheckins, getActiveStreaks, getActivePacts, getUserPacts,
        } = this.props;

        this.setState({ isRefreshing: true });

        Promise.all([
            getUserGoals(),
            getTodayCheckins(),
            getActiveStreaks(),
            getActivePacts(),
            // Needed to tell a habit whose pact is live apart from one whose
            // invite is still outstanding — getActivePacts only returns the former.
            getUserPacts(),
        ]).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    handleCheckin = (habitGoal: IHabitGoal) => {
        this.setState({ proofSheetHabit: habitGoal });
    };

    handleProofSheetCancel = () => {
        this.setState({ proofSheetHabit: null });
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
        const { createCheckin } = this.props;
        const { proofSheetHabit, checkinLoadingIds } = this.state;

        if (!proofSheetHabit) {
            return;
        }

        const habitGoalId = proofSheetHabit.id;
        const newLoadingIds = new Set(checkinLoadingIds);
        newLoadingIds.add(habitGoalId);
        this.setState({
            checkinLoadingIds: newLoadingIds,
            isSubmittingCheckin: true,
        });

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
            .catch((err) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: err?.message || this.translate('pages.habits.checkinProof.uploadFailed'),
                });
            })
            .finally(() => {
                const updatedLoadingIds = new Set(this.state.checkinLoadingIds);
                updatedLoadingIds.delete(habitGoalId);
                this.setState({
                    checkinLoadingIds: updatedLoadingIds,
                    isSubmittingCheckin: false,
                    proofSheetHabit: null,
                });
            });
    };

    handleHabitPress = (habitGoal: IHabitGoal) => {
        const { navigation } = this.props;
        navigation.navigate('HabitDetail', { habitGoalId: habitGoal.id });
    };

    getTodayCheckinForHabit = (habitGoalId: string): IHabitCheckin | undefined => {
        const { habits } = this.props;
        return habits.todayCheckins.find((c: IHabitCheckin) => c.habitGoalId === habitGoalId);
    };

    getStreakForHabit = (habitGoalId: string): IStreak | undefined => {
        const { habits } = this.props;
        return habits.activeStreaks.find((s: IStreak) => s.habitGoalId === habitGoalId);
    };

    getHabitsByPactState = () => {
        const { habits, user } = this.props;

        return splitHabitsByPactState(
            habits.habitGoals || [],
            habits.activePacts || [],
            habits.pacts || [],
            user.details?.id,
        );
    };

    getGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour < 12) {return this.translate('pages.habits.greetingMorning');}
        if (hour < 18) {return this.translate('pages.habits.greetingAfternoon');}
        return this.translate('pages.habits.greetingEvening');
    };

    renderEmptyState = () => (
        <View style={this.themeHabits.styles.emptyStateContainer}>
            <Text style={this.themeHabits.styles.emptyStateEmoji}>{'\uD83C\uDFAF'}</Text>
            <Text style={this.themeHabits.styles.emptyStateTitle}>
                {this.translate('pages.habits.noHabitsTitle')}
            </Text>
            <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                {this.translate('pages.habits.noHabitsSubtitle')}
            </Text>
        </View>
    );

    renderHabitCard = ({ goal, partnerNames, awaitingPartnerNames }: IHabitWithPactState, isAwaitingPartner: boolean) => {
        const { checkinLoadingIds } = this.state;

        return (
            <HabitCard
                key={goal.id}
                habitGoal={goal}
                todayCheckin={this.getTodayCheckinForHabit(goal.id)}
                streak={this.getStreakForHabit(goal.id)}
                onPress={() => this.handleHabitPress(goal)}
                onCheckin={() => this.handleCheckin(goal)}
                isCheckinLoading={checkinLoadingIds.has(goal.id)}
                showStreak={true}
                isAwaitingPartner={isAwaitingPartner}
                awaitingPartnerNames={awaitingPartnerNames}
                partnerNames={partnerNames}
                themeHabits={this.themeHabits}
                translate={this.translate}
            />
        );
    };

    renderOverallProgress = (liveHabits: IHabitWithPactState[]) => {
        const { habits } = this.props;
        const { activeStreaks, todayCheckins } = habits;

        if (liveHabits.length === 0) {
            return null;
        }

        // Only habits with a live pact are checkin-able, so counting the
        // pending ones in the denominator would make "today" unreachable.
        const liveGoalIds = liveHabits.map(({ goal }) => goal.id);
        const completedToday = todayCheckins.filter(
            (c: IHabitCheckin) => c.status === 'completed' && liveGoalIds.includes(c.habitGoalId),
        ).length;
        const totalHabits = liveHabits.length;
        const longestStreak = activeStreaks.reduce(
            (max: number, s: IStreak) => Math.max(max, s.currentStreak),
            0,
        );

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <View style={this.themeHabits.styles.pactComparisonContainer}>
                    <View style={this.themeHabits.styles.pactComparisonItem}>
                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                            {completedToday}/{totalHabits}
                        </Text>
                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                            {this.translate('pages.habits.todayProgress')}
                        </Text>
                    </View>
                    <View style={this.themeHabits.styles.pactComparisonItem}>
                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                            {longestStreak}
                        </Text>
                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                            {this.translate('pages.habits.bestStreak')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { isRefreshing, proofSheetHabit, isSubmittingCheckin } = this.state;
        const { live, pending } = this.getHabitsByPactState();
        const hasAnyHabits = live.length > 0 || pending.length > 0;

        return (
            <PactOnboardingGuard navigation={navigation}>
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
                        <View style={this.themeHabits.styles.dashboardHeader}>
                            <Text style={this.themeHabits.styles.dashboardGreeting}>
                                {this.getGreeting()}
                            </Text>
                            <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                {this.translate('pages.habits.dashboardSubtitle')}
                            </Text>
                        </View>

                        {this.renderOverallProgress(live)}

                        {!hasAnyHabits && this.renderEmptyState()}

                        {live.length > 0 && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.habits.yourHabits')}
                                </Text>
                                {live.map((habit) => this.renderHabitCard(habit, false))}
                            </View>
                        )}

                        {pending.length > 0 && (
                            <View style={this.themeHabits.styles.dashboardSection}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.habits.pendingHabits')}
                                </Text>
                                {pending.map((habit) => this.renderHabitCard(habit, true))}
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
                <CheckinProofSheet
                    isVisible={!!proofSheetHabit}
                    isSubmitting={isSubmittingCheckin}
                    habitName={proofSheetHabit?.name}
                    userId={user?.details?.id}
                    onCancel={this.handleProofSheetCancel}
                    onConfirm={this.handleProofSheetConfirm}
                    translate={this.translate}
                    themeConfirmModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </PactOnboardingGuard>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitsDashboard);
