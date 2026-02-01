import React from 'react';
import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IStreak } from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import { HabitCard } from '../../components/Habits';

interface IHabitsDashboardDispatchProps {
    getUserGoals: Function;
    getTodayCheckins: Function;
    getActiveStreaks: Function;
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
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserGoals: HabitActions.getUserGoals,
    getTodayCheckins: HabitActions.getTodayCheckins,
    getActiveStreaks: HabitActions.getActiveStreaks,
    createCheckin: HabitActions.createCheckin,
}, dispatch);

export class HabitsDashboard extends React.Component<IHabitsDashboardProps, IHabitsDashboardState> {
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private unsubscribeNavigationListener: any;

    constructor(props: IHabitsDashboardProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            checkinLoadingIds: new Set(),
        };

        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator('en-us', key, params);
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
        const { getUserGoals, getTodayCheckins, getActiveStreaks } = this.props;

        this.setState({ isRefreshing: true });

        Promise.all([
            getUserGoals(),
            getTodayCheckins(),
            getActiveStreaks(),
        ]).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    handleCheckin = (habitGoal: IHabitGoal) => {
        const { createCheckin } = this.props;
        const { checkinLoadingIds } = this.state;

        const newLoadingIds = new Set(checkinLoadingIds);
        newLoadingIds.add(habitGoal.id);
        this.setState({ checkinLoadingIds: newLoadingIds });

        const today = new Date().toISOString().split('T')[0];
        createCheckin({
            habitGoalId: habitGoal.id,
            scheduledDate: today,
            status: 'completed',
        }).finally(() => {
            const updatedLoadingIds = new Set(this.state.checkinLoadingIds);
            updatedLoadingIds.delete(habitGoal.id);
            this.setState({ checkinLoadingIds: updatedLoadingIds });
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

    getGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour < 12) {return this.translate('pages.habits.greetingMorning');}
        if (hour < 18) {return this.translate('pages.habits.greetingAfternoon');}
        return this.translate('pages.habits.greetingEvening');
    };

    renderHabitsList = () => {
        const { habits } = this.props;
        const { checkinLoadingIds } = this.state;
        const { habitGoals } = habits;

        if (!habitGoals || habitGoals.length === 0) {
            return (
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
        }

        return habitGoals.map((goal: IHabitGoal) => {
            const todayCheckin = this.getTodayCheckinForHabit(goal.id);
            const streak = this.getStreakForHabit(goal.id);

            return (
                <HabitCard
                    key={goal.id}
                    habitGoal={goal}
                    todayCheckin={todayCheckin}
                    streak={streak}
                    onPress={() => this.handleHabitPress(goal)}
                    onCheckin={() => this.handleCheckin(goal)}
                    isCheckinLoading={checkinLoadingIds.has(goal.id)}
                    showStreak={true}
                    themeHabits={this.themeHabits}
                    translate={this.translate}
                />
            );
        });
    };

    renderOverallProgress = () => {
        const { habits } = this.props;
        const { activeStreaks, todayCheckins, habitGoals } = habits;

        if (!habitGoals || habitGoals.length === 0) {
            return null;
        }

        const completedToday = todayCheckins.filter(
            (c: IHabitCheckin) => c.status === 'completed',
        ).length;
        const totalHabits = habitGoals.length;
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
        const { isRefreshing } = this.state;

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
                        <View style={this.themeHabits.styles.dashboardHeader}>
                            <Text style={this.themeHabits.styles.dashboardGreeting}>
                                {this.getGreeting()}
                            </Text>
                            <Text style={this.themeHabits.styles.dashboardSubtitle}>
                                {this.translate('pages.habits.dashboardSubtitle')}
                            </Text>
                        </View>

                        {this.renderOverallProgress()}

                        <View style={this.themeHabits.styles.dashboardSection}>
                            <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                {this.translate('pages.habits.yourHabits')}
                            </Text>
                            {this.renderHabitsList()}
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitsDashboard);
