import React from 'react';
import { Pressable, RefreshControl, SafeAreaView, FlatList, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
    NotificationActions,
    UserConnectionsActions,
} from 'therr-react/redux/actions';
import {
    IUserState,
    IUserConnectionsState,
    INotificationsState as IStoreNotificationsState,
} from 'therr-react/types';
import { Notifications as NotificationsEmuns, UserConnectionTypes } from 'therr-js-utilities/constants';
import BaseStatusBar from '../../components/BaseStatusBar';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { notifications as notificationStyles, buildStyles as buildNotificationStyles } from '../../styles/notifications';
import translator from '../../utilities/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import Notification from './Notification';
import ListEmpty from '../../components/ListEmpty';
import { GROUPS_CAROUSEL_TABS, PEOPLE_CAROUSEL_TABS } from '../../constants';

interface INotificationsDispatchProps {
    logout: Function;
    markAllRead: Function;
    searchUserConnections: Function;
    searchNotifications: Function;
    updateNotification: Function;
    updateUserConnection: Function;
}

interface IStoreProps extends INotificationsDispatchProps {
    notifications: IStoreNotificationsState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface INotificationsProps extends IStoreProps {
    navigation: any;
}

interface INotificationsState {
    isRefreshing: boolean;
}

const mapStateToProps = (state) => ({
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    markAllRead: NotificationActions.markAllRead,
    searchNotifications: NotificationActions.search,
    updateNotification: NotificationActions.update,
    updateUserConnection: UserConnectionsActions.update,
}, dispatch);

class Notifications extends React.Component<
    INotificationsProps,
    INotificationsState
> {
    private flatListRef: any;
    private translate: Function;
    private theme = buildStyles();
    private themeForms = buildFormStyles();
    private themeMenu = buildMenuStyles();
    private themeNotification = buildNotificationStyles();

    constructor(props) {
        super(props);

        this.state = {
            isRefreshing: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeNotification = buildNotificationStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.notifications.headerTitle'),
        });
        this.handleRefresh();
    }

    handleMarkAllRead = () => {
        const { markAllRead, notifications } = this.props;
        markAllRead(notifications.messages || []);
    };

    handleConnectionRequestAction = (e: any, notification, isAccepted) => {
        const { user, updateUserConnection } = this.props;
        let otherUserId = notification.userConnection.acceptingUserId;

        if (otherUserId === user.details.id) {
            otherUserId = notification.userConnection.requestingUserId;
        }

        const updatedUserConnection = {
            ...notification.userConnection,
            acceptingUserId: user.details.id,
            requestStatus: isAccepted ? UserConnectionTypes.COMPLETE : UserConnectionTypes.DENIED,
        };

        this.onNotificationPress(e, notification, updatedUserConnection, false);

        updateUserConnection({
            connection: {
                otherUserId,
                requestStatus: isAccepted ? UserConnectionTypes.COMPLETE : UserConnectionTypes.DENIED,
            },
            user: user.details,
        });
    };


    onNotificationPress = (event, notification, userConnection?: any, shouldNavigate = true) => {
        const { updateNotification, user } = this.props;

        const message = {
            notification: {
                ...notification,
                isUnread: shouldNavigate
                    ? false
                    : !notification.isUnread, // Toggle when clicking icon on the right
            },
            userName: user.details.userName,
        };

        if (userConnection) {
            message.notification.userConnection = userConnection;
        }
        updateNotification(message);

        if (shouldNavigate) {
            this.navigateToNotificationContext(notification);
        }
    };

    navigateToNotificationContext = (notification) => {
        const { navigation } = this.props;
        if (notification.type === NotificationsEmuns.Types.NEW_AREAS_ACTIVATED) {
            if (notification.messageParams?.activatedMomentIds?.length
                || notification.messageParams?.activatedSpaceIds?.length) {
                navigation.navigate('ActivatedAreas', {
                    activatedMomentIds: notification.messageParams?.activatedMomentIds || [],
                    activatedSpaceIds: notification.messageParams?.activatedSpaceIds || [],
                });
            } else {
                navigation.navigate('Nearby');
            }
        } else if (notification.type === NotificationsEmuns.Types.NEW_LIKE_RECEIVED
            || notification.type === NotificationsEmuns.Types.NEW_SUPER_LIKE_RECEIVED
            || notification.type === NotificationsEmuns.Types.THOUGHT_REPLY) {
            if (notification.messageParams?.thoughtId) {
                navigation.navigate('ViewThought', {
                    isMyContent: true,
                    previousView: 'Notifications',
                    thought: {
                        id: notification.messageParams?.thoughtId,
                    },
                    thoughtDetails: {},
                });
            } else if (notification.messageParams?.areaId && notification.messageParams?.postType) {
                if (notification.messageParams?.postType === 'spaces') {
                    navigation.navigate('ViewSpace', {
                        isMyContent: true,
                        previousView: 'Notifications',
                        space: {
                            id: notification.messageParams?.areaId,
                        },
                        spaceDetails: {},
                    });
                } else if (notification.messageParams?.postType === 'moments') {
                    navigation.navigate('ViewMoment', {
                        isMyContent: true,
                        previousView: 'Notifications',
                        moment: {
                            id: notification.messageParams?.areaId,
                        },
                        momentDetails: {},
                    });
                }
            }
        } else if (notification.type === NotificationsEmuns.Types.ACHIEVEMENT_COMPLETED) {
            navigation.navigate('Achievements');
        } else if (notification.type === NotificationsEmuns.Types.CONNECTION_REQUEST_ACCEPTED) {
            if (notification.messageParams?.userId) {
                navigation.navigate('ViewUser', {
                    userInView: {
                        id: notification.messageParams?.userId,
                    },
                });
            }
        } else if (notification.type === NotificationsEmuns.Types.CONNECTION_REQUEST_RECEIVED) {
            if (notification.messageParams?.userId) {
                navigation.navigate('ViewUser', {
                    userInView: {
                        id: notification.messageParams?.userId,
                    },
                });
            }
        } else if (notification.type === NotificationsEmuns.Types.NEW_DM_RECEIVED) {
            if (notification.messageParams?.userId && notification.messageParams?.userName) {
                navigation.navigate('DirectMessage', {
                    connectionDetails: {
                        id: notification.messageParams?.userId,
                        userName: notification.messageParams?.userName,
                    },
                });
            } else {
                navigation.navigate('Connect', {
                    activeTab: PEOPLE_CAROUSEL_TABS.CONNECTIONS,
                });
            }
        } else if (notification.type === NotificationsEmuns.Types.NEW_GROUP_MEMBERS) {
            if (notification.associationId) {
                navigation.navigate('ViewGroup', {
                    id: notification.associationId,
                });
            } else {
                navigation.navigate('Groups', {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                });
            }
        } else if (notification.type === NotificationsEmuns.Types.NEW_GROUP_INVITE) {
            const groupId = notification.associationId || notification.messageParams?.groupId;
            if (groupId) {
                navigation.navigate('ViewGroup', {
                    id: notification.associationId,
                });
            } else {
                navigation.navigate('Groups', {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                });
            }
        }
    };

    scrollTop = () => {
        this.flatListRef?.scrollToOffset({ animated: true, offset: 0 });
    };

    handleRefresh = () => {
        const { searchNotifications, user } = this.props;
        this.setState({ isRefreshing: true });

        // TODO: Connect UI redux prefetch from Layout
        searchNotifications({
            filterBy: 'userId',
            query: user.details.id,
            itemsPerPage: 50,
            pageNumber: 1,
            order: 'desc',
        }).finally(() => this.setState({ isRefreshing: false }));
    };

    render() {
        const { navigation, notifications, user } = this.props;
        const { isRefreshing } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <FlatList
                        data={notifications.messages || []}
                        keyExtractor={(item) => String(item.id)}
                        ListHeaderComponent={notifications.messages?.length ? (
                            <View style={notificationStyles.markAllReadContainer}>
                                <Pressable onPress={this.handleMarkAllRead}>
                                    <Text style={this.themeForms.styles.buttonLinkHeader}>
                                        {this.translate('pages.notifications.markAllRead')}
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}
                        renderItem={({ item, index }) => (
                            <Notification
                                acknowledgeRequest={this.handleConnectionRequestAction}
                                handlePressAndNavigate={(e) => this.onNotificationPress(e, item, false, true)}
                                handlePress={(e) => this.onNotificationPress(e, item, false, false)}
                                isUnread={item.isUnread}
                                notification={item}
                                containerStyles={index === 0 ? notificationStyles.firstChildNotification : notificationStyles.otherChildNotification}
                                translate={this.translate}
                                themeNotification={this.themeNotification}
                            />
                        )}
                        ListEmptyComponent={<ListEmpty iconName="bell" theme={this.theme} text={this.translate(
                            'pages.notifications.noNotifications'
                        )} />}
                        ref={(component) => (this.flatListRef = component)}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={this.handleRefresh}
                        />}
                        style={notificationStyles.container}
                        initialNumToRender={8}
                        maxToRenderPerBatch={5}
                        windowSize={11}
                    />
                </SafeAreaView>
                <MainButtonMenu
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

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
