import React from 'react';
import { Dimensions, FlatList, SafeAreaView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ForumActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IForumsState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { TabBar, TabView } from 'react-native-tab-view';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildTileStyles } from '../../styles/user-content/groups/chat-tiles';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildCategoryStyles } from '../../styles/user-content/groups/categories';
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
import GroupTile from '../Groups/GroupTile';
import GroupCategories from '../Groups/GroupCategories';

const { width: viewportWidth } = Dimensions.get('window');
const DEFAULT_PAGE_SIZE = 50;
const tabMap = {
    0: PEOPLE_CAROUSEL_TABS.PEOPLE,
    1: PEOPLE_CAROUSEL_TABS.GROUPS,
    2: PEOPLE_CAROUSEL_TABS.CONNECTIONS,
};

interface IContactsDispatchProps {
    createUserConnection: Function;
    createUserGroup: Function;
    logout: Function;
    getUserGroups: Function;
    searchCategories: Function;
    searchForums: Function;
    searchUserConnections: Function;
    searchUsers: Function;
    searchUpdateUser: Function;
}

interface IStoreProps extends IContactsDispatchProps {
    forums: IForumsState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IContactsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IContactsState {
    categories: any[];
    isNameConfirmModalVisible: boolean;
    isRefreshing: boolean;
    isRefreshingUserSearch: boolean;
    activeTabIndex: number;
    searchFilters: any;
    tabRoutes: { key: string; title: string }[];
    toggleChevronName: 'refresh',
}

const mapStateToProps = (state) => ({
    forums: state.forums,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
            createUserGroup: UsersActions.createUserGroup,
            searchCategories: ForumActions.searchCategories,
            getUserGroups: UsersActions.getUserGroups,
            searchForums: ForumActions.searchForums,
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
    private themeTile = buildTileStyles();
    private themeForms = buildFormsStyles();
    private themeCategory = buildCategoryStyles();
    private unsubscribeFocusListener;
    private peopleListRef;
    private connectionsListRef;
    private groupsListRef;

    static getDerivedStateFromProps(nextProps: IContactsProps, nextState: IContactsState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums.forumCategories,
            };
        }

        return null;
    }

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
            categories: props.categories || [],
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
            toggleChevronName: 'refresh',
            searchFilters: {
                itemsPerPage: DEFAULT_PAGE_SIZE,
                pageNumber: 1,
                order: 'desc',
            },
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeTile = buildTileStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormsStyles(props.user.settings?.mobileThemeName);
        this.themeCategory = buildCategoryStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const {
            getUserGroups, navigation, forums, searchCategories, user, userConnections,
        } = this.props;

        navigation.setOptions({
            title: this.translate('pages.contacts.headerTitle'),
        });

        if ((userConnections.connections.length || 0) < DEFAULT_PAGE_SIZE) {
            this.handleRefresh();
        }

        if (!user.myUserGroups?.length) {
            getUserGroups();
        }

        if ((Object.keys(user.users || {})?.length || 0) < DEFAULT_PAGE_SIZE) {
            this.handleRefreshUsersSearch();
        }

        if (forums && (!forums.searchResults || !forums.searchResults.length)) {
            this.handleRefreshForumsSearch();
        }

        if (forums && (!forums.forumCategories || !forums.forumCategories.length)) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            }, {});
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
        const { navigation } = this.props;
        this.setState({
            activeTabIndex: index,
        });

        navigation.setParams({
            activeTab: tabMap[index],
        });
    };

    trySearchMoreUsers = () => {

    };

    handleRefreshForumsSearch = () => {
        const { searchFilters } = this.state;
        this.setState({
            isRefreshingUserSearch: true,
        });

        this.props
            .searchForums(searchFilters, {})
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshingUserSearch: false,
                });
            });
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

    onCreatePress = () => {
        const { activeTabIndex } = this.state;
        const { navigation } = this.props;

        if (tabMap[activeTabIndex] === PEOPLE_CAROUSEL_TABS.GROUPS) {
            navigation.navigate('EditGroup');
        } else {
            navigation.navigate('Invite');
        }
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
        const { forums } = this.props;
        const groups = (forums && forums.searchResults) || [];
        // TODO: Sort by more recently active
        return groups;
    };

    handleChatTilePress = (chat) => {
        const { navigation } = this.props;

        navigation.navigate('ViewChat', chat);
    };

    searchForumsWithFilters = (text, modifiedCategories?) => {
        const { searchForums } = this.props;
        const { categories, searchFilters } = this.state;

        const selectedCategoryTags = (modifiedCategories || categories).filter(c => c.isActive).map(c => c.tag);
        const searchParams = {
            ...searchFilters,
            query: text,
            filterBy: 'title',
            filterOperator: 'ilike',
        };
        const searchArgs: any = {};
        if (selectedCategoryTags.length) {
            searchArgs.categoryTags = selectedCategoryTags;
        }
        searchForums(searchParams, searchArgs);
    };

    handleCategoryPress = (category) => {
        const { categories } = this.state;
        const modifiedCategories: any = [ ...categories ];

        modifiedCategories.some((c, i) => {
            if (c.tag === category.tag) {
                modifiedCategories[i] = { ...c, isActive: !c.isActive };
                return true;
            }
        });

        this.searchForumsWithFilters('', modifiedCategories);

        this.setState({
            categories: modifiedCategories,
        });
    };

    handleCategoryTogglePress = () => {
        const { categories } = this.state;
        const modifiedCategories: any = [ ...categories ];
        modifiedCategories.forEach((c, i) => {
            modifiedCategories[i] = { ...c, isActive: false };
        });

        this.searchForumsWithFilters('', modifiedCategories);

        this.setState({
            categories: modifiedCategories,
        });
    };

    onJoinGroup = (group) => {
        const { createUserGroup } = this.props;

        createUserGroup({
            groupId: group.id,
        }).catch((err) => {
            console.log(err);
        });
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
        const { categories, toggleChevronName, isRefreshing, isRefreshingUserSearch } = this.state;
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
                        ListHeaderComponent={<GroupCategories
                            style={{}}
                            backgroundColor={this.theme.colors.primary}
                            categories={categories}
                            onCategoryPress={this.handleCategoryPress}
                            translate={this.translate}
                            onCategoryTogglePress={this.handleCategoryTogglePress}
                            toggleChevronName={toggleChevronName}
                            theme={this.theme}
                            themeButtons={this.themeButtons}
                            themeCategory={this.themeCategory}
                        />}
                        renderItem={({ item: group }) => (
                            <GroupTile
                                group={group}
                                onChatTilePress={this.handleChatTilePress}
                                theme={this.theme}
                                themeButtons={this.themeButtons}
                                themeChatTile={this.themeTile}
                                translate={this.translate}
                                handleJoinGroup={this.onJoinGroup}
                                user={user}
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
                            onRefresh={this.handleRefreshForumsSearch}
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
                    onPress={this.onCreatePress}
                    themeButtons={this.themeButtons}
                    title={createButtonTitle}
                />
                <MainButtonMenu
                    activeRoute="Connect"
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
