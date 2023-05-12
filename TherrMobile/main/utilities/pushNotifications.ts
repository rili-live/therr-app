import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidChannel, AndroidNotificationSetting, Notification, RepeatFrequency, TimestampTrigger, TriggerType } from '@notifee/react-native';
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
                    timestamp: Date.now(), // 8 minutes ago
                    showTimestamp: true,
                },
            });
        });
};

const sendTriggerNotification = async (
    futureDate: Date,
    notification: Notification,
    androidChannel?: AndroidChannel,
    repeatFrequency?: RepeatFrequency,
) => {
    const settings = await notifee.getNotificationSettings();
    if (settings.android.alarm !== AndroidNotificationSetting.ENABLED) {
        // Show some user information to educate them on what exact alarm permission is,
        // and why it is necessary for your app functionality, then send them to system preferences:
        await notifee.openAlarmPermissionSettings();
    }

    const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: futureDate.getTime(),
        repeatFrequency: repeatFrequency,
    };

    console.log(futureDate.getTime());

    // Request permissions (required for iOS)
    return notifee.requestPermission()
        .then(() => notifee.createChannel(androidChannel || getAndroidChannel(AndroidChannelIds.default, false)))
        .then((channelId: string) => {
            return notifee.createTriggerNotification({
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
                    timestamp: Date.now(), // 8 minutes ago
                    showTimestamp: true,
                },
            }, trigger);
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
    sendTriggerNotification,
    wrapOnMessageReceived,
};
