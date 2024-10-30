/* eslint-disable no-case-declarations */
import * as admin from 'firebase-admin';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import translate from '../utilities/translator';

const serviceAccount = JSON.parse(Buffer.from(process.env.PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64 || '', 'base64').toString());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: 'https://<DATABASE_NAME>.firebaseio.com',
});

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

interface ICreateBaseMessage {
    data: any;
    deviceToken: any;
}

interface ICreateNotificationMessage extends ICreateBaseMessage {
    notificationTitle: string;
    notificationBody: string;
}

const getAppBundleIdentifier = (brandVariation: BrandVariations) => {
    switch (brandVariation) {
        case BrandVariations.THERR:
            return 'com.therr.mobile.Therr';
        default:
            return 'com.therr.mobile.Therr';
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

    // Required for background/quit data-only messages on iOS
    baseMessage.apns = {
        payload: {
            aps: {
                mutableContent: true,
                contentAvailable: true,
            },
        },
        headers: {
            'apns-push-type': 'background',
            'apns-priority': '5',
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
            // channelId: '', // TODO: Add matching channelIds from mobile app
        },
    },
    notification: {
        title: notificationTitle,
        body: notificationBody,
    },
    token: deviceToken,
});

const createMessage = (type: PushNotifications.Types, data: any, config: ICreateMessageConfig): admin.messaging.Message | false => {
    let baseMessage: any = {};
    const modifiedData = {
        type,
        timestamp: Date.now().toString(), // values must be strings!
    };
    Object.keys(data).forEach((key) => { modifiedData[key] = JSON.stringify(data[key]); });

    switch (type) {
        // Automation
        case PushNotifications.Types.createYourProfileReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.createYourProfileReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createYourProfileReminder.body'),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.CREATE_YOUR_PROFILE_REMINDER;
            return baseMessage;
        case PushNotifications.Types.createAMomentReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.createAMomentReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createAMomentReminder.body'),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.CREATE_A_MOMENT_REMINDER;
            return baseMessage;
        case PushNotifications.Types.latestPostLikesStats:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.latestPostLikesStats.title'),
                notificationBody: translate(config.userLocale, 'notifications.latestPostLikesStats.body', {
                    likeCount: config.likeCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.LATEST_POST_LIKES_STATS;
            return baseMessage;
        case PushNotifications.Types.latestPostViewcountStats:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.latestPostViewcountStats.title'),
                notificationBody: translate(config.userLocale, 'notifications.latestPostViewcountStats.body', {
                    viewCount: config.viewCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.LATEST_POST_VIEWCOUNT_STATS;
            return baseMessage;
        case PushNotifications.Types.unreadNotificationsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.unreadNotificationsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unreadNotificationsReminder.body', {
                    notificationsCount: config.notificationsCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.UNREAD_NOTIFICATIONS_REMINDER;
            return baseMessage;
        case PushNotifications.Types.unclaimedAchievementsReminder:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.body', {
                    achievementsCount: config.achievementsCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.UNCLAIMED_ACHIEVEMENTS_REMINDER;
            return baseMessage;

        // Event Driven
        case PushNotifications.Types.achievementCompleted:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.achievementCompleted.title'),
                notificationBody: translate(config.userLocale, 'notifications.achievementCompleted.body'),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.ACHIEVEMENT_COMPLETED;
            return baseMessage;
        case PushNotifications.Types.connectionRequestAccepted:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.connectionRequestAccepted.title'),
                notificationBody: translate(config.userLocale, 'notifications.connectionRequestAccepted.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_CONNECTION;
            return baseMessage;
        case PushNotifications.Types.newConnectionRequest:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newConnectionRequest.title'),
                notificationBody: translate(config.userLocale, 'notifications.newConnectionRequest.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_CONNECTION_REQUEST;
            return baseMessage;
        case PushNotifications.Types.newDirectMessage:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    otificationTitle: translate(config.userLocale, 'notifications.newDirectMessage.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newDirectMessage.body', {
                        userName: config.fromUserName,
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
            }, PushNotifications.AndroidIntentActions.Therr.NEW_DIRECT_MESSAGE);
            return baseMessage;
        case PushNotifications.Types.newGroupMessage:
            baseMessage = createDataOnlyMessage({
                data: {
                    ...modifiedData,
                    notificationTitle: translate(config.userLocale, 'notifications.newGroupMessage.title'),
                    notificationBody: translate(config.userLocale, 'notifications.newGroupMessage.body', {
                        groupName: config.groupName,
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
            }, PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_MESSAGE);
            return baseMessage;
        case PushNotifications.Types.newGroupMembers:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newGroupMembers.title'),
                notificationBody: translate(config.userLocale, 'notifications.newGroupMembers.body', {
                    groupName: config.groupName,
                    members: config.groupMembersList?.slice(0, 3).join(', '),
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_MEMBERS;
            return baseMessage;
        case PushNotifications.Types.newGroupInvite:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newGroupInvite.title'),
                notificationBody: translate(config.userLocale, 'notifications.newGroupInvite.body', {
                    groupName: config.groupName,
                    fromUserName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_INVITE;
            return baseMessage;
        case PushNotifications.Types.newLikeReceived:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newLikeReceived.title'),
                notificationBody: translate(config.userLocale, 'notifications.newLikeReceived.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_LIKE_RECEIVED;
            return baseMessage;
        case PushNotifications.Types.newSuperLikeReceived:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newSuperLikeReceived.title'),
                notificationBody: translate(config.userLocale, 'notifications.newSuperLikeReceived.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_SUPER_LIKE_RECEIVED;
            return baseMessage;
        case PushNotifications.Types.newAreasActivated:
            baseMessage = createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newAreasActivated.title'),
                notificationBody: translate(config.userLocale, 'notifications.newAreasActivated.body', {
                    totalAreasActivated: config.totalAreasActivated,
                }),
            });
            baseMessage.android.notification.clickAction = PushNotifications.AndroidIntentActions.Therr.NEW_AREAS_ACTIVATED;
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
            }, PushNotifications.AndroidIntentActions.Therr.NUDGE_SPACE_ENGAGEMENT);
            return baseMessage;
        case PushNotifications.Types.proximityRequiredMoment:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueMoment.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueMoment.body'),
            });
        case PushNotifications.Types.proximityRequiredSpace:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueSpace.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueSpace.body'),
            });
        case PushNotifications.Types.newThoughtReplyReceived:
            return createNotificationMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newThoughtReplyReceived.title'),
                notificationBody: translate(config.userLocale, 'notifications.newThoughtReplyReceived.body', {
                    userName: config.fromUserName,
                }),
            });
        default:
            return false;
    }
};

// TODO: RDATA-3 - Add machine learning to predict whether to send push notification
const predictAndSendNotification = (
    type: PushNotifications.Types,
    data,
    config: ICreateMessageConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metrics?: INotificationMetrics,
) => {
    const message = createMessage(type, data, config);

    return Promise.resolve()
        .then(() => {
            if (!message) {
                return;
            }

            // Automation
            if (type === PushNotifications.Types.createYourProfileReminder) {
                return admin.messaging().send(message);
            }
            if (type === PushNotifications.Types.createAMomentReminder) {
                return admin.messaging().send(message);
            }
            if (type === PushNotifications.Types.latestPostLikesStats) {
                return admin.messaging().send(message);
            }
            if (type === PushNotifications.Types.latestPostViewcountStats) {
                return admin.messaging().send(message);
            }
            if (type === PushNotifications.Types.unreadNotificationsReminder) {
                return admin.messaging().send(message);
            }
            if (type === PushNotifications.Types.unclaimedAchievementsReminder) {
                return admin.messaging().send(message);
            }

            // Event Driven
            if (type === PushNotifications.Types.achievementCompleted) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.connectionRequestAccepted) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newConnectionRequest) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newDirectMessage) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newGroupMessage) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newGroupMembers) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newGroupInvite) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newLikeReceived) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newSuperLikeReceived) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newAreasActivated) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.nudgeSpaceEngagement) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.proximityRequiredMoment) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.proximityRequiredSpace) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newThoughtReplyReceived) {
                return admin.messaging().send(message);
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
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to send push notification'],
                traceArgs: {
                    'error.message': error?.message,
                    'error.stack': error?.stack,
                    'pushNotification.messageData': message && message.data,
                    'pushNotification.messageNotification': message && message.notification,
                    'user.id': config?.userId,
                    'pushNotification.lastMomentNotificationDate': metrics?.lastMomentNotificationDate,
                    'pushNotification.lastSpaceNotificationDate': metrics?.lastSpaceNotificationDate,
                    issue: 'failed to send push notification',
                },
            });
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
};
