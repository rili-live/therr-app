import React from 'react';
import { SafeAreaView, View, Text, Pressable } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IPact } from 'therr-react/types';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import { PactCard, SentInviteCard } from '../../components/Habits';

type PactsTab = 'active' | 'pending' | 'outgoing' | 'all';

interface IPactsListDispatchProps {
    getUserPacts: Function;
    getActivePacts: Function;
    getPendingInvites: Function;
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
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserPacts: HabitActions.getUserPacts,
    getActivePacts: HabitActions.getActivePacts,
    getPendingInvites: HabitActions.getPendingInvites,
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
        const { activeTab } = this.state;

        if (activeTab === 'outgoing') {
            return (
                <SentInviteCard
                    pact={item}
                    locale={user.settings?.locale || 'en-us'}
                    userName={user.details?.userName || ''}
                    themeHabits={this.themeHabits}
                    themeButtons={this.themeButtons}
                    translate={this.translate}
                    onPress={() => this.handlePactPress(item)}
                />
            );
        }

        return (
            <PactCard
                pact={item}
                currentUserId={user.details?.id || ''}
                onPress={() => this.handlePactPress(item)}
                themeHabits={this.themeHabits}
                translate={this.translate}
            />
        );
    };

    renderEmptyState = () => {
        const { activeTab } = this.state;
        if (activeTab === 'outgoing') {
            return (
                <View style={this.themeHabits.styles.emptyStateContainer}>
                    <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                    <Text style={this.themeHabits.styles.emptyStateTitle}>
                        {this.translate('pages.pacts.outgoing.emptyTitle')}
                    </Text>
                    <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                        {this.translate('pages.pacts.outgoing.emptySubtitle')}
                    </Text>
                </View>
            );
        }
        return (
            <View style={this.themeHabits.styles.emptyStateContainer}>
                <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                <Text style={this.themeHabits.styles.emptyStateTitle}>
                    {this.translate('pages.pacts.noPactsTitle')}
                </Text>
                <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                    {this.translate('pages.pacts.noPactsSubtitle')}
                </Text>
            </View>
        );
    };

    renderTabBar = () => {
        const { activeTab } = this.state;
        const labelKeys: Record<PactsTab, string> = {
            active: 'pages.pacts.status.active',
            pending: 'pages.pacts.status.pending',
            outgoing: 'pages.pacts.outgoing.tabLabel',
            all: 'pages.pacts.allTabLabel',
        };
        return (
            <View
                style={{
                    flexDirection: 'row',
                    paddingHorizontal: 8,
                    paddingTop: 8,
                    backgroundColor: this.theme.colors.brandingWhite,
                }}
            >
                {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    const label = this.translate(labelKeys[tab]);
                    return (
                        <Pressable
                            key={tab}
                            onPress={() => this.setActiveTab(tab)}
                            style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                marginRight: 4,
                                borderBottomWidth: 2,
                                borderBottomColor: isActive
                                    ? this.theme.colors.primary3
                                    : 'transparent',
                            }}
                        >
                            <Text
                                style={[
                                    this.themeHabits.styles.habitCardSubtitle,
                                    isActive && { color: this.theme.colors.primary3, fontWeight: '600' },
                                ]}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { isRefreshing } = this.state;
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
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
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

export default connect(mapStateToProps, mapDispatchToProps)(PactsList);
