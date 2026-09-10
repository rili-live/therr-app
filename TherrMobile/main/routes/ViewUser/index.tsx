import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Dimensions,
    Text,
    View} from 'react-native';
import { FAB } from 'react-native-paper';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
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
} from 'therr-react/types';
import { TabBar } from 'react-native-tab-view';
import { showToast } from '../../utilities/toasts';
import getRepostErrorKey from '../../utilities/repostErrors';
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
import translator from '../../utilities/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import UserDisplayHeader from './UserDisplayHeader';
import ProfileCompletionLink from '../../components/ProfileCompletionLink';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import RepostModal from '../../components/Modals/RepostModal';
import LazyPlaceholder from '../../components/LazyPlaceholder';
import TabViewLoadingOverlay from '../../components/TabViewLoadingOverlay';
import CollapsibleHeaderTabView, { ICollapsibleSceneProps } from '../../components/CollapsibleHeaderTabView';
import AreaCarousel from '../Areas/AreaCarousel';
import { isMyContent } from '../../utilities/content';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import { handleAreaReaction, handleThoughtReaction, navToViewContent } from '../../utilities/postViewHelpers';
import TherrIcon from '../../components/TherrIcon';
import getDirections from '../../utilities/getDirections';
import { PEOPLE_CAROUSEL_TABS, PROFILE_CAROUSEL_TABS } from '../../constants';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';

const { width: viewportWidth } = Dimensions.get('window');

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
    createThought: Function;
    updateUserInView: Function;
    createUserConnection: Function;
    updateUserConnection: Function;
}

interface IStoreProps extends IViewUserDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
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
    isTabViewLaidOut: boolean;
    // The thought the repost composer is open for (null when closed).
    repostTarget: any;
    isReposting: boolean;
    tabRoutes: { key: string; title: string }[];
    userInViewsMoments: any[];
    userInViewsThoughts: any[];
}

const mapStateToProps = (state) => ({
    content: state.content,
    notifications: state.notifications,
    user: state.user,
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
    createThought: UsersActions.createThought,
    updateUserInView: UsersActions.updateUserInView,
    createUserConnection: UserConnectionsActions.create,
    updateUserConnection: UserConnectionsActions.update,
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

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);

        const { route } = props;
        const { userInView } = route.params;
        const activeTabIndex = 0;
        const isMe = userInView?.id === props.user.details.id;
        const tabRoutes = [
            { key: PROFILE_CAROUSEL_TABS.THOUGHTS, title: this.translate('menus.headerTabs.thoughts') },
        ];
        if (isMe) {
            tabRoutes.unshift({ key: PROFILE_CAROUSEL_TABS.MOMENTS, title: this.translate('menus.headerTabs.moments') });
        }

        this.state = {
            activeTabIndex,
            confirmModalText: '',
            activeConfirmModal: '',
            isConfirmProcessing: false,
            isLoading: true,
            isRefreshingUserMedia: false,
            isRefreshingUserMoments: false,
            isRefreshingUserThoughts: false,
            isTabViewLaidOut: false,
            repostTarget: null,
            isReposting: false,
            tabRoutes,
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
            const tabRoutes = [
                { key: PROFILE_CAROUSEL_TABS.THOUGHTS, title: this.translate('menus.headerTabs.thoughts') },
            ];
            if (isMe) {
                tabRoutes.unshift({ key: PROFILE_CAROUSEL_TABS.MOMENTS, title: this.translate('menus.headerTabs.moments') });
            }
            this.setState({
                isLoading: true,
                tabRoutes,
                userInViewsMoments: [],
                userInViewsThoughts: [],
            });
            this.fetchUser();
        }
    }

    fetchUser = () => {
        const { getUser, getIntegratedMoments, navigation, route } = this.props;
        const { userInView } = route.params;

        getUser(userInView.id).then((response) => {
            navigation.setOptions({
                title: response?.userName || this.translate('pages.viewUser.headerTitle'),
            });
            this.setState({
                isLoading: false,
            });
            if (response?.id) {
                // Media
                // TODO: Maybe only load after clicking tab
                Promise.resolve(getIntegratedMoments(response?.id))
                    .catch((err) => console.log('getIntegratedMoments failed:', err));
                this.fetchMoments();
                this.fetchThoughts();
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

    handleRepostPress = (thought) => {
        this.setState({ repostTarget: thought });
    };

    handleRepostCancel = () => {
        this.setState({ repostTarget: null });
    };

    handleRepostConfirm = (message: string) => {
        const { createThought, user } = this.props;
        const { repostTarget } = this.state;

        if (!repostTarget?.id) {
            return;
        }

        // Hashtags come from the user's own quote only. Carrying the original's tags over would
        // put the reposter's account in feeds they never chose to post into.
        const hashTags = message.match(/#[a-z0-9_]+/g) || [];
        const hashTagsString = [
            ...new Set(hashTags.map((t) => t.replace(/#/g, ''))),
        ].join(',');

        this.setState({ isReposting: true });

        createThought({
            fromUserId: user.details.id,
            // Reposting is a public act by definition — it surfaces the original to the
            // reposter's audience, so a private repost would be a no-op with a side effect.
            isPublic: true,
            message,
            hashTags: hashTagsString,
            repostThoughtId: repostTarget.id,
            isDraft: false,
        })
            .then(() => {
                this.setState({ repostTarget: null });
                showToast.success({
                    text1: this.translate('alertTitles.repostSuccess'),
                    text2: this.translate('alertMessages.repostSuccess'),
                });
            })
            .catch((error: any) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    // 400 is the server's "you already reposted this" duplicate guard. The
                    // control is gated on the same rule the server enforces, so a 403 means the
                    // original went non-public between opening the composer and confirming —
                    // distinct, and not something retrying fixes.
                    text2: this.translate(getRepostErrorKey(error?.statusCode)),
                });
            })
            .finally(() => {
                this.setState({ isReposting: false });
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
                translate: this.translate,
            });
        }
    };

    onThoughtOptionSelect = (type: IContentSelectionType, thought: any) => {
        const { createOrUpdateThoughtReaction, user } = this.props;

        handleThoughtReaction(thought, type, {
            user,
            createOrUpdateThoughtReaction,
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
            showToast.success({
                text1: this.translate('alertTitles.userReportSent'),
            });
            resetProcessing();
        } else if (activeConfirmModal === 'block-user') {
            // TODO: RMOBILE-35: ...
            blockUser(user.userInView?.id, user.details.blockedUsers);
            showToast.success({
                text1: this.translate('alertTitles.userBlocked'),
            });
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
            updateUserConnection({
                connection: {
                    isConnectionBroken: true,
                    otherUserId: user.userInView?.id,
                },
                user: user.details,
            });
            showToast.success({
                text1: this.translate('alertTitles.connectionRemoved'),
            });
            resetProcessing();
            navigation.navigate('Areas');
        } else {
            resetProcessing();
        }
    };

    // NOTE: Tab switches deliberately do NOT reset scroll position. CollapsibleHeaderTabView
    // keeps every tab aligned with the header, so resetting here would fight that sync and
    // yank the header back open on each swipe.
    onTabSelect = (index: number) => {
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

    // The collapsible part of the screen: everything above the tab bar.
    renderProfileHeader = () => {
        const { navigation, user } = this.props;
        const isMe = user.userInView?.id === user.details.id;

        return (
            <>
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
                    translate={this.translate}
                    user={user}
                    userInView={user.userInView || {}}
                />
                {
                    isMe &&
                    <ProfileCompletionLink
                        navigation={navigation}
                        translate={this.translate as any}
                        user={user}
                        themeName={user.settings?.mobileThemeName}
                    />
                }
            </>
        );
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

    renderSceneMap = ({ route, collapsible }: { route: any; collapsible: ICollapsibleSceneProps }) => {
        const { isRefreshingUserMedia, userInViewsThoughts, userInViewsMoments } = this.state;
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
                const momentsData = userInViewsMoments;
                return (
                    <AreaCarousel
                        activeData={momentsData}
                        collapsible={collapsible}
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
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                );
            case PROFILE_CAROUSEL_TABS.THOUGHTS:
                const thoughtsData = userInViewsThoughts;
                return (
                    <AreaCarousel
                        activeData={thoughtsData}
                        collapsible={collapsible}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isRefreshingUserMedia}
                        fetchMedia={fetchMedia}
                        goToViewMap={noop}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={noop}
                        toggleThoughtOptions={this.toggleThoughtOptions}
                        onRepostPress={this.handleRepostPress}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselThoughtsRef = component; }}
                        handleRefresh={this.handleUserThoughtsRefresh}
                        onEndReached={noop} // TODO
                        updateEventReaction={noop}
                        updateMomentReaction={noop}
                        updateSpaceReaction={noop}
                        updateThoughtReaction={this.createUpdateThoughtReaction}
                        emptyListMessage={this.translate(isMe ? 'user.profile.text.noMeThoughts' : 'user.profile.text.noThoughts')}
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                );
            default:
                return null;
        }
    };

    render() {
        const { navigation, user } = this.props;
        const {
            activeTabIndex,
            activeConfirmModal,
            confirmModalText,
            isConfirmProcessing,
            isLoading,
            isReposting,
            isTabViewLaidOut,
            repostTarget,
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
                                <CollapsibleHeaderTabView
                                    lazy
                                    lazyPreloadDistance={0}
                                    headerStyle={this.themeUser.styles.profileHeaderCollapsible}
                                    listBottomInset={buttonMenuHeight}
                                    navigationState={{
                                        index: activeTabIndex,
                                        routes: tabRoutes,
                                    }}
                                    onIndexChange={this.onTabSelect}
                                    onLayout={this.handleTabContainerLayout}
                                    renderHeader={this.renderProfileHeader}
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
                                    initialLayout={{ width: viewportWidth }}
                                    style={this.theme.styles.tabviewContainer}
                                />
                                {!isTabViewLaidOut && <TabViewLoadingOverlay color={this.theme.colors.textWhite} />}
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
                <RepostModal
                    isVisible={!!repostTarget}
                    isSubmitting={isReposting}
                    onCancel={this.handleRepostCancel}
                    onConfirm={this.handleRepostConfirm}
                    thought={repostTarget}
                    translate={this.translate}
                    themeButtons={this.themeButtons}
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
