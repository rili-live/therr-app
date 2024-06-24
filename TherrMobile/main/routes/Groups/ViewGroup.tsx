import React from 'react';
import {
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    Text,
    View,
} from 'react-native';
import { Avatar, Button } from 'react-native-elements';
import { TabBar, TabView } from 'react-native-tab-view';
// import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { ContentActions, MessageActions, SocketActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IContentState, IForumsState, IMessageState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { ForumsService, UsersService } from 'therr-react/services';
import { Content, GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
// import ViewGroupButtonMenu from '../../components/ButtonMenu/ViewGroupButtonMenu';
import translator from '../../services/translator';
// import RoundInput from '../../components/Input/Round';
import spacingStyles from '../../styles/layouts/spacing';
import { buildStyles } from '../../styles';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas/viewing';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildChatStyles } from '../../styles/user-content/groups/view-group';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildMessageStyles } from '../../styles/user-content/messages';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../../styles/forms/accentEditForm';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import BaseStatusBar from '../../components/BaseStatusBar';
import { getUserContentUri, getUserImageUri } from '../../utilities/content';
import { GROUP_CAROUSEL_TABS, PEOPLE_CAROUSEL_TABS } from '../../constants';
import RoundInput from '../../components/Input/Round';
import TherrIcon from '../../components/TherrIcon';
import ForumMessage from './ForumMessage';
import ListEmpty from '../../components/ListEmpty';
import LazyPlaceholder from '../Areas/components/LazyPlaceholder';
import UserSearchItem from '../Connect/components/UserSearchItem';
import UsersActions from '../../redux/actions/UsersActions';
import AreaDisplay from '../../components/UserContent/AreaDisplay';
import { navToViewContent } from '../../utilities/postViewHelpers';

const { width: viewportWidth } = Dimensions.get('window');

const ITEMS_PER_PAGE = 50;
const tabMap = {
    0: GROUP_CAROUSEL_TABS.CHAT,
    1: GROUP_CAROUSEL_TABS.EVENTS,
    2: GROUP_CAROUSEL_TABS.MEMBERS,
};

interface IViewGroupDispatchProps {
    createOrUpdateEventReaction: Function;
    createUserConnection: Function;
    joinForum: Function;
    logout: Function;
    searchForumMessages: Function;
    sendForumMessage: Function;
    searchUserConnections: Function;
    searchUpdateUser: Function;
}

interface IStoreProps extends IViewGroupDispatchProps {
    content: IContentState;
    messages: IMessageState;
    forums: IForumsState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IViewGroupProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewGroupState {
    activeTabIndex: number;
    groupEvents: any[];
    groupMembers: any[];
    msgInputVal: string;
    isLoading: boolean;
    pageNumber: number;
    tabRoutes: { key: string; title: string }[];
}

const mapStateToProps = (state) => ({
    messages: state.messages,
    forums: state.forums,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,
            createUserConnection: UserConnectionsActions.create,
            joinForum: SocketActions.joinForum,
            searchForumMessages: MessageActions.searchForumMessages,
            sendForumMessage: SocketActions.sendForumMessage,
            searchUserConnections: UserConnectionsActions.search,
            searchUpdateUser: UsersActions.searchUpdateUser,
        },
        dispatch
    );

class ViewGroup extends React.Component<IViewGroupProps, IViewGroupState> {
    private hashtags;
    private chatListRef;
    private eventsListRef;
    private membersListRef;
    private translate: Function;
    private theme = buildStyles();
    private themeChat = buildChatStyles();
    private themeButtons = buildButtonsStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeArea = buildAreaStyles();
    private themeMenu = buildMenuStyles();
    private themeMessage = buildMessageStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        const { route } = props;
        const { hashTags } = route.params;
        this.hashtags = hashTags ? hashTags.split(',') : [];

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
            groupMembers: [],
            groupEvents: [],
            msgInputVal: '',
            isLoading: false,
            pageNumber: 1,
            tabRoutes: [
                { key: GROUP_CAROUSEL_TABS.CHAT, title: this.translate('menus.headerTabs.chat') },
                { key: GROUP_CAROUSEL_TABS.EVENTS, title: this.translate('menus.headerTabs.events') },
                { key: GROUP_CAROUSEL_TABS.MEMBERS, title: this.translate('menus.headerTabs.members') },
            ],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeArea = buildAreaStyles(props.user.settings?.mobileThemeName);
        this.themeChat = buildChatStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeMessage = buildMessageStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const {
            joinForum,
            navigation,
            route,
            user,
        } = this.props;
        const { title, id: forumId } = route.params;

        ForumsService.getForum(forumId).then((response) => {
            this.setState({
                groupEvents: response.data?.events || [],
            });

            navigation.setOptions({
                title: title || response?.data?.title,
            });

            joinForum({
                roomId: forumId,
                roomName: title || response?.data?.title,
                userId: user.details.id,
                userName: user.details.userName,
                userImgSrc: getUserImageUri(user.details, 100),
            });
        }).catch((err) => {
            console.log(err);
        });

        // TODO: Add logic to update this when user navigates away then returns
        this.searchForumMsgsByPage(1);
        this.searchGroupMembers();
    }

    searchForumMsgsByPage = (pageNumber: number) => {
        const { searchForumMessages, user, route } = this.props;
        const { id: forumId } = route.params;

        this.setState({
            isLoading: true,
        });
        return new Promise((resolve) => searchForumMessages(
            forumId,
            user.details.id,
            {
                itemsPerPage: ITEMS_PER_PAGE,
                pageNumber,
                // order: 'desc',
            }
        ).finally(() => {
            this.setState({
                isLoading: false,
            }, () => resolve(null));
        }));
    };

    searchGroupMembers = () => {
        const { route } = this.props;
        const { id: forumId } = route.params;

        if (UsersService.getGroupMembers) {
            UsersService.getGroupMembers(forumId).then((response) => {
                this.setState({
                    groupMembers: response.data?.userGroups || [],
                });
            }).catch((err) => {
                console.log('failed to fetch group members', err);
            });
        }
    };

    tryLoadMore = () => {
        const { pageNumber } = this.state;
        const { messages, route } = this.props;
        const { id: forumId } = route.params;
        const msgs = messages.forumMsgs ? (messages.forumMsgs[forumId] || []) : [];

        if (!msgs.length || msgs[msgs.length - 1].isFirstMessage || msgs.length > 200) {
            // Don't load more than 200 historical messages
            return;
        }

        const nextPage = pageNumber + 1;
        this.searchForumMsgsByPage(nextPage);
        this.setState({
            pageNumber: nextPage,
        });
    };

    getMembershipText = (userDetails: any) => {
        if (userDetails?.isMembershipPending) {
            return this.translate('pages.viewGroup.membershipStatuses.pending');
        }
        if (userDetails?.membershipRole === GroupMemberRoles.CREATOR) {
            return this.translate('pages.viewGroup.membershipRoles.creator');
        }
        if (userDetails?.membershipRole === GroupMemberRoles.ADMIN) {
            return this.translate('pages.viewGroup.membershipRoles.admin');
        }
        if (userDetails?.membershipRole === GroupMemberRoles.EVENT_HOST) {
            return this.translate('pages.viewGroup.membershipRoles.eventHost');
        }
        // Typically a blocked user but we don't want to display that info
        if (userDetails?.membershipRole === GroupMemberRoles.READ_ONLY) {
            return this.translate('pages.viewGroup.membershipRoles.default');
        }

        return this.translate('pages.viewGroup.membershipRoles.default');
    };

    goToUser = (userId) => {
        const { navigation } = this.props;
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    scrollTop = () => {
        const { groupMembers } = this.state;
        const { messages } = this.props;
        const { id: forumId } = this.props.route.params;
        const mgs = messages.forumMsgs[forumId] || [];
        const events = [];

        if (mgs?.length) {
            this.chatListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        if (events?.length) {
            this.eventsListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        if (groupMembers.length) {
            this.membersListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
    };

    handleInputChange = (val) => {
        this.setState({
            msgInputVal: val,
        });
    };

    handleSend = (e) => {
        e.preventDefault();
        const { msgInputVal } = this.state;

        if (msgInputVal) {
            const { sendForumMessage, user } = this.props;

            sendForumMessage({
                roomId: user.socketDetails.currentRoom,
                message: msgInputVal,
                userId: user.details.id,
                userName: user.details.userName,
                userImgSrc: getUserImageUri(user.details, 100),
            });

            this.setState({
                msgInputVal: '',
            });
        }

        this.onTabSelect(0);
    };

    getEmptyListMessage = (activeTab) => {
        if (activeTab === GROUP_CAROUSEL_TABS.CHAT) {
            return this.translate('pages.viewGroup.noChatsFound');
        }
        if (activeTab === GROUP_CAROUSEL_TABS.MEMBERS) {
            return this.translate('pages.viewGroup.noMembersFound');
        }
        if (activeTab === GROUP_CAROUSEL_TABS.EVENTS) {
            return this.translate('pages.viewGroup.noEventsFound');
        }

        // CAROUSEL_TABS.EVENTS
        return this.translate('pages.areas.noEventsAreasFound');
    };

    // TODO: Include user connection status in search results
    // If connected, show online status, otherwise show connect button
    getMembersList = () => {
        // TODO: Paginate
        const { groupMembers } = this.state;
        const nonDefaultRoles: any[] = [];
        const defaultRoles: any[] = [];

        groupMembers.forEach((member) => {
            const formattedMember = {
                ...member,
                user: {
                    ...member.user,
                    membershipRole: member?.role,
                    isMembershipPending: member?.status === GroupRequestStatuses.PENDING,
                    isConnected: true, // TODO: fetch connections status
                },
            };
            if (formattedMember.role === GroupMemberRoles.ADMIN) {
                nonDefaultRoles.unshift(formattedMember);
            } else if (formattedMember.role !== GroupMemberRoles.MEMBER) {
                nonDefaultRoles.push(formattedMember);
            } else {
                defaultRoles.push(formattedMember);
            }
        });

        return nonDefaultRoles.concat(defaultRoles);
    };

    goToContent = (content) => {
        const { navigation, user } = this.props;

        navToViewContent(content, user, navigation.navigate);
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;

        navigation.replace('Map', {
            latitude: lat,
            longitude: long,
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
            // TODO: This may need to be replaced with a new userGroups search
            // since we are rendering a list of user groups
            searchUpdateUser(acceptingUser.id, {
                isConnected: true,
            });
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

    renderSceneMap = ({ route }) => {
        const { groupEvents } = this.state;
        const { content, createOrUpdateEventReaction, messages, user } = this.props;
        const { id: forumId } = this.props.route.params;
        const mgs = messages.forumMsgs[forumId] || [];

        switch (route.key) {
            case GROUP_CAROUSEL_TABS.CHAT:
                return (<FlatList
                    data={mgs}
                    inverted={mgs?.length > 0}
                    stickyHeaderIndices={[]}
                    renderItem={({ item }) => (
                        <ForumMessage
                            item={item}
                            theme={this.theme}
                            themeChat={this.themeChat}
                            themeMessage={this.themeMessage}
                            userDetails={user.details}
                            fromUserDetails={{
                                id: item.fromUserId,
                                userName: item.fromUserName,
                                firstName: item.fromUserFirstName,
                                lastName: item.fromUserLastName,
                                media: item.fromUserMedia,
                            }}
                            goToUser={this.goToUser}
                        />
                    )}
                    ref={(component) => (this.chatListRef = component)}
                    style={this.theme.styles.stretch}
                    ListEmptyComponent={
                        <View style={spacingStyles.marginHorizLg}>
                            <ListEmpty iconName="chat" theme={this.theme} text={this.getEmptyListMessage(GROUP_CAROUSEL_TABS.CHAT)} />
                        </View>
                    }
                    onContentSizeChange={this.scrollTop}
                    showsVerticalScrollIndicator={false}
                    // onEndReached={this.tryLoadMore}
                    // onEndReachedThreshold={0.5}
                />);
            case GROUP_CAROUSEL_TABS.EVENTS:
                const noop = () => {};

                return (
                    <FlatList
                        ref={(component) => this.eventsListRef = component}
                        data={groupEvents}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: event }) =>
                        {
                            const mediaPath = event?.medias?.[0]?.path;
                            const mediaType = event?.medias?.[0]?.type;
                            const eventMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
                                ? getUserContentUri(
                                    event?.medias[0],
                                    (viewportWidth - (this.theme.styles.bodyFlex.padding * 2)) * 3 / 4,
                                    (viewportWidth - (this.theme.styles.bodyFlex.padding * 2))
                                )
                                : content?.media?.[mediaPath];
                            const isMe = user.details.id === event.fromUserId;
                            let userDetails: any = {
                                userName: event.fromUserName || (user.details.id === event.fromUserId
                                    ? user.details.userName
                                    : this.translate('alertTitles.nameUnknown')),
                            };
                            if (isMe) {
                                userDetails = {
                                    ...user.details,
                                    ...userDetails,
                                };
                            }
                            return (
                                <Pressable
                                    key={event.id}
                                    style={this.theme.styles.areaContainer}
                                    onPress={() => this.goToContent(event)}
                                >
                                    <AreaDisplay
                                        translate={this.translate}
                                        goToViewMap={this.goToViewMap}
                                        goToViewUser={this.goToViewUser}
                                        toggleAreaOptions={noop}
                                        hashtags={event.hashTags ? event.hashTags.split(',') : []}
                                        area={event}
                                        inspectContent={() => this.goToContent(event)}
                                        // TODO: Get username from response
                                        user={user}
                                        areaUserDetails={userDetails}
                                        updateAreaReaction={createOrUpdateEventReaction}
                                        areaMedia={eventMedia}
                                        areaMediaPadding={this.theme.styles.bodyFlex.padding}
                                        isDarkMode={false}
                                        theme={this.theme}
                                        themeForms={this.themeForms}
                                        themeViewArea={this.themeArea}
                                    />
                                </Pressable>
                            );
                        }}
                        ListEmptyComponent={<View style={spacingStyles.marginHorizLg}>
                            <ListEmpty iconName="calendar" theme={this.theme} text={this.getEmptyListMessage(GROUP_CAROUSEL_TABS.EVENTS)} />
                        </View>}
                        stickyHeaderIndices={[]}
                        // refreshControl={<RefreshControl
                        //     refreshing={isRefreshingUserSearch}
                        //     onRefresh={this.handleRefreshUsersSearch}
                        // />}
                        onContentSizeChange={this.scrollTop}
                        // onEndReached={this.trySearchMoreUsers}
                        // onEndReachedThreshold={0.5}
                        ListFooterComponent={<View />}
                        ListFooterComponentStyle={{ marginBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                    />
                );
            case GROUP_CAROUSEL_TABS.MEMBERS:
                const people: any[] = this.getMembersList();

                return (
                    <FlatList
                        ref={(component) => this.membersListRef = component}
                        data={people}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: member }) => (
                            <UserSearchItem
                                key={user.id}
                                userDetails={member.user}
                                getUserSubtitle={this.getMembershipText}
                                goToViewUser={this.goToUser}
                                onSendConnectRequest={this.onSendConnectRequest}
                                theme={this.theme}
                                themeButtons={this.themeButtons}
                                translate={this.translate}
                                user={user}
                            />
                        )}
                        ListEmptyComponent={<View style={spacingStyles.marginHorizLg}>
                            <ListEmpty iconName="group" theme={this.theme} text={this.getEmptyListMessage(GROUP_CAROUSEL_TABS.MEMBERS)} />
                        </View>}
                        stickyHeaderIndices={[]}
                        // refreshControl={<RefreshControl
                        //     refreshing={isRefreshingUserSearch}
                        //     onRefresh={this.handleRefreshUsersSearch}
                        // />}
                        onContentSizeChange={this.scrollTop}
                        // onEndReached={this.trySearchMoreUsers}
                        // onEndReachedThreshold={0.5}
                        ListFooterComponent={<View />}
                        ListFooterComponentStyle={{ marginBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                    />
                );
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

    render() {
        const { activeTabIndex, tabRoutes, msgInputVal } = this.state;
        const { navigation, route, forums } = this.props;
        const { description, subtitle, id: forumId } = route.params;
        const group = forums?.searchResults?.find((g) => g.id === forumId) || {};

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <View
                        style={[
                            this.theme.styles.bodyFlex,
                            this.themeAccentLayout.styles.bodyEdit,
                        ]}
                    >
                        <View style={[
                            this.themeAccentLayout.styles.containerHeader,
                            spacingStyles.flex,
                            spacingStyles.flexRow,
                            (this.hashtags?.length > 0 ? {} : spacingStyles.padBotMd),
                        ]}>
                            {
                                group.media?.featuredImage &&
                                <View>
                                    <Avatar
                                        title={`${group.title?.substring(0, 1)}`}
                                        rounded
                                        // TODO: Include use media in list groups response
                                        source={{ uri: getUserContentUri(group.media?.featuredImage, 150) }}
                                        size="medium"
                                    />
                                </View>
                            }
                            <View style={spacingStyles.marginLtMd}>
                                {
                                    subtitle &&
                                    <Text>
                                        <Text style={{ fontWeight: 'bold' }}>{this.translate('pages.groups.labels.subtitle')}</Text> {subtitle}
                                    </Text>
                                }
                                <Text style={spacingStyles.marginBotSm}>
                                    {description}
                                </Text>
                                <HashtagsContainer
                                    hasIcon={false}
                                    hashtags={this.hashtags}
                                    onHashtagPress={() => {}}
                                    visibleCount={7}
                                    styles={this.themeForms.styles}
                                />
                            </View>
                        </View>
                        <View style={[this.themeAccentLayout.styles.container, this.themeChat.styles.container]}>
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
                        </View>
                    </View>
                    <KeyboardAvoidingView
                        behavior="position"
                        keyboardVerticalOffset={this.themeAccentLayout.styles.footer.height - 8}
                        enabled={Platform.OS === 'ios'}
                    >
                        <View
                            style={[this.themeAccentLayout.styles.footer, this.themeChat.styles.footer]}
                        >
                            <Button
                                containerStyle={this.themeAccentForms.styles.backButtonContainerFixed}
                                buttonStyle={this.themeAccentForms.styles.backButton}
                                onPress={() => navigation.navigate('Connect', {
                                    activeTab: PEOPLE_CAROUSEL_TABS.GROUPS,
                                })}
                                icon={
                                    <FontAwesome5Icon
                                        name="arrow-left"
                                        size={25}
                                        color={'black'}
                                    />
                                }
                                type="clear"
                            />
                            <RoundInput
                                value={msgInputVal}
                                onChangeText={this.handleInputChange}
                                placeholder={this.translate(
                                    'pages.directMessage.inputPlaceholder'
                                )}
                                onSubmitEditing={this.handleSend}
                                containerStyle={this.themeMessage.styles.inputContainer}
                                errorStyle={this.theme.styles.displayNone}
                                themeForms={this.themeForms}
                            />
                            <Button
                                icon={<TherrIcon name="send" size={26} style={this.themeMessage.styles.icon} />}
                                buttonStyle={this.themeMessage.styles.sendBtn}
                                containerStyle={[this.themeMessage.styles.sendBtnContainer, this.themeChat.styles.sendBtnContainer]}
                                onPress={this.handleSend}
                            />
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
                {/* <ViewGroupButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewGroup);
