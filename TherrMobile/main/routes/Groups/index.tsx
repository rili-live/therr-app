import React from 'react';
import { Dimensions, FlatList, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ForumActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IForumsState, IUserState } from 'therr-react/types';
import { GroupRequestStatuses } from 'therr-js-utilities/constants';
import { TabBar, TabView } from 'react-native-tab-view';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildTileStyles } from '../../styles/user-content/groups/chat-tiles';
import { buildStyles as buildCategoryStyles } from '../../styles/user-content/groups/categories';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import CreateConnectionButton from '../../components/CreateConnectionButton';
import { RefreshControl } from 'react-native-gesture-handler';
import LazyPlaceholder from './components/LazyPlaceholder';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ListEmpty from '../../components/ListEmpty';
import UsersActions from '../../redux/actions/UsersActions';
import { GROUPS_CAROUSEL_TABS } from '../../constants';
import GroupTile from '../Groups/GroupTile';
import GroupCategories from '../Groups/GroupCategories';

const { width: viewportWidth } = Dimensions.get('window');
export const DEFAULT_PAGE_SIZE = 50;
const tabMap = {
    0: GROUPS_CAROUSEL_TABS.DISCOVER,
    1: GROUPS_CAROUSEL_TABS.GROUPS,
};

const getActiveTabIndex = (mapOfTabs: { [key: number]: string }, activeTab?: string) => {
    if (activeTab === undefined || activeTab === null) {
        return 0;
    }

    for (const key of Object.keys(mapOfTabs)) {
        if (activeTab === mapOfTabs[key]) {
            return Number(key);
        }
    }

    return 0;
};

interface IGroupsDispatchProps {
    createUserConnection: Function;
    createUserGroup: Function;
    logout: Function;
    getUserGroups: Function;
    searchCategories: Function;
    searchForums: Function;
    searchMyForums: Function;
    searchUserConnections: Function;
    searchUsers: Function;
    searchUpdateUser: Function;
}

interface IStoreProps extends IGroupsDispatchProps {
    forums: IForumsState;
    user: IUserState;
}

// Regular component props
export interface IGroupsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IGroupsState {
    categories: any[];
    citySearchText: string;
    isNameConfirmModalVisible: boolean;
    isRefreshing: boolean;
    isMyGroupsRefreshing: boolean;
    activeTabIndex: number;
    searchFilters: any;
    searchText: string;
    tabRoutes: { key: string; title: string }[];
    toggleChevronName: 'refresh';
}

const mapStateToProps = (state) => ({
    forums: state.forums,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
            createUserGroup: UsersActions.createUserGroup,
            searchCategories: ForumActions.searchCategories,
            getUserGroups: UsersActions.getUserGroups,
            searchForums: ForumActions.searchForums,
            searchMyForums: ForumActions.searchMyForums,
            searchUserConnections: UserConnectionsActions.search,
            searchUsers: UsersActions.search,
            searchUpdateUser: UsersActions.searchUpdateUser,
        },
        dispatch
    );

class Groups extends React.Component<IGroupsProps, IGroupsState> {
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeMenu = buildMenuStyles();
    private themeTile = buildTileStyles();
    private themeCategory = buildCategoryStyles();
    private unsubscribeFocusListener;
    private discoverListRef;
    private groupsListRef;
    private searchDebounceTimer;

    static getDerivedStateFromProps(nextProps: IGroupsProps, nextState: IGroupsState) {
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
            translator(props.user.settings?.locale || 'en-us', key, params);

        const { route } = props;
        const activeTabIndex = getActiveTabIndex(tabMap, route?.params?.activeTab);

        this.state = {
            categories: props.categories || [],
            citySearchText: '',
            activeTabIndex,
            isNameConfirmModalVisible: false,
            isRefreshing: false,
            isMyGroupsRefreshing: false,
            tabRoutes: [
                { key: GROUPS_CAROUSEL_TABS.DISCOVER, title: this.translate('menus.headerTabs.groupsDiscover') },
                { key: GROUPS_CAROUSEL_TABS.GROUPS, title: this.translate('menus.headerTabs.groupsJoined') },
            ],
            toggleChevronName: 'refresh',
            searchText: '',
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
        this.themeCategory = buildCategoryStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const {
            getUserGroups, navigation, forums, searchCategories, user,
        } = this.props;

        navigation.setOptions({
            title: this.translate('pages.groups.headerTitle'),
        });

        if (!Object.keys(user.myUserGroups || {}).length) {
            getUserGroups({ withGroups: true });
        }

        if (forums && (!forums.searchResults || !forums.searchResults.length)) {
            this.handleRefreshDiscoverSearch();
        }

        if (forums && (!forums.forumCategories || !forums.forumCategories.length)) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            }, {});
        }

        this.handleRefreshMyGroupsSearch();

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            const { route } = this.props;
            const activeTabIndex = getActiveTabIndex(tabMap, route?.params?.activeTab);

            this.setState({
                activeTabIndex,
            });

            // Refresh data when returning from ViewGroup/EditGroup
            this.handleRefreshMyGroupsSearch();
            this.handleRefreshDiscoverSearch();
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
    }

    onTabSelect = (index: number) => {
        const { navigation } = this.props;
        this.setState({
            activeTabIndex: index,
        });

        navigation.setParams({
            activeTab: tabMap[index],
        });
    };

    handleRefreshDiscoverSearch = () => {
        const { searchFilters, searchText, citySearchText, categories } = this.state;
        this.setState({
            isRefreshing: true,
        });

        const selectedCategoryTags = (categories || []).filter(c => c.isActive).map(c => c.tag);
        const searchParams: any = {
            ...searchFilters,
        };
        if (searchText) {
            searchParams.query = searchText;
            searchParams.filterBy = 'title';
            searchParams.filterOperator = 'ilike';
        }
        const searchArgs: any = {};
        if (selectedCategoryTags.length) {
            searchArgs.categoryTags = selectedCategoryTags;
        }
        if (citySearchText) {
            searchArgs.nearbyCity = citySearchText;
        }

        this.props
            .searchForums(searchParams, searchArgs)
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshing: false,
                });
            });
    };

    handleRefreshMyGroupsSearch = () => {
        const { user, searchMyForums } = this.props;
        const { searchFilters } = this.state;

        const myGroupIds = Object.keys(user.myUserGroups || {}).filter(
            (groupId) => user.myUserGroups[groupId]?.status === GroupRequestStatuses.APPROVED
        );

        if (!myGroupIds.length) {
            return;
        }

        this.setState({ isMyGroupsRefreshing: true });

        searchMyForums(searchFilters, { forumIds: myGroupIds })
            .catch(() => {})
            .finally(() => {
                this.setState({ isMyGroupsRefreshing: false });
            });
    };

    handleNameConfirm = () => {
        const { navigation } = this.props;

        this.toggleNameConfirmModal();
        navigation.navigate('Settings');
    };

    toggleNameConfirmModal = () => {
        this.setState({
            isNameConfirmModalVisible: !this.state.isNameConfirmModalVisible,
        });
    };

    onCreatePress = () => {
        const { navigation } = this.props;
        navigation.navigate('EditGroup');
    };

    scrollTop = () => {
        if (this.state.activeTabIndex === 0) {
            this.discoverListRef?.scrollToOffset({ animated: true, offset: 0 });
        } else {
            this.groupsListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
    };

    sortGroups = (groups: any[]): any[] => {
        return groups || [];
    };

    handleChatTilePress = (chat) => {
        const { navigation } = this.props;

        navigation.navigate('ViewGroup', {
            ...chat,
        });
    };

    handleSearchTextChange = (text: string) => {
        this.setState({ searchText: text }, this.debouncedDiscoverSearch);
    };

    handleCitySearchChange = (text: string) => {
        this.setState({ citySearchText: text }, this.debouncedDiscoverSearch);
    };

    debouncedDiscoverSearch = () => {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
            this.handleRefreshDiscoverSearch();
        }, 400);
    };

    searchForumsWithFilters = (text, modifiedCategories?) => {
        const { searchForums } = this.props;
        const { categories, searchFilters, citySearchText } = this.state;

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
        if (citySearchText) {
            searchArgs.nearbyCity = citySearchText;
        }
        searchForums(searchParams, searchArgs);
    };

    handleCategoryPress = (category) => {
        const { categories, searchText } = this.state;
        const modifiedCategories: any = [ ...categories ];

        modifiedCategories.some((c, i) => {
            if (c.tag === category.tag) {
                modifiedCategories[i] = { ...c, isActive: !c.isActive };
                return true;
            }
        });

        this.searchForumsWithFilters(searchText, modifiedCategories);

        this.setState({
            categories: modifiedCategories,
        });
    };

    handleCategoryTogglePress = () => {
        const { categories, searchText } = this.state;
        const modifiedCategories: any = [ ...categories ];
        modifiedCategories.forEach((c, i) => {
            modifiedCategories[i] = { ...c, isActive: false };
        });

        this.searchForumsWithFilters(searchText, modifiedCategories);

        this.setState({
            categories: modifiedCategories,
        });
    };

    onJoinGroup = (group) => {
        const { createUserGroup, searchMyForums, user } = this.props;
        const { searchFilters } = this.state;

        createUserGroup({
            groupId: group.id,
        }).then(() => {
            const myGroupIds = Object.keys(user.myUserGroups || {})
                .filter((id) => user.myUserGroups[id]?.status === GroupRequestStatuses.APPROVED);
            if (!myGroupIds.includes(group.id)) {
                myGroupIds.push(group.id);
            }
            if (myGroupIds.length) {
                searchMyForums(searchFilters, { forumIds: myGroupIds });
            }
        }).catch((err) => {
            console.log(err);
        });
    };

    renderTabBar = (props) => {
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

    renderSearchHeader = () => {
        const { categories, searchText, citySearchText, toggleChevronName } = this.state;

        return (
            <View>
                <View style={{
                    flexDirection: 'row',
                    paddingHorizontal: 10,
                    paddingTop: 8,
                    paddingBottom: 4,
                    gap: 8,
                }}>
                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: this.theme.colorVariations.primaryFadeMore || '#f0f0f0',
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        height: 38,
                    }}>
                        <MaterialIcon name="search" size={20} color={this.theme.colors.placeholderTextColor} />
                        <TextInput
                            style={{
                                flex: 1,
                                fontSize: 14,
                                paddingVertical: 4,
                                paddingHorizontal: 6,
                                color: this.theme.colors.textWhite,
                            }}
                            placeholder={this.translate('forms.groups.searchPlaceholder')}
                            placeholderTextColor={this.theme.colors.placeholderTextColor}
                            value={searchText}
                            onChangeText={this.handleSearchTextChange}
                            autoCorrect={false}
                        />
                    </View>
                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: this.theme.colorVariations.primaryFadeMore || '#f0f0f0',
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        height: 38,
                    }}>
                        <MaterialIcon name="location-on" size={20} color={this.theme.colors.placeholderTextColor} />
                        <TextInput
                            style={{
                                flex: 1,
                                fontSize: 14,
                                paddingVertical: 4,
                                paddingHorizontal: 6,
                                color: this.theme.colors.textWhite,
                            }}
                            placeholder={this.translate('forms.groups.cityPlaceholder')}
                            placeholderTextColor={this.theme.colors.placeholderTextColor}
                            value={citySearchText}
                            onChangeText={this.handleCitySearchChange}
                            autoCorrect={false}
                        />
                    </View>
                </View>
                <GroupCategories
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
                />
            </View>
        );
    };

    renderSceneMap = ({ route }) => {
        const { isRefreshing, isMyGroupsRefreshing } = this.state;
        const { forums, user } = this.props;

        switch (route.key) {
            case GROUPS_CAROUSEL_TABS.DISCOVER: {
                const groups = this.sortGroups(forums?.searchResults);

                return (
                    <FlatList
                        ref={(component) => { this.discoverListRef = component; }}
                        data={groups}
                        keyExtractor={(item) => String(item.id)}
                        ListHeaderComponent={this.renderSearchHeader()}
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
                            onRefresh={this.handleRefreshDiscoverSearch}
                        />}
                        initialNumToRender={8}
                        maxToRenderPerBatch={5}
                        windowSize={11}
                    />
                );
            }
            case GROUPS_CAROUSEL_TABS.GROUPS: {
                const myGroups = this.sortGroups(forums?.myForumsSearchResults);

                return (
                    <FlatList
                        ref={(component) => { this.groupsListRef = component; }}
                        data={myGroups}
                        keyExtractor={(item) => String(item.id)}
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
                                    'pages.groups.noMyGroupsFound'
                                )} />
                                <Pressable
                                    onPress={() => this.onTabSelect(0)}
                                    style={{
                                        marginTop: 16,
                                        marginHorizontal: 40,
                                        backgroundColor: this.theme.colors.primary3,
                                        borderRadius: 8,
                                        paddingVertical: 10,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{ color: this.theme.colors.brandingWhite, fontSize: 16, fontWeight: '600' }}>
                                        {this.translate('pages.groups.discoverGroups')}
                                    </Text>
                                </Pressable>
                            </View>
                        }
                        stickyHeaderIndices={[]}
                        refreshControl={<RefreshControl
                            refreshing={isMyGroupsRefreshing}
                            onRefresh={this.handleRefreshMyGroupsSearch}
                        />}
                        initialNumToRender={8}
                        maxToRenderPerBatch={5}
                        windowSize={11}
                    />
                );
            }
            default:
                return null;
        }
    };

    render() {
        const { activeTabIndex, isNameConfirmModalVisible, tabRoutes } = this.state;
        const { navigation, user } = this.props;

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
                    title={this.translate('menus.connections.buttons.create')}
                />
                <MainButtonMenu
                    activeRoute="Groups"
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

export default connect(mapStateToProps, mapDispatchToProps)(Groups);
