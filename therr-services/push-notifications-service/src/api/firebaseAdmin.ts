/* eslint-disable no-case-declarations */
import * as admin from 'firebase-admin';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import translate from '../utilities/translator';
import { clearInvalidDeviceToken } from '../handlers/helpers/user';
import { getCredentialEnvKey } from './firebaseCredentialEnvKey';

// FCM error codes for tokens that should be removed from the database.
// See https://firebase.google.com/docs/cloud-messaging/send-message#admin
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument', // FCM returns this when the token is malformed
]);

const isInvalidTokenError = (error: any): boolean => INVALID_TOKEN_ERROR_CODES.has(error?.code)
    || INVALID_TOKEN_ERROR_CODES.has(error?.errorInfo?.code);

// Brand → credential-env-key mapping lives in ./firebaseCredentialEnvKey so it can be
// imported by unit tests without triggering this module's startup-time validation.

const parseServiceAccount = (envKey: string, brandVariation: BrandVariations): admin.ServiceAccount | null => {
    const raw = process.env[envKey];
    if (!raw) {
        return null;
    }
    let parsed: any;
    try {
        parsed = JSON.parse(Buffer.from(raw, 'base64').toString());
    } catch (err: any) {
        throw new Error(
            `push-notifications-service: ${envKey} (${brandVariation}) is not valid base64-encoded JSON (${err?.message || 'parse error'}).`,
        );
    }
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
        throw new Error(
            `push-notifications-service: Firebase service account JSON for ${brandVariation} is missing required fields (project_id, client_email, private_key).`,
        );
    }
    return parsed as admin.ServiceAccount;
};

// THERR credentials are required at startup (matches the historical
// single-app contract); absence is a hard failure so misconfigurations can't
// hide behind a fallback to a brand that doesn't exist.
const therrServiceAccount = parseServiceAccount(
    getCredentialEnvKey(BrandVariations.THERR),
    BrandVariations.THERR,
);
if (!therrServiceAccount) {
    throw new Error(
        'push-notifications-service: PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64 is not set. FCM cannot be initialized.',
    );
}

const defaultApp = admin.initializeApp({
    credential: admin.credential.cert(therrServiceAccount),
    // databaseURL: 'https://<DATABASE_NAME>.firebaseio.com',
});

// Cache of admin.app instances keyed by BrandVariations. Initialized lazily on
// first send for each brand: we don't know which brands are in use at boot,
// and eagerly initializing an app for every enum value would fail for brands
// whose env var isn't set in this environment. The fallback entry below
// ensures a brand without credentials still gets pushed (via the THERR/
// default app) rather than silently dropping the notification.
const brandAppCache = new Map<BrandVariations, admin.app.App>();
brandAppCache.set(BrandVariations.THERR, defaultApp);

// Tracks brands we've already warned about falling back to the default app,
// so we don't spam the logs on every send to a brand whose env var is unset.
const brandsWithLoggedFallback = new Set<BrandVariations>();

const getAdminAppForBrand = (brandVariation: BrandVariations): admin.app.App => {
    const cached = brandAppCache.get(brandVariation);
    if (cached) return cached;

    const envKey = getCredentialEnvKey(brandVariation);
    const serviceAccount = parseServiceAccount(envKey, brandVariation);

    if (!serviceAccount) {
        if (!brandsWithLoggedFallback.has(brandVariation)) {
            brandsWithLoggedFallback.add(brandVariation);
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: [
                    `No Firebase credentials for brand ${brandVariation} (${envKey} not set) — falling back to default (THERR) Firebase app.`,
                ],
                traceArgs: {
                    'pushNotification.brandVariation': brandVariation,
                    'pushNotification.missingEnvKey': envKey,
                },
            });
        }
        // Cache the fallback so subsequent sends skip the env lookup.
        brandAppCache.set(brandVariation, defaultApp);
        return defaultApp;
    }

    const app = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        String(brandVariation), // name this admin app uniquely per brand
    );
    brandAppCache.set(brandVariation, app);
    return app;
};

interface ICreateMessageConfig {
    achievementsCount?: number;
    likeCount?: number;
    notificationsCount?: number;
    totalAreasActivated?: number;
    deviceToken: any;
    fromUserId?: string;
    fromUserName?: string;
    groupId?: string;
    groupName?: string;
    userId: string | string[];
    userLocale: string;
    viewCount?: number;
    groupMembersList?: string[],
}

interface INotificationMetrics {
    lastMomentNotificationDate?: number | null;
    lastSpaceNotificationDate?: number | null;
}

// Must match the channel ids created on the mobile client in
// TherrMobile/main/constants/index.tsx (AndroidChannelIds). Without a matching
// channelId, Android 8+ will drop display-style notifications.
enum AndroidChannelId {
    default = 'default',
    contentDiscovery = 'contentDiscovery',
    rewardUpdates = 'rewardUpdates',
    reminders = 'reminders',
}

interface ICreateBaseMessage {
    data: { [key: string]: string; };
    deviceToken: any;
}

interface ICreateNotificationMessage extends ICreateBaseMessage {
    notificationTitle: string;
    notificationBody: string;
    channelId?: AndroidChannelId;
}

const getPostActionId = (postType?: string) => {
    let id = PushNotifications.PressActionIds.spaceView;

    if (postType === 'moments') {
        id = PushNotifications.PressActionIds.momentView;
    }
    if (postType === 'thoughts') {
        id = PushNotifications.PressActionIds.thoughtView;
    }
    return id;
};

const getAppBundleIdentifier = (brandVariation: BrandVariations) => {
    switch (brandVariation) {
        case BrandVariations.TEEM:
            return 'com.therr.mobile.Teem';
        case BrandVariations.THERR:
            return 'com.therr.mobile.Therr';
        default:
            return 'com.therr.mobile.Therr';
    }
};

const getAppBrandingClickAction = (brandVariation: BrandVariations, clickActionKey: string) => {
    switch (brandVariation) {
        case BrandVariations.TEEM:
            return PushNotifications.AndroidIntentActions.Teem[clickActionKey];
        case BrandVariations.THERR:
            return PushNotifications.AndroidIntentActions.Therr[clickActionKey];
        default:
            return PushNotifications.AndroidIntentActions.Therr[clickActionKey];
    }
};

// TODO: Add brandVariation to dynamically set app bundle identifier
const createBaseMessage = (
    {
        data,
        deviceToken,
    }: ICreateBaseMessage,
): admin.messaging.Message | false => {
    const message: admin.messaging.Message = {
        data,
        // apns: {
        //     payload: {
        //         aps: {
        //             category: '', // apple apn category for click_action
        //         },
        //     },
        // },
        token: deviceToken,
    };

    return message;
};

// TODO: Add brandVariation to dynamically set app bundle identifier
const createDataOnlyMessage = (
    {
        data,
        deviceToken,
    }: ICreateBaseMessage,
    clickActionId: string,
    brandVariation: BrandVariations = BrandVariations.THERR,
): admin.messaging.Message | false => {
    const baseMessage = createBaseMessage({
        data: {
            ...data,
            clickActionId,
        },
        deviceToken,
    });

    if (baseMessage === false) {
        return false;
    }

    // iOS: deliver as a visible APNS alert (push-type=alert, priority=10).
    //
    // The previous design sent these as iOS silent pushes
    // (push-type=background + content-available) and relied on a JS
    // setBackgroundMessageHandler to display the notification via Notifee. That
    // is unreliable on iOS: silent pushes never wake a killed app and can be
    // throttled under low power, so users frequently never saw anything.
    //
    // With an alert payload, iOS renders the notification natively in any app
    // state (foreground, backgrounded, or killed). The data payload still
    // arrives, so tapping the notification can be routed the same way as
    // before via the `notificationTitle` / `clickActionId` data fields. On
    // iOS foreground, the OS suppresses alerts by default, so `onMessage` in
    // Layout.tsx continues to fire and display via Notifee as it does today.
    //
    // Android is unaffected: it still receives a data-only payload (no `aps`
    // equivalent) and setBackgroundMessageHandler still converts it to a
    // Notifee notification with custom channel and action buttons.
    //
    // TODO(iOS-NSE): add an iOS Notification Service Extension so iOS can
    // match Android's custom action buttons (e.g. "Reply", "View") below the
    // alert. Without an NSE, the OS-rendered alert can only show title/body
    // and does not expose Notifee's android.actions to the user. The NSE
    // target would live in TherrMobile/ios/ as a separate bundle, read the
    // data payload, and call UNNotificationAttachment / UNNotificationAction
    // APIs. Tracked for a future PR — the data payload this function sends
    // already contains everything the NSE would need (notificationLinkPress-
    // Actions, notificationPressActionId, clickActionId).
    const iosTitle = typeof data.notificationTitle === 'string' ? data.notificationTitle : '';
    const iosBody = typeof data.notificationBody === 'string' ? data.notificationBody : '';
    baseMessage.apns = {
        payload: {
            aps: {
                alert: { title: iosTitle, body: iosBody },
                sound: 'default',
                mutableContent: true,
            },
        },
        headers: {
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-topic': getAppBundleIdentifier(brandVariation), // your app bundle identifier
        },
    };

    if (!baseMessage?.android) {
        baseMessage.android = {};
    }

    // Required for background/quit data-only messages on Android
    baseMessage.android.priority = 'high';

    return baseMessage;
};

const createNotificationMessage = ({
    data,
    deviceToken,
    notificationTitle,
    notificationBody,
    channelId = AndroidChannelId.default,
}: ICreateNotificationMessage): admin.messaging.Message | false => ({
    ...createBaseMessage({
        data,
        deviceToken,
    }),
    android: {
        notification: {
            icon: 'ic_notification_icon',
            color: '#0f7b82', // TODO: use brandVariation for icon color
            // clickAction: 'app.therrmobile.VIEW_MOMENT',
            channelId,
        },
    },
    notification: {
        title: notificationTitle,
        body: notificationBody,
    },
    token: deviceToken,
});

const createMessage = (
    type: PushNotifications.Types,
    data: PushNotifications.INotificationData,
    config: ICreateMessageConfig,
    brandVariation: BrandVariations = BrandVariations.THERR,
): admin.messaging.Message | false => {
    let baseMessage: any = {};
    const modifiedData: any = {
        type,
        timestamp: Date.now().toString(), // values must be strings!
    };
    Object.keys(data).forEach((key) => {
        if (typeof data[key] === 'object') {
            modifiedData[key] = JSON.stringify(data[key]);
        } else {
            modifiedData[key] = data[key];
        }
    });

    switch (type) {
        // Automation
        case PushNotifications.Types.createYourProfileReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.createYourProfileReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createYourProfileReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'CREATE_YOUR_PROFILE_REMINDER');
            return baseMessage;
        case PushNotifications.Types.createAMomentReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.createAMomentReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createAMomentReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'CREATE_A_MOMENT_REMINDER');
            return baseMessage;
        case PushNotifications.Types.completeDraftReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.completeDraftReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.completeDraftReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'COMPLETE_DRAFT_REMINDER');
            return baseMessage;
        case PushNotifications.Types.latestPostLikesStats:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.latestPostLikesStats.title'),
                notificationBody: translate(config.userLocale, 'notifications.latestPostLikesStats.body', {
                    likeCount: config.likeCount || 0,
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'LATEST_POST_LIKES_STATS');
            return baseMessage;
        case PushNotifications.Types.latestPostViewcountStats:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.latestPostViewcountStats.title'),
                    notificationBody: translate(config.userLocale, 'notifications.latestPostViewcountStats.body', {
                        viewCount: config.viewCount || 0,
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.momentView,
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'LATEST_POST_VIEWCOUNT_STATS'));
            return baseMessage;
        case PushNotifications.Types.unreadNotificationsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.unreadNotificationsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unreadNotificationsReminder.body', {
                    notificationsCount: config.notificationsCount || 0,
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'UNREAD_NOTIFICATIONS_REMINDER');
            return baseMessage;
        case PushNotifications.Types.unclaimedAchievementsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.body', {
                    achievementsCount: config.achievementsCount || 0,
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'UNCLAIMED_ACHIEVEMENTS_REMINDER');
            return baseMessage;
        case PushNotifications.Types.inviteFriendsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.inviteFriendsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.inviteFriendsReminder.body'),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'INVITE_FRIENDS_REMINDER');
            return baseMessage;

        // Event Driven
        case PushNotifications.Types.achievementCompleted:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.achievementCompleted.title'),
                notificationBody: translate(config.userLocale, 'notifications.achievementCompleted.body'),
                channelId: AndroidChannelId.rewardUpdates,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'ACHIEVEMENT_COMPLETED');
            return baseMessage;
        case PushNotifications.Types.connectionRequestAccepted:
            // Expects modifiedData.fromUser = { id: ..., userName };
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.connectionRequestAccepted.title'),
                    notificationBody: translate(config.userLocale, 'notifications.connectionRequestAccepted.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.userView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.dmReplyToMsg,
                            title: translate(config.userLocale, 'notifications.connectionRequestAccepted.pressActionMessage'),
                        },
                        {
                            id: PushNotifications.PressActionIds.userView,
                            title: translate(config.userLocale, 'notifications.connectionRequestAccepted.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_CONNECTION'));
            return baseMessage;
        case PushNotifications.Types.newConnectionRequest:
            // Expects modifiedData.fromUser = { id: ..., userName };
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newConnectionRequest.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newConnectionRequest.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.userView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.userAcceptConnectionRequest,
                            title: translate(config.userLocale, 'notifications.newConnectionRequest.pressActionAccept'),
                        },
                        {
                            id: PushNotifications.PressActionIds.userView,
                            title: translate(config.userLocale, 'notifications.newConnectionRequest.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_CONNECTION_REQUEST'));
            return baseMessage;
        case PushNotifications.Types.newDirectMessage:
            // Expects modifiedData.fromUser = { id: ..., userName };
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newDirectMessage.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newDirectMessage.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.dmView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.dmView,
                            title: translate(config.userLocale, 'notifications.newDirectMessage.pressActionView'),
                        },
                        {
                            id: PushNotifications.PressActionIds.dmReplyToMsg,
                            title: translate(config.userLocale, 'notifications.newDirectMessage.pressActionReply'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_DIRECT_MESSAGE'));
            return baseMessage;
        case PushNotifications.Types.newGroupMessage:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newGroupMessage.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newGroupMessage.body', {
                        groupName: String(config.groupName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.groupView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.groupView,
                            title: translate(config.userLocale, 'notifications.newGroupMessage.pressActionView'),
                        },
                        {
                            id: PushNotifications.PressActionIds.groupReplyToMsg,
                            title: translate(config.userLocale, 'notifications.newGroupMessage.pressActionReply'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_GROUP_MESSAGE'));
            return baseMessage;
        case PushNotifications.Types.newGroupMembers:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newGroupMembers.title'),
                notificationBody: translate(config.userLocale, 'notifications.newGroupMembers.body', {
                    groupName: String(config.groupName || ''),
                    members: String(config.groupMembersList?.slice(0, 3).join(', ') || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'NEW_GROUP_MEMBERS');
            return baseMessage;
        case PushNotifications.Types.newGroupInvite:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newGroupInvite.title'),
                notificationBody: translate(config.userLocale, 'notifications.newGroupInvite.body', {
                    groupName: String(config.groupName || ''),
                    fromUserName: String(config.fromUserName || ''),
                }),
                channelId: AndroidChannelId.reminders,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'NEW_GROUP_INVITE');
            return baseMessage;
        case PushNotifications.Types.newLikeReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newLikeReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newLikeReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: getPostActionId(modifiedData?.postType),
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: getPostActionId(modifiedData?.postType),
                            title: translate(config.userLocale, 'notifications.newLikeReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_LIKE_RECEIVED'));
            return baseMessage;
        case PushNotifications.Types.newSuperLikeReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newSuperLikeReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newSuperLikeReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: getPostActionId(modifiedData?.postType),
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: getPostActionId(modifiedData?.postType),
                            title: translate(config.userLocale, 'notifications.newSuperLikeReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_SUPER_LIKE_RECEIVED'));
            return baseMessage;
        case PushNotifications.Types.newAreasActivated:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newAreasActivated.title'),
                notificationBody: translate(config.userLocale, 'notifications.newAreasActivated.body', {
                    totalAreasActivated: Number(config.totalAreasActivated || 0),
                }),
                channelId: AndroidChannelId.contentDiscovery,
            });
            baseMessage.android.notification.clickAction = getAppBrandingClickAction(brandVariation, 'NEW_AREAS_ACTIVATED');
            return baseMessage;
        // TODO: Make this a data-only message and test
        // Implement Notifee local push notification on from-end
        case PushNotifications.Types.nudgeSpaceEngagement:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.nudgeSpaceEngagement.title'),
                    notificationBody: translate(config.userLocale, 'notifications.nudgeSpaceEngagement.body'),
                    notificationPressActionId: PushNotifications.PressActionIds.nudge,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.nudge,
                            title: translate(config.userLocale, 'notifications.nudgeSpaceEngagement.pressActionCheckIn'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NUDGE_SPACE_ENGAGEMENT'));
            return baseMessage;
        case PushNotifications.Types.proximityRequiredMoment:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueMoment.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueMoment.body'),
                channelId: AndroidChannelId.contentDiscovery,
            });
        case PushNotifications.Types.proximityRequiredSpace:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueSpace.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueSpace.body'),
                channelId: AndroidChannelId.contentDiscovery,
            });
        case PushNotifications.Types.newThoughtReplyReceived:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newThoughtReplyReceived.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newThoughtReplyReceived.body', {
                        userName: String(config.fromUserName || ''),
                    }),
                    notificationPressActionId: PushNotifications.PressActionIds.thoughtView,
                    notificationLinkPressActions: JSON.stringify([
                        {
                            id: PushNotifications.PressActionIds.thoughtView,
                            title: translate(config.userLocale, 'notifications.newThoughtReplyReceived.pressActionView'),
                        },
                    ]),
                },
                deviceToken: config.deviceToken,
            }, getAppBrandingClickAction(brandVariation, 'NEW_THOUGHT_REPLY_RECEIVED'));
            return baseMessage;
        default:
            return false;
    }
};

// TODO: RDATA-3 - Add machine learning to predict whether to send push notification
const predictAndSendNotification = (
    type: PushNotifications.Types,
    data: PushNotifications.INotificationData,
    config: ICreateMessageConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metrics?: INotificationMetrics,
    brandVariation: BrandVariations = BrandVariations.THERR,
    headers?: InternalConfigHeaders,
) => {
    const message = createMessage(type, data, config, brandVariation);
    // Route sends through the brand's own Firebase project so FCM delivery
    // uses the correct APNS auth key / FCM credentials for this brand.
    const messaging = getAdminAppForBrand(brandVariation).messaging();

    return Promise.resolve()
        .then(() => {
            if (!message) {
                return;
            }

            // Automation
            if (type === PushNotifications.Types.createYourProfileReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.createAMomentReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.completeDraftReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.latestPostLikesStats) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.latestPostViewcountStats) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.unreadNotificationsReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.unclaimedAchievementsReminder) {
                return messaging.send(message);
            }
            if (type === PushNotifications.Types.inviteFriendsReminder) {
                return messaging.send(message);
            }

            // Event Driven
            if (type === PushNotifications.Types.achievementCompleted) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.connectionRequestAccepted) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newConnectionRequest) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newDirectMessage) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newGroupMessage) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newGroupMembers) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newGroupInvite) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newLikeReceived) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newSuperLikeReceived) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newAreasActivated) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.nudgeSpaceEngagement) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.proximityRequiredMoment) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.proximityRequiredSpace) {
                return messaging.send(message);
            }

            if (type === PushNotifications.Types.newThoughtReplyReceived) {
                return messaging.send(message);
            }

            return null;
        })
        .then(() => {
            if (message) {
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Push successfully sent'],
                    traceArgs: {
                        'pushNotification.message': 'Push successfully sent',
                        'pushNotification.messageData': message.data,
                        'pushNotification.messageNotification': message.notification,
                        'user.id': config.userId,
                        'pushNotification.lastMomentNotificationDate': metrics?.lastMomentNotificationDate,
                        'pushNotification.lastSpaceNotificationDate': metrics?.lastSpaceNotificationDate,
                    },
                });
            }
        })
        .catch((error) => {
            const fcmErrorCode = error?.code || error?.errorInfo?.code;
            const tokenInvalid = isInvalidTokenError(error);
            const targetUserId = typeof config.userId === 'string' ? config.userId : undefined;

            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [
                    tokenInvalid
                        ? 'Invalid FCM device token — scheduling cleanup'
                        : 'Failed to send push notification',
                ],
                traceArgs: {
                    'error.message': error?.message,
                    'error.code': fcmErrorCode,
                    'error.stack': error?.stack,
                    'pushNotification.messageData': message && message.data,
                    'pushNotification.messageNotification': message && message.notification,
                    'pushNotification.tokenInvalid': tokenInvalid,
                    'user.id': targetUserId,
                    'pushNotification.lastMomentNotificationDate': metrics?.lastMomentNotificationDate,
                    'pushNotification.lastSpaceNotificationDate': metrics?.lastSpaceNotificationDate,
                    issue: tokenInvalid ? 'invalid fcm device token' : 'failed to send push notification',
                },
            });

            if (tokenInvalid && config.deviceToken) {
                // Fire-and-forget; helper swallows its own errors
                clearInvalidDeviceToken(headers, targetUserId, config.deviceToken);
            }
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
};
