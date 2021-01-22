import React from 'react';
import { FlatList, SafeAreaView, View, Text, StatusBar } from 'react-native';
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
import styles from '../styles';
import { notifications as notificationStyles } from '../styles/notifications';
import translator from '../services/translator';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import Notification from '../components/Notification';

interface INotificationsDispatchProps {
    logout: Function;
    searchUserConnections: Function;
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

interface INotificationsState {}

const mapStateToProps = (state) => ({
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateNotification: NotificationActions.update,
    updateUserConnection: UserConnectionsActions.update,
}, dispatch);

class Notifications extends React.Component<
    INotificationsProps,
    INotificationsState
> {
    private failTimeoutId: any;
    private flatListRef: any;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.notifications.headerTitle'),
        });
    }

    componentWillUnmount = () => {
        clearTimeout(this.failTimeoutId);
    };

    handleConnectionRequestAction = (e: any, notification, isAccepted) => {
        const { user, updateUserConnection } = this.props;

        const updatedUserConnection = {
            ...notification.userConnection,
            acceptingUserId: user.details.id,
            requestStatus: isAccepted ? 'complete' : 'denied',
        };

        this.markNotificationAsRead(e, notification, updatedUserConnection);

        updateUserConnection({
            connection: updatedUserConnection,
            user: user.details,
        });
    }

    handleScrollToIndexFailed = (info) => {
        this.failTimeoutId = setTimeout(() => {
            if (this.flatListRef) {
                this.flatListRef.scrollToIndex({
                    index: info.index,
                    animated: true,
                });
            }
        }, 500);
    };

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

    render() {
        const { navigation, notifications, user } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView>
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
                                        containerStyles={index === 0 ? { borderTopWidth: 1 } : {}}
                                        translate={this.translate}
                                    />
                                )}
                                ref={(component) => (this.flatListRef = component)}
                                initialScrollIndex={0}
                                onScrollToIndexFailed={this.handleScrollToIndexFailed}
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
                <MainButtonMenu navigation={navigation} translate={this.translate} user={user} />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
