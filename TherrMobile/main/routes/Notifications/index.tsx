import React from 'react';
import { RefreshControl, SafeAreaView, FlatList, View, Text } from 'react-native';
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
import BaseStatusBar from '../../components/BaseStatusBar';
import styles from '../../styles';
import { notifications as notificationStyles } from '../../styles/notifications';
import translator from '../../services/translator';
import MainButtonMenuAlt from '../../components/ButtonMenu/MainButtonMenuAlt';
import Notification from './Notification';

interface INotificationsDispatchProps {
    logout: Function;
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

    constructor(props) {
        super(props);

        this.state = {
            isRefreshing: false,
        };

        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.notifications.headerTitle'),
        });
    }

    handleConnectionRequestAction = (e: any, notification, isAccepted) => {
        const { user, updateUserConnection } = this.props;
        let otherUserId = Number(notification.userConnection.acceptingUserId);

        if (otherUserId === Number(user.details.id)) {
            otherUserId = Number(notification.userConnection.requestingUserId);
        }

        const updatedUserConnection = {
            ...notification.userConnection,
            acceptingUserId: user.details.id,
            requestStatus: isAccepted ? 'complete' : 'denied',
        };

        this.markNotificationAsRead(e, notification, updatedUserConnection);

        updateUserConnection({
            connection: {
                otherUserId,
                requestStatus: isAccepted ? 'complete' : 'denied',
            },
            user: user.details,
        });
    }

    markNotificationAsRead = (event, notification, userConnection?: any) => {
        if (notification.isUnread || userConnection) {
            const { updateNotification, user } = this.props;

            const message = {
                notification: {
                    ...notification,
                    isUnread: false,
                },
                userName: user.details.userName,
            };

            if (userConnection) {
                message.notification.userConnection = userConnection;
            }
            updateNotification(message);
        }
    }

    scrollTop = () => {
        this.flatListRef?.scrollToOffset({ animated: true, offset: 0 });
    }

    handleRefresh = () => {
        const { searchNotifications, user } = this.props;
        this.setState({ isRefreshing: true });

        searchNotifications({
            filterBy: 'userId',
            query: user.details.id,
            itemsPerPage: 50,
            pageNumber: 1,
            order: 'desc',
        }).finally(() => this.setState({ isRefreshing: false }));
    }

    render() {
        const { navigation, notifications, user } = this.props;
        const { isRefreshing } = this.state;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={styles.safeAreaView}>
                    {
                        notifications.messages.length ? (
                            <FlatList
                                data={notifications.messages}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={({ item, index }) => (
                                    <Notification
                                        acknowledgeRequest={this.handleConnectionRequestAction}
                                        handlePress={(e) => this.markNotificationAsRead(e, item, false)}
                                        isUnread={item.isUnread}
                                        notification={item}
                                        containerStyles={index === 0 ? notificationStyles.firstChildNotification : {}}
                                        translate={this.translate}
                                    />
                                )}
                                ref={(component) => (this.flatListRef = component)}
                                initialScrollIndex={0}
                                onContentSizeChange={() => this.flatListRef.scrollToIndex({
                                    index: 0,
                                    animated: true,
                                })}
                                refreshControl={<RefreshControl
                                    refreshing={isRefreshing}
                                    onRefresh={this.handleRefresh}
                                />}
                                style={notificationStyles.container}
                            />
                        ) :
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionDescription}>
                                    {this.translate(
                                        'pages.notifications.noNotifications'
                                    )}
                                </Text>
                            </View>
                    }
                </SafeAreaView>
                <MainButtonMenuAlt
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
