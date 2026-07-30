import React from 'react';
import {
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IHabitsState, IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { RefreshControl } from 'react-native-gesture-handler';
import { hoursDaysOrYearsSince } from '../../utilities/formatDate';

interface IMyHabitsDispatchProps {
    getUserGoals: Function;
    getUserPacts: Function;
}

interface IStoreProps extends IMyHabitsDispatchProps {
    habits: IHabitsState;
    user: IUserState;
}

export interface IMyHabitsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IMyHabitsState {
    isLoading: boolean;
}

const mapStateToProps = (state) => ({
    habits: state.habits,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserGoals: HabitActions.getUserGoals,
    getUserPacts: HabitActions.getUserPacts,
}, dispatch);

class MyHabits extends React.Component<IMyHabitsProps, IMyHabitsState> {
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private translate: Function;

    constructor(props: IMyHabitsProps) {
        super(props);

        this.state = {
            isLoading: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.loadData();
    }

    loadData = () => {
        const { getUserGoals, getUserPacts } = this.props;
        this.setState({ isLoading: true });
        Promise.all([
            getUserGoals(),
            getUserPacts(),
        ]).finally(() => {
            this.setState({ isLoading: false });
        });
    };

    goToPacts = (initialTab = 'outgoing') => {
        const { navigation } = this.props;
        navigation.navigate('PactsList', { initialTab });
    };

    renderEmptyState = () => (
        <View style={[spacingStyles.padMd, this.themeHabits.styles.myHabitsEmptyContainer]}>
            <Text style={this.themeHabits.styles.myHabitsEmptyText}>
                {this.translate('pages.myHabits.messages.noHabits')}
            </Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={this.translate('pages.myHabits.buttons.createHabit')}
                style={({ pressed }) => [
                    this.themeHabits.styles.myHabitsPrimaryButton,
                    pressed && this.themeHabits.styles.pressedOpacity,
                ]}
                onPress={() => this.props.navigation.navigate('ActivityGenerator')}
            >
                <Text style={this.themeHabits.styles.myHabitsPrimaryButtonText}>
                    {this.translate('pages.myHabits.buttons.createHabit')}
                </Text>
            </Pressable>
        </View>
    );

    renderHabitCard = (goal) => {
        const { habits, user } = this.props;
        const currentUserId = user.details?.id;

        const relatedPacts = (habits.pacts || []).filter(
            (p) => p.habitGoalId === goal.id,
        );

        const pendingPacts = relatedPacts.filter((p) => p.status === 'pending');
        const hasPendingInvites = pendingPacts.length > 0;
        const isActivePendingStep = hasPendingInvites;

        return (
            <View
                key={goal.id}
                style={[
                    this.themeHabits.styles.myHabitsCard,
                    isActivePendingStep && this.themeHabits.styles.myHabitsCardActive,
                ]}
            >
                {/* Habit header */}
                <View style={[spacingStyles.flexRow, spacingStyles.alignCenter, this.themeHabits.styles.myHabitsCardHeader]}>
                    {!!goal.emoji && <Text style={this.themeHabits.styles.myHabitsEmoji}>{goal.emoji}</Text>}
                    <Text style={this.themeHabits.styles.myHabitsTitle} numberOfLines={1}>
                        {goal.name}
                    </Text>
                </View>

                {/* Pending invites section */}
                {pendingPacts.length > 0 && (
                    <View style={this.themeHabits.styles.myHabitsPendingSection}>
                        <View style={this.themeHabits.styles.myHabitsPendingBadge}>
                            <Text style={this.themeHabits.styles.myHabitsPendingBadgeText}>
                                {this.translate('pages.myHabits.labels.pendingInvite')}
                            </Text>
                        </View>

                        {pendingPacts.map((pact) => {
                            const partnerMembers = (pact.members || []).filter(
                                (m) => m.userId !== currentUserId && m.role === 'partner',
                            );
                            const invitedAt = pact.createdAt
                                ? new Date(pact.createdAt)
                                : new Date();
                            const timeAgo = hoursDaysOrYearsSince(invitedAt, this.translate);

                            return (
                                <View key={pact.id} style={this.themeHabits.styles.myHabitsPactRow}>
                                    {partnerMembers.length > 0 ? (
                                        <View style={this.themeHabits.styles.myHabitsTeamRow}>
                                            <Text style={this.themeHabits.styles.myHabitsTeamLabel}>
                                                {this.translate('pages.myHabits.labels.teamMembers')}
                                                {': '}
                                            </Text>
                                            <Text style={this.themeHabits.styles.myHabitsTeamNames}>
                                                {partnerMembers.map((m) => {
                                                    if (m.firstName || m.lastName) {
                                                        return `${m.firstName || ''} ${m.lastName || ''}`.trim();
                                                    }
                                                    return m.userName || this.translate('pages.pacts.partnerFallback');
                                                }).join(', ')}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <Text style={this.themeHabits.styles.myHabitsInvitedTime}>
                                        {this.translate('pages.myHabits.labels.invitedTimeAgo', { timeAgo })}
                                    </Text>
                                </View>
                            );
                        })}

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={this.translate('pages.myHabits.buttons.viewPactStatus')}
                            style={({ pressed }) => [
                                this.themeHabits.styles.myHabitsTextAction,
                                pressed && this.themeHabits.styles.pressedOpacity,
                            ]}
                            onPress={() => this.goToPacts('outgoing')}
                        >
                            <Text style={this.themeHabits.styles.myHabitsTextActionLabel}>
                                {this.translate('pages.myHabits.buttons.viewPactStatus')}
                            </Text>
                        </Pressable>
                    </View>
                )}
            </View>
        );
    };

    render() {
        const { habits, navigation, user } = this.props;
        const { isLoading } = this.state;

        const habitGoals = habits.habitGoals || [];

        return (
            <SafeAreaView
                edges={[]}
                style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
            >
                <BaseStatusBar themeName={user.settings?.mobileThemeName} />
                <ScrollView
                    style={[this.theme.styles.scrollView]}
                    contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={this.loadData} />}
                >
                    <View style={spacingStyles.padMd}>
                        <Text style={[this.theme.styles.sectionTitle, this.themeHabits.styles.myHabitsPageHeader]}>
                            {this.translate('pages.myHabits.pageHeader')}
                        </Text>

                        {habitGoals.length === 0 && !isLoading
                            ? this.renderEmptyState()
                            : habitGoals.map(this.renderHabitCard)
                        }

                        {/* Link to the Pacts screen's "Sent" tab */}
                        {habitGoals.length > 0 && (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={this.translate('pages.myHabits.buttons.viewPactStatus')}
                                style={({ pressed }) => [
                                    this.themeHabits.styles.myHabitsPactsLink,
                                    pressed && this.themeHabits.styles.pressedOpacity,
                                ]}
                                onPress={() => this.goToPacts('outgoing')}
                            >
                                <Text style={this.themeHabits.styles.myHabitsTextActionLabel}>
                                    {this.translate('pages.myHabits.buttons.viewPactStatus')}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.loadData}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </SafeAreaView>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MyHabits);
