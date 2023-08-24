import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
    RefreshControl,
    Text,
    View,
} from 'react-native';
import { Button, Image } from 'react-native-elements';
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
import { ScrollView } from 'react-native-gesture-handler';
import { TabBar, TabView } from 'react-native-tab-view';
import { ContentActions } from 'therr-react/redux/actions';
import UsersActions from '../../redux/actions/UsersActions';
import BaseStatusBar from '../../components/BaseStatusBar';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildModalStyles } from '../../styles/modal';
import { buildStyles as buildReactionsModalStyles } from '../../styles/modal/areaReactionsModal';
import { buildStyles as buildUserStyles } from '../../styles/user-content/user-display';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import UserDisplayHeader from './UserDisplayHeader';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import LazyPlaceholder from './components/LazyPlaceholder';
import AreaCarousel from '../Areas/AreaCarousel';
import { isMyContent } from '../../utilities/content';
import ThoughtOptionsModal, { ISelectionType } from '../../components/Modals/ThoughtOptionsModal';
import { handleThoughtReaction } from '../../utilities/postViewHelpers';
import ListEmpty from '../../components/ListEmpty';
import TherrIcon from '../../components/TherrIcon';

const { width: viewportWidth } = Dimensions.get('window');
const imageWidth = viewportWidth / 3;
function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface IViewUserDispatchProps {
    blockUser: Function;
    getIntegratedMoments: Function;
    getUser: Function;
    createOrUpdateThoughtReaction: Function;
    searchThoughts: Function;
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
    areThoughtOptionsVisible: boolean;
    confirmModalText: string;
    activeConfirmModal: '' | 'report-user' | 'block-user' | 'remove-connection-request' | 'send-connection-request';
    activeTabIndex: number;
    isLoading: boolean;
    isRefreshingUserMedia: boolean;
    isRefreshingUserThoughts: boolean;
    selectedThought: any;
    tabRoutes: { key: string; title: string }[];
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
    createOrUpdateThoughtReaction: ContentActions.createOrUpdateThoughtReaction,
    searchThoughts: UsersActions.searchThoughts,
    updateUserInView: UsersActions.updateUserInView,
    createUserConnection: UserConnectionsActions.create,
    updateUserConnection: UserConnectionsActions.update,
}, dispatch);

class ViewUser extends React.Component<
    IViewUserProps,
    IViewUserState
> {
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
    private themeModal = buildModalStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeUser = buildUserStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        const { route } = props;
        const activeTabIndex = route.params?.activeTab === 'media' ? 1 : 0;

        this.state = {
            areThoughtOptionsVisible: false,
            activeTabIndex,
            confirmModalText: '',
            activeConfirmModal: '',
            isLoading: true,
            isRefreshingUserMedia: false,
            isRefreshingUserThoughts: false,
            selectedThought: {},
            tabRoutes: [
                { key: 'thoughts', title: this.translate('menus.headerTabs.thoughts') },
                { key: 'media', title: this.translate('menus.headerTabs.media') },
            ],
            userInViewsThoughts: [],
        };

        this.loaderId = getRandomLoaderId();
        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        (props.user.settings?.mobileThemeName);
        this.themeUser = buildUserStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.viewUser.headerTitle'),
        });

        this.fetchUser();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.route?.params?.userInView?.id !== this.props.route?.params?.userInView?.id) {
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
            if (response?.id) {
                getIntegratedMoments(response?.id); // TODO: Maybe only load after clicking tab
                this.fetchThoughts();
            }
        }).catch((error) => {
            console.log(error);
            if (error?.statusCode === 404) {
                navigation?.goBack();
            }
        }).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    };

    goToContent = (content) => {
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

    toggleThoughtOptions = (thought) => {
        const { areThoughtOptionsVisible } = this.state;
        this.setState({
            areThoughtOptionsVisible: !areThoughtOptionsVisible,
            selectedThought: areThoughtOptionsVisible ? {} : thought,
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

        createOrUpdateThoughtReaction(thoughtId, params, thoughtUserId, reactorUserName);
    };

    handleRefresh = () => {
        this.setState({ isLoading: true });
        this.fetchUser();
    };

    handleUserMediaRefresh = () => {
        const { getIntegratedMoments, user } = this.props;

        this.setState({ isRefreshingUserMedia: true });

        return user.userInView ? getIntegratedMoments(user.userInView.id).then(() => {
            this.setState({ isRefreshingUserMedia: false });
        }) : null;
    };

    handleUserThoughtsRefresh = () => {
        const { user } = this.props;

        this.setState({ isRefreshingUserThoughts: true });

        return user.userInView ? this.fetchThoughts().then(() => {
            this.setState({ isRefreshingUserThoughts: false });
        }) : null;
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
            // TODO: Store these on userInView?
            this.setState({
                userInViewsThoughts: data?.thoughts || [],
            });
        });
    };

    handleEditThought = () => {
        const { navigation } = this.props;

        navigation.navigate('EditThought', {});
    };


    onThoughtOptionSelect = (type: ISelectionType) => {
        const { selectedThought } = this.state;
        const { createOrUpdateThoughtReaction, user } = this.props;

        handleThoughtReaction(selectedThought, type, {
            user,
            createOrUpdateThoughtReaction,
            toggleThoughtOptions: this.toggleThoughtOptions,
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

        if (activeConfirmModal === 'report-user') {
            UsersService.report(user?.userInView.id);
            // TODO: Add success toast
        } else if (activeConfirmModal === 'block-user') {
            // TODO: Add success toast
            // TODO: RMOBILE-35: ...
            blockUser(user.userInView?.id, user.details.blockedUsers);
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
            navigation.navigate('Areas');
        }

        this.setState({
            activeConfirmModal: '',
        });
    };

    onTabSelect = (index: number) => {
        if (index === 0) {
            this.carouselThoughtsRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        this.setState({
            activeTabIndex: index,
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
        const { isRefreshingUserMedia, userInViewsThoughts } = this.state;
        const {
            content,
            user,
        } = this.props;
        const userInView = user.userInView || {};

        // TODO: Fetch missing media
        const fetchMedia = () => {};
        const noop = () => {};

        switch (route.key) {
            case 'thoughts':
                const thoughtsData = userInViewsThoughts;
                return (
                    <AreaCarousel
                        activeData={thoughtsData}
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
                        updateMomentReaction={noop}
                        updateSpaceReaction={noop}
                        updateThoughtReaction={this.createUpdateThoughtReaction}
                        emptyListMessage={this.translate('user.profile.text.noThoughts')}
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                );
            case 'media':
                return (
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.scrollViewFull}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshingUserMedia}
                            onRefresh={this.handleUserMediaRefresh}
                        />}
                    >
                        <View style={this.themeUser.styles.contentPostsContainer}>
                            {
                                userInView.externalIntegrations?.length ?
                                    userInView.externalIntegrations.map((integration) => {
                                        const mediaUrl = content.media[integration.moment?.media && integration.moment?.media[0]?.id];
                                        return (
                                            <Image
                                                key={integration.id}
                                                source={{ uri: mediaUrl }}
                                                style={{
                                                    width: imageWidth,
                                                    height: imageWidth,
                                                }}
                                                // width={imageWidth}
                                                // height={imageWidth}
                                                containerStyle={{}}
                                                PlaceholderContent={<ActivityIndicator size="large" color={this.themeUser.colors.primary}/>}
                                                transition={false}
                                            />
                                        );
                                    }) :
                                    <ListEmpty
                                        text={this.translate('user.profile.text.noMedia')}
                                        theme={this.theme}
                                    />
                            }
                        </View>
                    </ScrollView>
                );
        }
    };

    render() {
        const { navigation, user } = this.props;
        const {
            activeTabIndex,
            activeConfirmModal,
            areThoughtOptionsVisible,
            confirmModalText,
            isLoading,
            selectedThought,
            tabRoutes,
        } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    {
                        isLoading ?
                            <LottieLoader id="therr-black-rolling" theme={this.themeLoader} /> :
                            <View style={this.themeUser.styles.container}>
                                <UserDisplayHeader
                                    navigation={navigation}
                                    onProfilePicturePress={this.onProfilePicturePress}
                                    onBlockUser={this.onBlockUser}
                                    onConnectionRequest={this.onConnectionRequest}
                                    onMessageUser={this.onMessageUser}
                                    onReportUser={this.onReportUser}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    themeUser={this.themeUser}
                                    translate={this.translate}
                                    user={user}
                                    userInView={user.userInView || {}}
                                />
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
                                    style={this.theme.styles.tabviewContainer}
                                />
                            </View>
                    }
                </SafeAreaView>
                {
                    user.userInView?.id === user.details.id &&
                        <Button
                            containerStyle={this.themeButtons.styles.addAThought}
                            buttonStyle={this.themeButtons.styles.btnLarge}
                            icon={
                                <TherrIcon
                                    name={'idea'}
                                    size={27}
                                    style={this.themeButtons.styles.btnIcon}
                                />
                            }
                            raised={true}
                            onPress={this.handleEditThought}
                        />
                }
                <ThoughtOptionsModal
                    isVisible={areThoughtOptionsVisible}
                    onRequestClose={() => this.toggleThoughtOptions(selectedThought)}
                    translate={this.translate}
                    onSelect={this.onThoughtOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                />
                <ConfirmModal
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
