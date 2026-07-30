import React from 'react';
import { SafeAreaView, View, Text, Pressable } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import {
    IUserState, IHabitsState, IPact, IPactNudgeResult,
} from 'therr-react/types';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../utilities/translator';
import permissions from '../../utilities/permissionsOrchestrator';
import isPactInviteAwaitingResponse from '../../utilities/pactInviteState';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { PactCard, SentInviteCard } from '../../components/Habits';

type PactsTab = 'active' | 'pending' | 'outgoing' | 'all';

interface IPactsListDispatchProps {
    getUserPacts: Function;
    getActivePacts: Function;
    getPendingInvites: Function;
    acceptPact: Function;
    declinePact: Function;
    nudgePact: Function;
}

interface IStoreProps extends IPactsListDispatchProps {
    user: IUserState;
    habits: IHabitsState;
}

export interface IPactsListProps extends IStoreProps {
    navigation: any;
    route?: { params?: { initialTab?: PactsTab } };
}

interface IPactsListState {
    isRefreshing: boolean;
    activeTab: PactsTab;
    respondingPactId: string | null;
    nudgingPactId: string | null;
    pactIdPendingDecline: string | null;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserPacts: HabitActions.getUserPacts,
    getActivePacts: HabitActions.getActivePacts,
    getPendingInvites: HabitActions.getPendingInvites,
    acceptPact: HabitActions.acceptPact,
    declinePact: HabitActions.declinePact,
    nudgePact: HabitActions.nudgePact,
}, dispatch);

const TABS: PactsTab[] = ['active', 'pending', 'outgoing', 'all'];

export class PactsList extends React.Component<IPactsListProps, IPactsListState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private unsubscribeNavigationListener: any;

    constructor(props: IPactsListProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            activeTab: props.route?.params?.initialTab || 'active',
            respondingPactId: null,
            nudgingPactId: null,
            pactIdPendingDecline: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.pacts.headerTitle'),
        });

        this.unsubscribeNavigationListener = this.props.navigation.addListener('focus', () => {
            this.handleRefresh();
        });

        this.handleRefresh();
    };

    componentDidUpdate(prevProps: IPactsListProps) {
        const nextInitialTab = this.props.route?.params?.initialTab;
        const prevInitialTab = prevProps.route?.params?.initialTab;
        if (nextInitialTab && nextInitialTab !== prevInitialTab) {
            this.setState({ activeTab: nextInitialTab });
        }
    }

    componentWillUnmount() {
        if (this.unsubscribeNavigationListener) {
            this.unsubscribeNavigationListener();
        }
    }

    handleRefresh = () => {
        const { getUserPacts, getActivePacts, getPendingInvites } = this.props;

        this.setState({ isRefreshing: true });

        Promise.all([
            getUserPacts(),
            getActivePacts(),
            getPendingInvites(),
        ]).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    handlePactPress = (pact: IPact) => {
        const { navigation } = this.props;
        navigation.navigate('PactDetail', { pactId: pact.id });
    };

    handleAcceptInvite = (pact: IPact) => {
        const { acceptPact } = this.props;

        this.setState({ respondingPactId: pact.id });

        acceptPact(pact.id)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.acceptedTitle'),
                    text2: this.translate('pages.pacts.acceptedMessage'),
                    visibilityTime: 2000,
                });
                permissions.requestIfAppropriate('notifications', { trigger: 'pactAccept' });
                // The pact is active now — send the user where it lives.
                this.setState({ activeTab: 'active' });
                this.handleRefresh();
            })
            .catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate('pages.pacts.acceptError'),
                    visibilityTime: 2000,
                });
            })
            .finally(() => {
                this.setState({ respondingPactId: null });
            });
    };

    handleNudge = (pact: IPact) => {
        const { nudgePact } = this.props;

        this.setState({ nudgingPactId: pact.id });

        nudgePact(pact.id)
            .then((response: any) => {
                // The endpoint answers 200 even when nothing was sent: the
                // 7-day per-partner cooldown and per-partner dispatch failures
                // are reported inside `nudgeResults`, not as an HTTP error.
                // Reading only the status would tell the user "Nudge sent!"
                // when no nudge went out.
                const results: IPactNudgeResult[] = response?.nudgeResults || [];
                const wasAnyNudged = results.length === 0 || results.some((result) => result.nudged);
                const isCooldown = !wasAnyNudged && results.some((result) => result.reason === 'cooldown');

                if (wasAnyNudged) {
                    Toast.show({
                        type: 'success',
                        text1: this.translate('pages.pacts.outgoing.nudgeSuccess'),
                        visibilityTime: 2000,
                    });
                } else {
                    Toast.show({
                        type: isCooldown ? 'warn' : 'error',
                        text1: this.translate(isCooldown
                            ? 'pages.pacts.outgoing.nudgeCooldown'
                            : 'pages.pacts.outgoing.nudgeError'),
                        visibilityTime: 2000,
                    });
                }

                this.handleRefresh();
            })
            .catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate('pages.pacts.outgoing.nudgeError'),
                    visibilityTime: 2000,
                });
            })
            .finally(() => {
                this.setState({ nudgingPactId: null });
            });
    };

    handleInviteSomeoneElse = () => {
        const { navigation } = this.props;
        navigation.navigate('CreatePactInvite');
    };

    handleDeclineInvitePress = (pact: IPact) => {
        this.setState({ pactIdPendingDecline: pact.id });
    };

    handleCancelDecline = () => {
        this.setState({ pactIdPendingDecline: null });
    };

    handleConfirmDecline = () => {
        const { declinePact } = this.props;
        const { pactIdPendingDecline } = this.state;

        if (!pactIdPendingDecline) {
            return;
        }

        this.setState({
            respondingPactId: pactIdPendingDecline,
            pactIdPendingDecline: null,
        });

        declinePact(pactIdPendingDecline)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.successTitle'),
                    text2: this.translate('pages.pacts.declinedMessage'),
                    visibilityTime: 2000,
                });
                this.handleRefresh();
            })
            .catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate('pages.pacts.declineError'),
                    visibilityTime: 2000,
                });
            })
            .finally(() => {
                this.setState({ respondingPactId: null });
            });
    };

    setActiveTab = (tab: PactsTab) => {
        this.setState({ activeTab: tab });
    };

    getOutgoingInvites = (): IPact[] => {
        const { habits, user } = this.props;
        const currentUserId = user.details?.id || '';
        return (habits.pacts || []).filter(
            (p) => p.status === 'pending' && p.creatorUserId === currentUserId,
        );
    };

    isPendingInviteForMe = (pact: IPact): boolean => {
        const { habits, user } = this.props;
        // The server-computed invite list is authoritative (and is the only
        // signal on pending invites, which come back without member rows);
        // fall back to the member/partner fields for pacts surfaced by the
        // other tabs.
        return (habits.pendingInvites || []).some((invite) => invite.id === pact.id)
            || isPactInviteAwaitingResponse(pact, user.details?.id);
    };

    getPactsList = (): IPact[] => {
        const { habits } = this.props;
        const { activeTab } = this.state;

        switch (activeTab) {
            case 'active':
                return habits.activePacts || [];
            case 'pending':
                return habits.pendingInvites || [];
            case 'outgoing':
                return this.getOutgoingInvites();
            case 'all':
            default:
                return habits.pacts || [];
        }
    };

    renderPactItem = ({ item }: { item: IPact }) => {
        const { user } = this.props;
        const { activeTab, respondingPactId, nudgingPactId } = this.state;

        if (activeTab === 'outgoing') {
            return (
                <SentInviteCard
                    pact={item}
                    locale={user.settings?.locale || 'en-us'}
                    currentUserId={user.details?.id}
                    userName={user.details?.userName || ''}
                    isNudging={nudgingPactId === item.id}
                    onNudge={this.handleNudge}
                    onInviteSomeoneElse={this.handleInviteSomeoneElse}
                    themeHabits={this.themeHabits}
                    translate={this.translate}
                    onPress={() => this.handlePactPress(item)}
                />
            );
        }

        // Any pact still awaiting this user's response gets inline actions,
        // whichever tab surfaced it (a group pact can be active for others
        // while this user's own invite is still pending).
        const isAwaitingMyResponse = this.isPendingInviteForMe(item);

        return (
            <PactCard
                pact={item}
                currentUserId={user.details?.id || ''}
                onPress={() => this.handlePactPress(item)}
                onAccept={isAwaitingMyResponse ? () => this.handleAcceptInvite(item) : undefined}
                onDecline={isAwaitingMyResponse ? () => this.handleDeclineInvitePress(item) : undefined}
                isRespondPending={respondingPactId === item.id}
                themeHabits={this.themeHabits}
                translate={this.translate}
            />
        );
    };

    renderEmptyState = () => {
        const { activeTab } = this.state;
        const isOutgoing = activeTab === 'outgoing';

        return (
            <View style={this.themeHabits.styles.emptyStateContainer}>
                <View style={this.themeHabits.styles.emptyStateIconCircle}>
                    <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                </View>
                <Text style={this.themeHabits.styles.emptyStateTitle}>
                    {this.translate(isOutgoing
                        ? 'pages.pacts.outgoing.emptyTitle'
                        : 'pages.pacts.noPactsTitle')}
                </Text>
                <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                    {this.translate(isOutgoing
                        ? 'pages.pacts.outgoing.emptySubtitle'
                        : 'pages.pacts.noPactsSubtitle')}
                </Text>
            </View>
        );
    };

    /**
     * Segmented control. Replaces four cramped, left-aligned text labels with a
     * 2dp underline — the segments now share the row evenly, each gets a real
     * touch target, and the selected one is a raised pill rather than a rule
     * that was easy to miss.
     */
    renderTabBar = () => {
        const { activeTab } = this.state;
        const labelKeys: Record<PactsTab, string> = {
            active: 'pages.pacts.status.active',
            pending: 'pages.pacts.status.pending',
            outgoing: 'pages.pacts.outgoing.tabLabel',
            all: 'pages.pacts.allTabLabel',
        };

        return (
            <View style={this.themeHabits.styles.segmentedControl}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <Pressable
                            key={tab}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            onPress={() => this.setActiveTab(tab)}
                            style={[
                                this.themeHabits.styles.segmentedControlItem,
                                isActive && this.themeHabits.styles.segmentedControlItemActive,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    this.themeHabits.styles.segmentedControlLabel,
                                    isActive && this.themeHabits.styles.segmentedControlLabelActive,
                                ]}
                            >
                                {this.translate(labelKeys[tab])}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { isRefreshing, pactIdPendingDecline } = this.state;
        const pacts = this.getPactsList();

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}>
                    <View style={this.themeHabits.styles.dashboardHeader}>
                        <Text style={this.themeHabits.styles.dashboardGreeting}>
                            {this.translate('pages.pacts.title')}
                        </Text>
                        <Text style={this.themeHabits.styles.dashboardSubtitle}>
                            {this.translate('pages.pacts.subtitle')}
                        </Text>
                    </View>

                    {this.renderTabBar()}

                    <FlatList
                        data={pacts}
                        keyExtractor={(item: IPact) => item.id}
                        renderItem={this.renderPactItem}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handleRefresh}
                            />
                        }
                        ListEmptyComponent={this.renderEmptyState}
                        contentContainerStyle={this.themeHabits.styles.pactsListContent}
                    />
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />

                <ConfirmModal
                    isVisible={!!pactIdPendingDecline}
                    onCancel={this.handleCancelDecline}
                    onConfirm={this.handleConfirmDecline}
                    text={this.translate('pages.pacts.confirmDecline')}
                    textConfirm={this.translate('modals.confirmModal.confirm')}
                    textCancel={this.translate('modals.confirmModal.cancel')}
                    translate={this.translate}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(PactsList);
