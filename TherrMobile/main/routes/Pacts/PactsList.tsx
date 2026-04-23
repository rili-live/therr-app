import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IPact } from 'therr-react/types';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import { PactCard } from '../../components/Habits';

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
}

interface IPactsListState {
    isRefreshing: boolean;
    activeTab: 'active' | 'pending' | 'all';
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

export class PactsList extends React.Component<IPactsListProps, IPactsListState> {
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private unsubscribeNavigationListener: any;

    constructor(props: IPactsListProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            activeTab: 'active',
        };

        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator('en-us', key, params);
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

    getPactsList = (): IPact[] => {
        const { habits } = this.props;
        const { activeTab } = this.state;

        switch (activeTab) {
            case 'active':
                return habits.activePacts || [];
            case 'pending':
                return habits.pendingInvites || [];
            case 'all':
            default:
                return habits.pacts || [];
        }
    };

    renderPactItem = ({ item }: { item: IPact }) => {
        const { user } = this.props;

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

    renderEmptyState = () => (
        <View style={this.themeHabits.styles.emptyStateContainer}>
            <Text style={this.themeHabits.styles.emptyStateEmoji}>{'\uD83E\uDD1D'}</Text>
            <Text style={this.themeHabits.styles.emptyStateTitle}>
                {this.translate('pages.pacts.noPactsTitle')}
            </Text>
            <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                {this.translate('pages.pacts.noPactsSubtitle')}
            </Text>
        </View>
    );

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
