import React from 'react';
import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IStreak } from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import { CheckinButton, HabitCalendar, StreakWidget } from '../../components/Habits';

interface IHabitDetailDispatchProps {
    getCheckinsByRange: Function;
    getStreakByHabit: Function;
    createCheckin: Function;
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
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getCheckinsByRange: HabitActions.getCheckinsByRange,
    getStreakByHabit: HabitActions.getStreakByHabit,
    createCheckin: HabitActions.createCheckin,
}, dispatch);

export class HabitDetail extends React.Component<IHabitDetailProps, IHabitDetailState> {
    private translate: Function;
    private theme = buildStyles();
    private themeHabits = buildHabitStyles();

    constructor(props: IHabitDetailProps) {
        super(props);

        const today = new Date();
        this.state = {
            isRefreshing: false,
            isCheckinLoading: false,
            calendarMonth: new Date(today.getFullYear(), today.getMonth(), 1),
            checkins: [],
            streak: null,
        };

        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator('en-us', key, params);
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

    handleCheckin = () => {
        const { createCheckin, route } = this.props;
        const { habitGoalId } = route.params;

        this.setState({ isCheckinLoading: true });

        const today = new Date().toISOString().split('T')[0];
        createCheckin({
            habitGoalId,
            scheduledDate: today,
            status: 'completed',
        }).finally(() => {
            this.setState({ isCheckinLoading: false });
            this.handleRefresh();
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

                        {streak && streak.currentStreak > 0 && (
                            <StreakWidget
                                streak={streak}
                                title={this.translate('pages.habits.currentStreak')}
                                themeHabits={this.themeHabits}
                            />
                        )}

                        <HabitCalendar
                            checkins={checkins}
                            month={calendarMonth}
                            onMonthChange={this.handleMonthChange}
                            onDayPress={this.handleDayPress}
                            themeHabits={this.themeHabits}
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
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitDetail);
