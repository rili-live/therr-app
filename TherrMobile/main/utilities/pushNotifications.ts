import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidChannel, Notification } from '@notifee/react-native';
import { AndroidChannelIds, PressActionIds, getAndroidChannel } from '../constants';

const sendForegroundNotification = (notification: Notification, androidChannel?: AndroidChannel) => {
    // Request permissions (required for iOS)
    return notifee.requestPermission()
        .then(() => notifee.createChannel(androidChannel || getAndroidChannel(AndroidChannelIds.default, false)))
        .then((channelId: string) => {
            return notifee.displayNotification({
                title: notification.title,
                body: notification.body,
                android: {
                    actions: notification.android?.actions || undefined,
                    channelId,
                    smallIcon: notification.android?.smallIcon || 'ic_notification_icon', // optional, defaults to 'ic_launcher'.
                    color: '#0f7b82',
                    // pressAction is needed if you want the notification to open the app when pressed
                    pressAction: notification.android?.pressAction || {
                        id: PressActionIds.default,
                    },
                },
            });
        });
};

/**
 * Allows us to centralize logic that we want to use for both foreground and background messages
 */
const wrapOnMessageReceived = async (
    isInForeground,
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) => {
    if (isInForeground) {
        console.log('Message handled in the foreground!', remoteMessage);
    } else {
        console.log('Message handled in the background!', remoteMessage);
    }
};

export {
    sendForegroundNotification,
    wrapOnMessageReceived,
};
