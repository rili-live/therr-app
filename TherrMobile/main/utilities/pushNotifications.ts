import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { PushNotifications } from 'therr-js-utilities/constants';
import notifee, {
    AndroidChannel,
    AndroidImportance,
    AndroidNotificationSetting,
    Notification,
    RepeatFrequency,
    TimestampTrigger,
    TriggerType,
} from '@notifee/react-native';
import { AndroidChannelIds, getAndroidChannel } from '../constants';

/**
 * Sends a Notifee push notification when a data-only Firebase notification is received in the background
 */
const sendBackgroundNotification = (notification: Notification, androidChannel?: AndroidChannel) => {
    // Request permissions (required for iOS)
    return sendForegroundNotification(notification, androidChannel, AndroidImportance.HIGH, true);
};

const sendForegroundNotification = (
    notification: Notification,
    androidChannel?: AndroidChannel,
    importance: AndroidImportance = AndroidImportance.DEFAULT,
    shouldRequestPermission = true,
) => {
    const permissionPromise = shouldRequestPermission ? notifee.requestPermission() : Promise.resolve();
    // Request permissions (required for iOS)
    return permissionPromise
        .then(() => notifee.createChannel({
            ...(androidChannel || getAndroidChannel(AndroidChannelIds.default, false)),
            importance,
        }))
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
                        id: PushNotifications.PressActionIds.default,
                    },
                    timestamp: Date.now(), // 8 minutes ago
                    showTimestamp: true,
                },
                data: notification.data,
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
                        id: PushNotifications.PressActionIds.default,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) => {
    if (isInForeground) {
        // console.log('Message handled in the foreground!', remoteMessage);
    } else {
        // console.log('Message handled in the background!', remoteMessage);
    }
};

export {
    sendBackgroundNotification,
    sendForegroundNotification,
    sendTriggerNotification,
    wrapOnMessageReceived,
};
