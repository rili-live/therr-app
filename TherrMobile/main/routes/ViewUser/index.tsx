import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Dimensions,
    Text,
    View} from 'react-native';
import { FAB } from 'react-native-paper';
import 'react-native-gesture-handler';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
    HabitActions,
    MapActions,
    UserConnectionsActions,
} from 'therr-react/redux/actions';
import {
    UsersService,
    ReactionsService,
} from 'therr-react/services';
import {
    IContentState,
    IUserState,
    IUserConnectionsState,
    IHabitsState,
    IPact,
} from 'therr-react/types';
import { BrandVariations } from 'therr-js-utilities/constants';
import { TabBar, TabView } from 'react-native-tab-view';
import { showToast } from '../../utilities/toasts';
import { ContentActions } from 'therr-react/redux/actions';
import UsersActions from '../../redux/actions/UsersActions';
import BaseStatusBar from '../../components/BaseStatusBar';
import { isDarkTheme } from '../../styles/themes';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildUserStyles } from '../../styles/user-content/user-display';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildAchievementStyles } from '../../styles/achievements';
import translator from '../../utilities/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import UserDisplayHeader from './UserDisplayHeader';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import LazyPlaceholder from '../../components/LazyPlaceholder';
import TabViewLoadingOverlay from '../../components/TabViewLoadingOverlay';
import AreaCarousel from '../Areas/AreaCarousel';
import { PactCard } from '../../components/Habits';
import AchievementTile from '../Achievements/AchievementTile';
import { isMyContent } from '../../utilities/content';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import { handleAreaReaction, handleThoughtReaction, navToViewContent } from '../../utilities/postViewHelpers';
import TherrIcon from '../../components/TherrIcon';
import getDirections from '../../utilities/getDirections';
import { PEOPLE_CAROUSEL_TABS, PROFILE_CAROUSEL_TABS } from '../../constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';

const IS_HABITS = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

const { width: viewportWidth } = Dimensions.get('window');
const HABITS_TAB_LIST_CONTENT_STYLE = { paddingBottom: 120, paddingTop: 8 };

const renderIdeaIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="idea" size={props.size} color={props.color} />
);
function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface IViewUserDispatchProps {
    blockUser: Function;
    getIntegratedMoments: Function;
    getUser: Function;
    createOrUpdateEventReaction: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateThoughtReaction: Function;
    createOrUpdateSpaceReaction: Function;
    searchThoughts: Function;
    updateUserInView: Function;
    createUserConnection: Function;
    updateUserConnection: Function;
    getMyAchievements: Function;
    getActivePacts: Function;
    getUserPacts: Function;
    getActiveStreaks: Function;
}

interface IStoreProps extends IViewUserDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
    habits: IHabitsState;
}

// Regular component props
export interface IViewUserProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewUserState {
    confirmModalText: string;
    activeConfirmModal: '' | 'report-user' | 'block-user' | 'remove-connection-request' | 'send-connection-request';
    activeTabIndex: number;
    isConfirmProcessing: boolean;
    isLoading: boolean;
    isRefreshingUserMedia: boolean;
    isRefreshingUserMoments: boolean;
    isRefreshingUserThoughts: boolean;
    isRefreshingHabitsData: boolean;
    isTabViewLaidOut: boolean;
    tabRoutes: { key: string; title: string }[];
    userInViewsMoments: any[];
    userInViewsThoughts: any[];
}

const mapStateToProps = (state) => ({
    content: state.content,
    notifications: state.notifications,
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    blockUser: UsersActions.block,
    getIntegratedMoments: MapActions.getIntegratedMoments,
    getUser: UsersActions.get,
    createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,
    createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
    createOrUpdateThoughtReaction: ContentActions.createOrUpdateThoughtReaction,
    createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
    searchThoughts: UsersActions.searchThoughts,
    updateUserInView: UsersActions.updateUserInView,
    createUserConnection: UserConnectionsActions.create,
    updateUserConnection: UserConnectionsActions.update,
    getMyAchievements: UsersActions.getMyAchievements,
    getActivePacts: HabitActions.getActivePacts,
    getUserPacts: HabitActions.getUserPacts,
    getActiveStreaks: HabitActions.getActiveStreaks,
}, dispatch);

class ViewUser extends React.Component<
    IViewUserProps,
    IViewUserState
> {
    private carouselMomentsRef;
    private carouselThoughtsRef;
    private flatListRef: any;
    private loaderId;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeForms = buildFormStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeUser = buildUserStyles();
    private themeHabits = buildHabitStyles();
    private themeAchievements = buildAchievementStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);

        const { route } = props;
        const { userInView } = route.params;
        const activeTabIndex = 0;
        const isMe = userInView?.id === props.user.details.id;

        this.state = {
            activeTabIndex,
            confirmModalText: '',
            activeConfirmModal: '',
            isConfirmProcessing: false,
            isLoading: true,
            isRefreshingUserMedia: false,
            isRefreshingUserMoments: false,
            isRefreshingUserThoughts: false,
            isRefreshingHabitsData: false,
            isTabViewLaidOut: false,
            tabRoutes: this.buildTabRoutes(isMe),
            userInViewsMoments: [],
            userInViewsThoughts: [],
        };

        this.loaderId = getRandomLoaderId();
        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeUser = buildUserStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.themeAchievements = buildAchievementStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.viewUser.headerTitle'),
        });

        this.fetchUser();
    }

    componentDidUpdate(prevProps) {
        const prevRouteUserId = prevProps.route?.params?.userInView?.id;
        const currentRouteUserId = this.props.route?.params?.userInView?.id;
        const reduxUserInViewId = this.props.user.userInView?.id;
        const routeParamChanged = prevRouteUserId !== currentRouteUserId;
        // Fallback: if Redux userInView is stale relative to the route param
        // (e.g. after returning to this screen via setParams/navigate where
        // the diff was missed), force a refetch so the UI never keeps the
        // previous user's data visible.
        const reduxOutOfSync = !!currentRouteUserId
            && reduxUserInViewId !== currentRouteUserId
            && !this.state.isLoading;

        if (routeParamChanged || reduxOutOfSync) {
            const isMe = currentRouteUserId === this.props.user.details.id;
            this.setState({
                isLoading: true,
                tabRoutes: this.buildTabRoutes(isMe),
                userInViewsMoments: [],
                userInViewsThoughts: [],
            });
            this.fetchUser();
        }
    }

    buildTabRoutes = (isMe: boolean): { key: string; title: string }[] => {
        if (IS_HABITS) {
            const routes = [
                { key: PROFILE_CAROUSEL_TABS.GOALS, title: this.translate('menus.headerTabs.goals') },
            ];
            if (isMe) {
                routes.push(
                    { key: PROFILE_CAROUSEL_TABS.PACTS, title: this.translate('menus.headerTabs.pacts') },
                    { key: PROFILE_CAROUSEL_TABS.ACHIEVEMENTS, title: this.translate('menus.headerTabs.achievements') },
                );
            }
            return routes;
        }
        const routes = [
            { key: PROFILE_CAROUSEL_TABS.THOUGHTS, title: this.translate('menus.headerTabs.thoughts') },
        ];
        if (isMe) {
            routes.unshift({ key: PROFILE_CAROUSEL_TABS.MOMENTS, title: this.translate('menus.headerTabs.moments') });
        }
        return routes;
    };

    fetchUser = () => {
        const { getUser, getIntegratedMoments, navigation, route, user } = this.props;
        const { userInView } = route.params;

        getUser(userInView.id).then((response) => {
            navigation.setOptions({
                title: response?.userName || this.translate('pages.viewUser.headerTitle'),
            });
            this.setState({
                isLoading: false,
            });
            if (response?.id) {
                const isMe = response.id === user.details.id;
                // Media
                // TODO: Maybe only load after clicking tab
                Promise.resolve(getIntegratedMoments(response?.id))
                    .catch((err) => console.log('getIntegratedMoments failed:', err));
                this.fetchMoments();
                this.fetchThoughts();
                if (IS_HABITS && isMe) {
                    this.fetchHabitsProfileData();
                }
            }
        }).catch((error) => {
            console.log(error);
            if (error?.statusCode === 404) {
                navigation?.goBack();
            }
            this.setState({
                isLoading: false,
            });
        });
    };

    goToConnections = () => {
        const { navigation, user } = this.props;
        const isMe = user.userInView?.id === user.details.id;

        if (isMe) {
            navigation.navigate('Connect', {
                activeTab: PEOPLE_CAROUSEL_TABS.CONNECTIONS,
            });
        }
    };

    goToThought = (content) => {
        const { navigation, route, user } = this.props;
        const { userInView } = route.params;

        navigation.navigate('ViewThought', {
            isMyContent: isMyContent(content, user),
            previousView: 'ViewUser',
            previousViewParams: {
                userInView,
            },
            thought: content,
            thoughtDetails: {},
        });
    };

    goToContent = (content) => {
        const { navigation, user, route } = this.props;
        const { userInView } = route.params;

        navToViewContent(content, user, navigation.navigate, 'ViewUser', {
            userInView,
        });
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    scrollTop = () => {
        this.flatListRef?.scrollToOffset({ animated: true, offset: 0 });
    };

    toggleAreaOptions = (displayArea) => {
        const area = displayArea || {};
        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'area',
                translate: this.translate,
                themeForms: this.themeForms,
                onSelect: (type: IContentSelectionType) => this.onAreaOptionSelect(type, area),
            },
        });
    };

    toggleThoughtOptions = (displayThought) => {
        const thought = displayThought || {};
        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'thought',
                translate: this.translate,
                themeForms: this.themeForms,
                onSelect: (type: IContentSelectionType) => this.onThoughtOptionSelect(type, thought),
            },
        });
    };

    // TODO: This is so damn ugly. Refactor this!
    createUpdateMomentReaction = (
        momentId: number,
        params: any,
        momentUserId: string,
        reactorUserName: string,
    ) => {
        const { createOrUpdateMomentReaction } = this.props;
        const { userInViewsMoments } = this.state;

        createOrUpdateMomentReaction(momentId, params, momentUserId, reactorUserName).then((reaction) => {
            const modifiedMoments = userInViewsMoments.map((moment) => {
                if (moment.id === momentId) {
                    moment.reaction = reaction;
                }

                return moment;
            });

            this.setState({
                userInViewsMoments: modifiedMoments,
            });
        });
    };

    // TODO: This is so damn ugly. Refactor this!
    createUpdateThoughtReaction = (
        thoughtId: number,
        params: any,
        thoughtUserId: string,
        reactorUserName: string,
    ) => {
        const { createOrUpdateThoughtReaction } = this.props;
        const { userInViewsThoughts } = this.state;

        createOrUpdateThoughtReaction(thoughtId, params, thoughtUserId, reactorUserName).then((reaction) => {
            const modifiedThoughts = userInViewsThoughts.map((thought) => {
                if (thought.id === thoughtId) {
                    thought.reaction = reaction;
                }

                return thought;
            });

            this.setState({
                userInViewsThoughts: modifiedThoughts,
            });
        });
    };

    handleRefresh = () => {
        this.setState({ isLoading: true });
        this.fetchUser();
    };

    handleUserMomentsRefresh = () => {
        const { user } = this.props;

        this.setState({ isRefreshingUserMoments: true });

        return user.userInView ? this.fetchMoments().then(() => {
            this.setState({ isRefreshingUserMoments: false });
        }) : null;
    };

    handleUserThoughtsRefresh = () => {
        const { user } = this.props;

        this.setState({ isRefreshingUserThoughts: true });

        return user.userInView ? this.fetchThoughts().then(() => {
            this.setState({ isRefreshingUserThoughts: false });
        }) : null;
    };

    fetchMoments = () => {
        const { user } = this.props;
        const isMe = user.userInView?.id === user.details.id;

        // TODO: Change this to a service request rather than redux action to prevent altering redux state
        return ReactionsService.searchActiveMoments(
            {
                authorId: user.userInView?.id,
                withUser: true,
                withMedia: true,
                offset: 0,
                // ...content.activeAreasFilters,
                blockedUsers: user.details.blockedUsers,
                shouldHideMatureContent: isMe ? false : user.details.shouldHideMatureContent,
            },
            63, // NOTE: SQL Query includes moment replies, so use (21 * 3) for more results per request
        ).then(({ data }) => {
            // TODO: Store these on userInView? or nearby
            this.setState({
                userInViewsMoments: data?.moments || [],
            });
        });
    };

    fetchThoughts = () => {
        const { user } = this.props;
        const isMe = user.userInView?.id === user.details.id;

        // TODO: Change this to a service request rather than redux action to prevent altering redux state
        return ReactionsService.searchActiveThoughts(
            {
                authorId: user.userInView?.id,
                withUser: true,
                withReplies: true,
                offset: 0,
                // ...content.activeAreasFilters,
                blockedUsers: user.details.blockedUsers,
                shouldHideMatureContent: isMe ? false : user.details.shouldHideMatureContent,
            },
            63, // NOTE: SQL Query includes thought replies, so use (21 * 3) for more results per request
        ).then(({ data }) => {
            // TODO: Store these on userInView? or nearby
            this.setState({
                userInViewsThoughts: data?.thoughts || [],
            });
        });
    };

    fetchHabitsProfileData = () => {
        const { getActivePacts, getUserPacts, getMyAchievements, getActiveStreaks } = this.props;
        return Promise.all([
            getActivePacts(),
            getUserPacts(),
            getMyAchievements(),
            getActiveStreaks(),
        ]).catch((err) => console.log('fetchHabitsProfileData failed:', err));
    };

    handleHabitsRefresh = () => {
        this.setState({ isRefreshingHabitsData: true });
        this.fetchHabitsProfileData().finally(() => {
            this.setState({ isRefreshingHabitsData: false });
        });
    };

    handleEditThought = () => {
        const { navigation } = this.props;

        navigation.navigate('EditThought', {});
    };

    onAreaOptionSelect = (type: IContentSelectionType, area: any) => {
        const { createOrUpdateEventReaction, createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;

        if (type === 'getDirections') {
            getDirections({
                latitude: area.latitude,
                longitude: area.longitude,
                title: area.notificationMsg,
            });
        } else {
            handleAreaReaction(area, type, {
                user,
                createOrUpdateEventReaction,
                createOrUpdateMomentReaction,
                createOrUpdateSpaceReaction,
                toggleAreaOptions: this.toggleAreaOptions,
                translate: this.translate,
            });
        }
    };

    onThoughtOptionSelect = (type: IContentSelectionType, thought: any) => {
        const { createOrUpdateThoughtReaction, user } = this.props;

        handleThoughtReaction(thought, type, {
            user,
            createOrUpdateThoughtReaction,
            toggleThoughtOptions: this.toggleThoughtOptions,
            translate: this.translate,
        });
    };

    onProfilePicturePress = (selectedUser, isOwnProfile) => {
        console.log('onProfilePicturePress', selectedUser, isOwnProfile);
    };

    onBlockUser = (context, selectedUser) => {
        this.setState({
            confirmModalText: this.translate('modals.confirmModal.blockUser', { userName: selectedUser.userName }),
            activeConfirmModal: 'block-user',
        });
    };

    onConnectionRequest = (context, selectedUser) => {
        if (selectedUser.isNotConnected) {
            this.setState({
                confirmModalText: this.translate('modals.confirmModal.connect', { userName: selectedUser.userName }),
                activeConfirmModal: 'send-connection-request',
            });
        } else {
            this.setState({
                confirmModalText: this.translate('modals.confirmModal.unconnect', { userName: selectedUser.userName }),
                activeConfirmModal: 'remove-connection-request',
            });
        }
    };

    onMessageUser = (context, selectedUser) => {
        // TODO: Update DirectMessage to support messaging non-connected users
        const { navigation } = this.props;
        navigation.navigate('DirectMessage', {
            connectionDetails: {
                id: selectedUser.id,
                userName: selectedUser.userName,
            },
        });
    };

    onReportUser = (context, selectedUser) => {
        this.setState({
            confirmModalText: this.translate('modals.confirmModal.reportUser', { userName: selectedUser.userName }),
            activeConfirmModal: 'report-user',
        });
    };

    onCancelConfirmModal = () => {
        this.setState({
            activeConfirmModal: '',
        });
    };

    onAcceptConfirmModal = () => {
        const { activeConfirmModal } = this.state;
        const { blockUser, navigation, updateUserConnection, createUserConnection, user, updateUserInView } = this.props;

        this.setState({ isConfirmProcessing: true });

        const resetProcessing = () => {
            this.setState({ isConfirmProcessing: false, activeConfirmModal: '' });
        };

        if (activeConfirmModal === 'report-user') {
            UsersService.report(user?.userInView.id);
            // TODO: Add success toast
            resetProcessing();
        } else if (activeConfirmModal === 'block-user') {
            // TODO: Add success toast
            // TODO: RMOBILE-35: ...
            blockUser(user.userInView?.id, user.details.blockedUsers);
            resetProcessing();
            navigation.navigate('Areas');
        } else if (activeConfirmModal === 'send-connection-request') {
            createUserConnection({
                requestingUserId: user.details.id,
                requestingUserFirstName: user.details.firstName,
                requestingUserLastName: user.details.lastName,
                requestingUserEmail: user.details.email,
                acceptingUserId: user?.userInView.id,
                acceptingUserPhoneNumber: user?.userInView.phoneNumber,
                acceptingUserEmail: user?.userInView.email,
            }, {
                userName: user?.details?.userName,
            }).then(() => {
                updateUserInView({
                    isPendingConnection: true,
                });
            }).catch(() => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                });
            }).finally(() => {
                resetProcessing();
            });
        } else if (activeConfirmModal === 'remove-connection-request') {
            // TODO: Add success toast
            updateUserConnection({
                connection: {
                    isConnectionBroken: true,
                    otherUserId: user.userInView?.id,
                },
                user: user.details,
            });
            resetProcessing();
            navigation.navigate('Areas');
        } else {
            resetProcessing();
        }
    };

    onTabSelect = (index: number) => {
        const { tabRoutes } = this.state;
        const key = tabRoutes[index]?.key;
        if (key === PROFILE_CAROUSEL_TABS.MOMENTS) {
            this.carouselMomentsRef?.scrollToOffset({ animated: true, offset: 0 });
        } else if (key === PROFILE_CAROUSEL_TABS.THOUGHTS || key === PROFILE_CAROUSEL_TABS.GOALS) {
            this.carouselThoughtsRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        this.setState({
            activeTabIndex: index,
        });
    };

    handleTabContainerLayout = (e) => {
        if (this.state.isTabViewLaidOut) {
            return;
        }
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            this.setState({ isTabViewLaidOut: true });
        }
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

    renderThoughtsScene = (emptyMessageKey: string) => {
        const { isRefreshingUserMedia, userInViewsThoughts } = this.state;
        const { content, user } = this.props;
        const fetchMedia = () => {};
        const noop = () => {};
        return (
            <AreaCarousel
                activeData={userInViewsThoughts}
                content={content}
                inspectContent={this.goToContent}
                isLoading={isRefreshingUserMedia}
                fetchMedia={fetchMedia}
                goToViewMap={noop}
                goToViewUser={this.goToViewUser}
                toggleAreaOptions={noop}
                toggleThoughtOptions={this.toggleThoughtOptions}
                translate={this.translate}
                containerRef={(component) => { this.carouselThoughtsRef = component; }}
                handleRefresh={this.handleUserThoughtsRefresh}
                onEndReached={noop} // TODO
                updateEventReaction={noop}
                updateMomentReaction={noop}
                updateSpaceReaction={noop}
                updateThoughtReaction={this.createUpdateThoughtReaction}
                emptyListMessage={this.translate(emptyMessageKey)}
                renderHeader={() => null}
                renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                user={user}
                rootStyles={this.theme.styles}
            />
        );
    };

    renderEmptyPacts = () => (
        <View style={this.themeHabits.styles.emptyStateContainer}>
            <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
            <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                {this.translate('user.profile.text.noMePacts')}
            </Text>
        </View>
    );

    renderEmptyAchievements = () => (
        <View style={this.themeHabits.styles.emptyStateContainer}>
            <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🏆'}</Text>
            <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                {this.translate('user.profile.text.noMeAchievements')}
            </Text>
        </View>
    );

    renderPactItem = ({ item }: { item: IPact }) => {
        const { navigation, user } = this.props;
        const currentUserId = user.details?.id || '';
        return (
            <PactCard
                pact={item}
                currentUserId={currentUserId}
                onPress={() => navigation.navigate('PactDetail', { pactId: item.id })}
                themeHabits={this.themeHabits}
                translate={this.translate}
            />
        );
    };

    renderAchievementItem = ({ item }: { item: any }) => {
        // Profile tab is a read-only summary — taps and claims both route to the dedicated
        // Achievements screen, which owns the full claim flow.
        const goToAchievements = () => this.props.navigation.navigate('Achievements');
        return (
            <AchievementTile
                userAchievement={item}
                claimText={this.translate('pages.achievements.info.claimRewards')}
                completedText={this.translate('pages.achievements.info.completed')}
                handleClaim={goToAchievements}
                isClaiming={false}
                onPressAchievement={goToAchievements}
                themeAchievements={this.themeAchievements}
            />
        );
    };

    renderHabitsPactsScene = () => {
        const { habits } = this.props;
        const { isRefreshingHabitsData } = this.state;
        // Show active pacts first, then completed pacts beneath. Filter out other lifecycle states
        // (pending, abandoned, expired) — those belong on the dedicated PactsList screen.
        const allPacts = habits.pacts || [];
        const activePacts = allPacts.filter((p) => p.status === 'active');
        const completedPacts = allPacts.filter((p) => p.status === 'completed');
        const data: IPact[] = [...activePacts, ...completedPacts];
        return (
            <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                renderItem={this.renderPactItem}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshingHabitsData}
                        onRefresh={this.handleHabitsRefresh}
                    />
                }
                ListEmptyComponent={this.renderEmptyPacts}
                contentContainerStyle={HABITS_TAB_LIST_CONTENT_STYLE}
            />
        );
    };

    renderHabitsAchievementsScene = () => {
        const { user } = this.props;
        const { isRefreshingHabitsData } = this.state;
        const achievements = Object.values(user.achievements || {});
        return (
            <FlatList
                data={achievements}
                keyExtractor={(item: any) => item.id}
                renderItem={this.renderAchievementItem}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshingHabitsData}
                        onRefresh={this.handleHabitsRefresh}
                    />
                }
                ListEmptyComponent={this.renderEmptyAchievements}
                contentContainerStyle={HABITS_TAB_LIST_CONTENT_STYLE}
            />
        );
    };

    renderSceneMap = ({ route }) => {
        const { isRefreshingUserMedia, userInViewsMoments } = this.state;
        const {
            content,
            user,
        } = this.props;
        const isMe = user.userInView?.id === user.details.id;

        // TODO: Fetch missing media
        const fetchMedia = () => {};
        const noop = () => {};

        switch (route.key) {
            case PROFILE_CAROUSEL_TABS.MOMENTS:
                return (
                    <AreaCarousel
                        activeData={userInViewsMoments}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isRefreshingUserMedia}
                        fetchMedia={fetchMedia}
                        goToViewMap={noop}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.toggleAreaOptions}
                        toggleThoughtOptions={noop}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselMomentsRef = component; }}
                        handleRefresh={this.handleUserMomentsRefresh}
                        onEndReached={noop} // TODO
                        updateEventReaction={noop}
                        updateMomentReaction={this.createUpdateMomentReaction}
                        updateSpaceReaction={noop}
                        updateThoughtReaction={noop}
                        emptyListMessage={this.translate(isMe ? 'user.profile.text.noMeMoments' : 'user.profile.text.noMoments')}
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                    />
                );
            case PROFILE_CAROUSEL_TABS.THOUGHTS:
                return this.renderThoughtsScene(
                    isMe ? 'user.profile.text.noMeThoughts' : 'user.profile.text.noThoughts',
                );
            case PROFILE_CAROUSEL_TABS.GOALS:
                // HABITS reuses the thoughts data path; backend filters to habits-tagged thoughts.
                return this.renderThoughtsScene(
                    isMe ? 'user.profile.text.noMeGoals' : 'user.profile.text.noGoals',
                );
            case PROFILE_CAROUSEL_TABS.PACTS:
                return this.renderHabitsPactsScene();
            case PROFILE_CAROUSEL_TABS.ACHIEVEMENTS:
                return this.renderHabitsAchievementsScene();
            default:
                return null;
        }
    };

    render() {
        const { habits, navigation, user } = this.props;
        const {
            activeTabIndex,
            activeConfirmModal,
            confirmModalText,
            isConfirmProcessing,
            isLoading,
            isTabViewLaidOut,
            tabRoutes,
        } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView edges={[]}  style={this.theme.styles.safeAreaView}>
                    {
                        isLoading ?
                            <LottieLoader id="therr-black-rolling" theme={this.themeLoader} /> :
                            <View style={this.themeUser.styles.container}>
                                <UserDisplayHeader
                                    goToConnections={this.goToConnections}
                                    navigation={navigation}
                                    isDarkMode={isDarkTheme(user.settings?.mobileThemeName)}
                                    onProfilePicturePress={this.onProfilePicturePress}
                                    onBlockUser={this.onBlockUser}
                                    onConnectionRequest={this.onConnectionRequest}
                                    onMessageUser={this.onMessageUser}
                                    onReportUser={this.onReportUser}
                                    themeForms={this.themeForms}
                                    themeUser={this.themeUser}
                                    themeHabits={this.themeHabits}
                                    translate={this.translate}
                                    user={user}
                                    userInView={user.userInView || {}}
                                    activeStreaks={habits?.activeStreaks || []}
                                />
                                <View style={this.theme.styles.tabviewContainer} onLayout={this.handleTabContainerLayout}>
                                    <TabView
                                        lazy
                                        lazyPreloadDistance={0}
                                        navigationState={{
                                            index: activeTabIndex,
                                            routes: tabRoutes,
                                        }}
                                        renderTabBar={this.renderTabBar}
                                        renderScene={this.renderSceneMap}
                                        renderLazyPlaceholder={() => (
                                            <View style={this.theme.styles.sectionContainer}>
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                                <LazyPlaceholder lines={[undefined, undefined]} />
                                            </View>
                                        )}
                                        onIndexChange={this.onTabSelect}
                                        initialLayout={{ width: viewportWidth }}
                                        style={this.theme.styles.tabviewContainer}
                                    />
                                    {!isTabViewLaidOut && <TabViewLoadingOverlay color={this.theme.colors.textWhite} />}
                                </View>
                            </View>
                    }
                </SafeAreaView>
                {
                    user.userInView?.id === user.details.id &&
                        <FAB
                            icon={renderIdeaIcon}
                            style={this.themeButtons.styles.addAThought}
                            variant="secondary"
                            size="small"
                            onPress={this.handleEditThought}
                        />
                }
                <ConfirmModal
                    isConfirming={isConfirmProcessing}
                    isVisible={!!activeConfirmModal}
                    onCancel={this.onCancelConfirmModal}
                    onConfirm={this.onAcceptConfirmModal}
                    text={confirmModalText}
                    translate={this.translate}
                    width={activeConfirmModal === 'remove-connection-request' ? '70%' : '60%'}
                    theme={this.theme}
                    themeButtons={this.themeButtons}
                    themeModal={this.themeConfirmModal}
                />
                <MainButtonMenu
                    activeRoute="ViewUser"
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

export default connect(mapStateToProps, mapDispatchToProps)(ViewUser);
