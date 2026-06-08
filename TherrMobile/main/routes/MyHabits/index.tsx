import React from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
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
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { RefreshControl } from 'react-native-gesture-handler';
import { hoursDaysOrYearsSince } from '../../utilities/formatDate';

const ACTIVE_STEP_COLOR = '#7B5EA7';

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
    private translate: Function;

    constructor(props: IMyHabitsProps) {
        super(props);

        this.state = {
            isLoading: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
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

    goToMyPacts = (activeTab = 'Sent') => {
        const { navigation } = this.props;
        navigation.navigate('MyPacts', { activeTab });
    };

    renderEmptyState = () => (
        <View style={[spacingStyles.padMd, localStyles.emptyContainer]}>
            <Text style={[this.theme.styles.sectionTitleSmall, localStyles.emptyText]}>
                {this.translate('pages.myHabits.messages.noHabits')}
            </Text>
            <Pressable
                style={({ pressed }) => [localStyles.primaryButton, pressed && localStyles.buttonPressed]}
                onPress={() => this.props.navigation.navigate('ActivityGenerator')}
            >
                <Text style={localStyles.primaryButtonText}>
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
                style={[localStyles.habitCard, isActivePendingStep && localStyles.habitCardActiveBorder]}
            >
                {/* Habit header */}
                <View style={[spacingStyles.flexRow, spacingStyles.alignCenter, localStyles.habitHeader]}>
                    {!!goal.emoji && <Text style={localStyles.habitEmoji}>{goal.emoji}</Text>}
                    <Text style={[this.theme.styles.sectionTitleSmall, localStyles.habitTitle]} numberOfLines={1}>
                        {goal.name}
                    </Text>
                </View>

                {/* Pending invites section */}
                {pendingPacts.length > 0 && (
                    <View style={localStyles.pendingSection}>
                        <View style={[spacingStyles.flexRow, spacingStyles.alignCenter, localStyles.pendingHeader]}>
                            <View style={localStyles.pendingBadge}>
                                <Text style={localStyles.pendingBadgeText}>
                                    {this.translate('pages.myHabits.labels.pendingInvite')}
                                </Text>
                            </View>
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
                                <View key={pact.id} style={localStyles.pendingPactRow}>
                                    {partnerMembers.length > 0 ? (
                                        <View style={localStyles.teamMembersRow}>
                                            <Text style={localStyles.teamMembersLabel}>
                                                {this.translate('pages.myHabits.labels.teamMembers')}
                                                {': '}
                                            </Text>
                                            <Text style={localStyles.teamMembersNames}>
                                                {partnerMembers.map((m) => {
                                                    if (m.firstName || m.lastName) {
                                                        return `${m.firstName || ''} ${m.lastName || ''}`.trim();
                                                    }
                                                    return m.userName || 'Someone';
                                                }).join(', ')}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <Text style={localStyles.invitedTimeText}>
                                        {this.translate('pages.myHabits.labels.invitedTimeAgo', { timeAgo })}
                                    </Text>
                                </View>
                            );
                        })}

                        <Pressable
                            style={({ pressed }) => [localStyles.viewStatusButton, pressed && localStyles.buttonPressed]}
                            onPress={() => this.goToMyPacts('Sent')}
                        >
                            <Text style={localStyles.viewStatusText}>
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
            <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                <BaseStatusBar themeName={user.settings?.mobileThemeName} />
                <ScrollView
                    style={[this.theme.styles.scrollView]}
                    contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={this.loadData} />}
                >
                    <View style={spacingStyles.padMd}>
                        <Text style={[this.theme.styles.sectionTitle, localStyles.pageHeader]}>
                            {this.translate('pages.myHabits.pageHeader')}
                        </Text>

                        {habitGoals.length === 0 && !isLoading
                            ? this.renderEmptyState()
                            : habitGoals.map(this.renderHabitCard)
                        }

                        {/* Link to My Pacts "Sent" tab */}
                        {habitGoals.length > 0 && (
                            <Pressable
                                style={({ pressed }) => [localStyles.pactsLinkContainer, pressed && localStyles.buttonPressed]}
                                onPress={() => this.goToMyPacts('Sent')}
                            >
                                <Text style={localStyles.pactsLinkText}>
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

const localStyles = StyleSheet.create({
    pageHeader: {
        marginBottom: 16,
    },
    habitCard: {
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    habitCardActiveBorder: {
        borderWidth: 2,
        borderColor: ACTIVE_STEP_COLOR,
    },
    habitHeader: {
        marginBottom: 10,
        gap: 8,
    },
    habitEmoji: {
        fontSize: 24,
    },
    habitTitle: {
        flex: 1,
    },
    pendingSection: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 10,
        gap: 6,
    },
    pendingHeader: {
        marginBottom: 4,
    },
    pendingBadge: {
        backgroundColor: ACTIVE_STEP_COLOR,
        borderRadius: 99,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    pendingBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    pendingPactRow: {
        gap: 4,
    },
    teamMembersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    teamMembersLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
    },
    teamMembersNames: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    invitedTimeText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontStyle: 'italic',
    },
    viewStatusButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    viewStatusText: {
        color: ACTIVE_STEP_COLOR,
        fontSize: 14,
        fontWeight: '600',
    },
    pactsLinkContainer: {
        marginTop: 8,
        alignSelf: 'center',
        padding: 12,
    },
    pactsLinkText: {
        color: ACTIVE_STEP_COLOR,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 32,
        gap: 16,
    },
    emptyText: {
        textAlign: 'center',
        opacity: 0.7,
    },
    primaryButton: {
        backgroundColor: ACTIVE_STEP_COLOR,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    buttonPressed: {
        opacity: 0.75,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(MyHabits);
