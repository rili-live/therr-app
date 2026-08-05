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
import { Platform } from 'react-native';
import { AndroidChannelIds, getAllAndroidChannels, getAndroidChannel } from '../constants';
import { BRAND_BLUE_GREEN } from '../styles/themes/brandConstants';

/**
 * Registers every Android channel in ../constants up front, at app start.
 *
 * Until this existed, channels were only created as a side effect of Notifee
 * rendering a notification on one — i.e. only on the *data-only* push path
 * (createDataOnlyMessage → index.js → sendBackgroundNotification) and the local
 * trigger notifications. But push-notifications-service also sends **display**
 * notifications (createNotificationMessage) that name a channelId in the FCM
 * payload and are rendered by the OS with no JS involved: dailyHabitReminder,
 * morningMotivation, eveningCheckIn, streakBroken and pactDeclined all name
 * `reminders`.
 *
 * On a fresh install that hadn't yet received a data-only push, `reminders` did
 * not exist, so those notifications fell back to the FCM SDK's auto-created
 * "Miscellaneous" channel at DEFAULT importance — no heads-up banner, and a
 * channel name the user can't recognize or tune in Android settings. On HABITS
 * that is the entire daily-reminder loop, silently degraded for exactly the
 * users least likely to tolerate it. (strings.xml's
 * default_notification_channel_id points at `reminders` too, so it could not
 * cover the gap.)
 *
 * Safe to call more than once: createChannels is an upsert. Android still locks
 * importance and vibration at first creation, so registering here — before any
 * notification can arrive — is also what makes those values deterministic
 * rather than a race between call sites.
 */
const createAndroidNotificationChannels = (): Promise<void> => {
    if (Platform.OS !== 'android') {
        return Promise.resolve();
    }

    return notifee.createChannels(getAllAndroidChannels())
        // Non-fatal: sendForegroundNotification still creates its own channel on
        // demand, and a failure here must never stop the app from booting.
        .catch((err) => console.log('Failed to create Android notification channels', err));
};

// Android locks a channel's importance at creation time — later createChannel calls
// with a different importance are ignored for the life of the install. So whichever
// code path happened to post first used to decide, permanently, whether e.g. the
// "Habit Reminders" channel could show a heads-up banner: the foreground path forced
// DEFAULT, the background path forced HIGH. Importance now comes from the channel's
// own definition in ../constants unless a caller deliberately overrides it, which
// makes AndroidChannels the single source of truth and the outcome order-independent.
const sendForegroundNotification = (
    notification: Notification,
    androidChannel?: AndroidChannel,
    importance?: AndroidImportance,
    shouldRequestPermission = true,
) => {
    const channel = androidChannel || getAndroidChannel(AndroidChannelIds.default, false);
    const permissionPromise = shouldRequestPermission ? notifee.requestPermission() : Promise.resolve();
    // Request permissions (required for iOS)
    return permissionPromise
        .then(() => notifee.createChannel({
            ...channel,
            importance: importance ?? channel.importance ?? AndroidImportance.DEFAULT,
        }))
        .then((channelId: string) => {
            return notifee.displayNotification({
                title: notification.title,
                body: notification.body,
                android: {
                    actions: notification.android?.actions || undefined,
                    channelId,
                    smallIcon: notification.android?.smallIcon || 'ic_notification_icon', // optional, defaults to 'ic_launcher'.
                    color: BRAND_BLUE_GREEN,
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

/**
 * Sends a Notifee push notification when a data-only Firebase notification is received in the background
 */
const sendBackgroundNotification = (notification: Notification, androidChannel?: AndroidChannel) => {
    // Importance intentionally omitted — see sendForegroundNotification. The channel
    // picked by getAndroidChannelFromClickActionId already encodes how loud this
    // notification should be.
    return sendForegroundNotification(notification, androidChannel, undefined, true);
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
                    color: BRAND_BLUE_GREEN,
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
    createAndroidNotificationChannels,
    sendBackgroundNotification,
    sendForegroundNotification,
    sendTriggerNotification,
    wrapOnMessageReceived,
};
