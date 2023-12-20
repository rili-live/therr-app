import React from 'react';
import { Dimensions, FlatList, SafeAreaView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { TabBar, TabView } from 'react-native-tab-view';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import ConnectionItem from './components/ConnectionItem';
import CreateConnectionButton from '../../components/CreateConnectionButton';
import { RefreshControl } from 'react-native-gesture-handler';
import LazyPlaceholder from './components/LazyPlaceholder';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ListEmpty from '../../components/ListEmpty';
import UsersActions from '../../redux/actions/UsersActions';
import UserSearchItem from './components/UserSearchItem';
import { PEOPLE_CAROUSEL_TABS } from '../../constants';

const { width: viewportWidth } = Dimensions.get('window');
const DEFAULT_PAGE_SIZE = 50;
const tabMap = {
    0: PEOPLE_CAROUSEL_TABS.PEOPLE,
    1: PEOPLE_CAROUSEL_TABS.GROUPS,
    2: PEOPLE_CAROUSEL_TABS.CONNECTIONS,
};

interface IContactsDispatchProps {
    createUserConnection: Function;
    logout: Function;
    searchUserConnections: Function;
    searchUsers: Function;
    searchUpdateUser: Function;
}

interface IStoreProps extends IContactsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IContactsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IContactsState {
    isNameConfirmModalVisible: boolean;
    isRefreshing: boolean;
    isRefreshingUserSearch: boolean;
    activeTabIndex: number;
    tabRoutes: { key: string; title: string }[];
}

const mapStateToProps = (state) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
            searchUserConnections: UserConnectionsActions.search,
            searchUsers: UsersActions.search,
            searchUpdateUser: UsersActions.searchUpdateUser,
        },
        dispatch
    );

class Contacts extends React.Component<IContactsProps, IContactsState> {
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeMenu = buildMenuStyles();
    private unsubscribeFocusListener;
    private peopleListRef;
    private connectionsListRef;
    private groupsListRef;

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        const { route } = props;
        let activeTabIndex = 0;
        if (route.params?.activeTab === tabMap[0]) {
            activeTabIndex = 0;
        }
        if (route.params?.activeTab === tabMap[1]) {
            activeTabIndex = 1;
        }
        if (route.params?.activeTab === tabMap[2]) {
            activeTabIndex = 2;
        }

        this.state = {
            activeTabIndex,
            isNameConfirmModalVisible: false,
            isRefreshing: false,
            isRefreshingUserSearch: false,
            tabRoutes: [
                { key: PEOPLE_CAROUSEL_TABS.PEOPLE, title: this.translate('menus.headerTabs.people') },
                { key: PEOPLE_CAROUSEL_TABS.GROUPS, title: this.translate('menus.headerTabs.groups') },
                { key: PEOPLE_CAROUSEL_TABS.CONNECTIONS, title: this.translate('menus.headerTabs.connections') },
                // { key: PEOPLE_CAROUSEL_TABS.INVITES, title: this.translate('menus.headerTabs.invite') },
            ],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const { navigation, user, userConnections } = this.props;

        navigation.setOptions({
            title: this.translate('pages.contacts.headerTitle'),
        });

        if ((userConnections.connections.length || 0) < DEFAULT_PAGE_SIZE) {
            this.handleRefresh();
        }

        if ((Object.keys(user.users || {})?.length || 0) < DEFAULT_PAGE_SIZE) {
            this.handleRefreshUsersSearch();
        }

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            const { route } = this.props;
            let activeTabIndex = 0;
            if (route.params?.activeTab === tabMap[0]) {
                activeTabIndex = 0;
            }
            if (route.params?.activeTab === tabMap[1]) {
                activeTabIndex = 1;
            }
            if (route.params?.activeTab === tabMap[2]) {
                activeTabIndex = 2;
            }

            this.setState({
                activeTabIndex,
            });
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    getConnectionOrUserDetails = (userOrConnection) => {
        const { user } = this.props;

        // Active connection format
        if (!userOrConnection.users) {
            return userOrConnection;
        }

        // User <-> User connection format
        return (
            userOrConnection.users.find(
                (u) => user.details && u.id !== user.details.id
            ) || {}
        );
    };

    getConnectionSubtitle = (connectionDetails) => {
        if (!connectionDetails?.firstName && !connectionDetails?.lastName) {
            return this.translate('pages.userProfile.anonymous');
        }
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    onConnectionPress = (connectionDetails) => {
        const { navigation } = this.props;

        navigation.navigate('DirectMessage', {
            connectionDetails,
        });
    };

    onTabSelect = (index: number) => {
        this.setState({
            activeTabIndex: index,
        });
    };

    trySearchMoreUsers = () => {

    };

    handleRefreshUsersSearch = () => {
        this.setState({
            isRefreshingUserSearch: true,
        });

        this.props
            .searchUsers(
                {
                    query: '',
                    limit: DEFAULT_PAGE_SIZE,
                    offset: 0,
                    withMedia: true,
                },
            )
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshingUserSearch: false,
                });
            });
    };

    handleRefresh = () => {
        const { user } = this.props;

        this.setState({
            isRefreshing: true,
        });

        this.props
            .searchUserConnections(
                {
                    filterBy: 'acceptingUserId',
                    query: user.details && user.details.id,
                    itemsPerPage: DEFAULT_PAGE_SIZE,
                    pageNumber: 1,
                    orderBy: 'interactionCount',
                    order: 'desc',
                    shouldCheckReverse: true,
                    withMedia: true,
                },
                user.details && user.details.id
            )
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshing: false,
                });
            });
    };

    handleNameConfirm = () => {
        const { navigation } = this.props;

        this.toggleNameConfirmModal();
        navigation.navigate('Settings');
    };

    onSendConnectRequest = (acceptingUser: any) => {
        const { createUserConnection, user, searchUpdateUser } = this.props;
        // TODO: Send connection request
        createUserConnection({
            requestingUserId: user.details.id,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            requestingUserEmail: user.details.email,
            acceptingUserId: acceptingUser?.id,
            acceptingUserPhoneNumber: acceptingUser?.phoneNumber,
            acceptingUserEmail: acceptingUser?.email,
        }, {
            userName: user?.details?.userName,
        }).then(() => {
            searchUpdateUser(acceptingUser.id, {
                isConnected: true,
            });
        });
    };

    toggleNameConfirmModal = () => {
        this.setState({
            isNameConfirmModalVisible: !this.state.isNameConfirmModalVisible,
        });
    };

    navToInvite = () => {
        const { navigation } = this.props;
        navigation.navigate('Invite');
    };

    scrollTop = () => {
        const { userConnections, user } = this.props;

        if (userConnections.connections?.length) {
            this.connectionsListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        if (userConnections.groups?.length) {
            this.groupsListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        if (Object.keys(user.users || {}).length) {
            this.peopleListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
    };

    sortConnections = () => {
        const { userConnections } = this.props;
        const activeConnections = [...(userConnections?.activeConnections || [])].map(a => ({ ...a, isActive: true }));
        const inactiveConnections = userConnections?.connections
            ?.filter(c => !activeConnections.find(a => a.id === c.requestingUserId || a.id === c.acceptingUserId)) || [];

        return activeConnections.concat(inactiveConnections);
    };

    sortGroups = (): any[] => {
        return [];
    };

    renderTabBar = props => {
        return (
            <TabBar
                {...props}
                indicatorStyle={this.themeMenu.styles.tabFocusedIndicator}
                style={this.themeMenu.styles.tabBar}
                renderLabel={this.renderTabLabel}
            />
        );
    };

    renderTabLabel = ({ route, focused }) => {
        return (
            <Text style={focused ? this.themeMenu.styles.tabTextFocused : this.themeMenu.styles.tabText}>
                {route.title}
            </Text>
        );
    };

    renderSceneMap = ({ route }) => {
        const { isRefreshing, isRefreshingUserSearch } = this.state;
        const { user } = this.props;

        switch (route.key) {
            case PEOPLE_CAROUSEL_TABS.PEOPLE:
                const people: any[] = Object.values(user?.users || {});

                return (
                    <FlatList
                        ref={(component) => this.peopleListRef = component}
                        data={people}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: user }) => (
                            <UserSearchItem
                                key={user.id}
                                userDetails={this.getConnectionOrUserDetails(user)}
                                getUserSubtitle={this.getConnectionSubtitle}
                                goToViewUser={this.goToViewUser}
                                onSendConnectRequest={this.onSendConnectRequest}
                                theme={this.theme}
                                themeButtons={this.themeButtons}
                                translate={this.translate}
                            />
                        )}
                        ListEmptyComponent={<ListEmpty theme={this.theme} text={this.translate(
                            'components.contactsSearch.noUsersFound'
                        )} />}
                        stickyHeaderIndices={[]}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshingUserSearch}
                            onRefresh={this.handleRefreshUsersSearch}
                        />}
                        onContentSizeChange={this.scrollTop}
                        onEndReached={this.trySearchMoreUsers}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={<View />}
                        ListFooterComponentStyle={{ marginBottom: 80 }}
                    />
                );
            case PEOPLE_CAROUSEL_TABS.GROUPS:
                const groups = this.sortGroups();

                return (
                    <FlatList
                        ref={(component) => this.groupsListRef = component}
                        data={groups}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: group }) => (
                            <ConnectionItem
                                key={group.id}
                                connectionDetails={this.getConnectionOrUserDetails(group)}
                                getConnectionSubtitle={this.getConnectionSubtitle}
                                goToViewUser={this.goToViewUser}
                                isActive={group.isActive}
                                onConnectionPress={this.onConnectionPress}
                                theme={this.theme}
                                translate={this.translate}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={spacingStyles.marginHorizLg}>
                                <ListEmpty iconName="group" theme={this.theme} text={this.translate(
                                    'components.contactsSearch.noGroupsFound'
                                )} />
                            </View>
                        }
                        stickyHeaderIndices={[]}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={this.handleRefresh}
                        />}
                        onContentSizeChange={this.scrollTop}
                    />
                );
            case PEOPLE_CAROUSEL_TABS.CONNECTIONS:
                const connections = this.sortConnections();

                return (
                    <FlatList
                        ref={(component) => this.connectionsListRef = component}
                        data={connections}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: connection }) => (
                            <ConnectionItem
                                key={connection.id}
                                connectionDetails={this.getConnectionOrUserDetails(connection)}
                                getConnectionSubtitle={this.getConnectionSubtitle}
                                goToViewUser={this.goToViewUser}
                                isActive={connection.isActive}
                                onConnectionPress={this.onConnectionPress}
                                theme={this.theme}
                                translate={this.translate}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={spacingStyles.marginHorizLg}>
                                <ListEmpty iconName="key-user" theme={this.theme} text={this.translate(
                                    'components.contactsSearch.noContactsFound'
                                )} />
                            </View>
                        }
                        stickyHeaderIndices={[]}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={this.handleRefresh}
                        />}
                        onContentSizeChange={this.scrollTop}
                    />
                );
        }
    };

    render() {
        const { activeTabIndex, isNameConfirmModalVisible, tabRoutes } = this.state;
        const { navigation, user } = this.props;
        const createButtonTitle = tabMap[activeTabIndex] === PEOPLE_CAROUSEL_TABS.GROUPS
            ? this.translate('menus.connections.buttons.create')
            : this.translate('menus.connections.buttons.invite');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <TabView
                        lazy
                        lazyPreloadDistance={1}
                        navigationState={{
                            index: activeTabIndex,
                            routes: tabRoutes,
                        }}
                        renderTabBar={this.renderTabBar}
                        renderScene={this.renderSceneMap}
                        renderLazyPlaceholder={() => (
                            <View style={this.theme.styles.sectionContainer}>
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                            </View>
                        )}
                        onIndexChange={this.onTabSelect}
                        initialLayout={{ width: viewportWidth }}
                        // style={styles.container}
                    />
                </SafeAreaView>
                <ConfirmModal
                    isVisible={isNameConfirmModalVisible}
                    onCancel={this.toggleNameConfirmModal}
                    onConfirm={this.handleNameConfirm}
                    text={this.translate('forms.createConnection.modal.nameConfirm')}
                    textCancel={this.translate('forms.createConnection.modal.noThanks')}
                    translate={this.translate}
                    theme={this.theme}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
                <CreateConnectionButton
                    onPress={this.navToInvite}
                    themeButtons={this.themeButtons}
                    title={createButtonTitle}
                />
                <MainButtonMenu
                    activeRoute="Contacts"
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Contacts);
