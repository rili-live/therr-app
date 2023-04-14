/* eslint-disable no-case-declarations */
import * as admin from 'firebase-admin';
import { PushNotifications } from 'therr-js-utilities/constants';
import beeline from '../beeline';
import translate from '../utilities/translator';
import Logger from './Logger';

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
    fromUserName?: string;
    userId: string | string[];
    userLocale: string;
    viewCount?: number;
}

interface INotificationMetrics {
    lastMomentNotificationDate?: number | null;
    lastSpaceNotificationDate?: number | null;
}

interface ICreateBaseMessage {
    data: any;
    deviceToken: any;
    notificationTitle: string;
    notificationBody: string;
}

const createBaseMessage = ({
    data,
    deviceToken,
    notificationTitle,
    notificationBody,
}: ICreateBaseMessage): admin.messaging.Message | false => ({
    data,
    notification: {
        title: notificationTitle,
        body: notificationBody,
    },
    android: {
        notification: {
            icon: 'ic_notification_icon',
            color: '#0f7b82',
            // clickAction: 'app.therrmobile.VIEW_MOMENT',
        },
    },
    // apns: {
    //     payload: {
    //         aps: {
    //             category: '', // apple apn category for click_action
    //         },
    //     },
    // },
    token: deviceToken,
});

const createMessage = (type: PushNotifications.Types, data: any, config: ICreateMessageConfig): admin.messaging.Message | false => {
    let baseMessage: any = {};
    const modifiedData = {
        type,
    };
    Object.keys(data).forEach((key) => { modifiedData[key] = JSON.stringify(data[key]); });

    switch (type) {
        // Automation
        case PushNotifications.Types.createYourProfileReminder:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.createYourProfileReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createYourProfileReminder.body'),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.CREATE_YOUR_PROFILE_REMINDER';
            return baseMessage;
        case PushNotifications.Types.createAMomentReminder:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.createAMomentReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.createAMomentReminder.body'),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.CREATE_A_MOMENT_REMINDER';
            return baseMessage;
        case PushNotifications.Types.latestPostLikesStats:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.latestPostLikesStats.title'),
                notificationBody: translate(config.userLocale, 'notifications.latestPostLikesStats.body', {
                    likeCount: config.likeCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.LATEST_POST_LIKES_STATS';
            return baseMessage;
        case PushNotifications.Types.latestPostViewcountStats:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.latestPostViewcountStats.title'),
                notificationBody: translate(config.userLocale, 'notifications.latestPostViewcountStats.body', {
                    viewCount: config.viewCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.LATEST_POST_VIEWCOUNT_STATS';
            return baseMessage;
        case PushNotifications.Types.unreadNotificationsReminder:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.unreadNotificationsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unreadNotificationsReminder.body', {
                    notificationsCount: config.notificationsCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.UNREAD_NOTIFICATIONS_REMINDER';
            return baseMessage;
        case PushNotifications.Types.unclaimedAchievementsReminder:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.title'),
                notificationBody: translate(config.userLocale, 'notifications.unclaimedAchievementsReminder.body', {
                    achievementsCount: config.achievementsCount || 0,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.UNCLAIMED_ACHIEVEMENTS_REMINDER';
            return baseMessage;

        // Event Driven
        case PushNotifications.Types.achievementCompleted:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.achievementCompleted.title'),
                notificationBody: translate(config.userLocale, 'notifications.achievementCompleted.body'),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.ACHIEVEMENT_COMPLETED';
            return baseMessage;
        case PushNotifications.Types.connectionRequestAccepted:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.connectionRequestAccepted.title'),
                notificationBody: translate(config.userLocale, 'notifications.connectionRequestAccepted.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.NEW_CONNECTION';
            return baseMessage;
        case PushNotifications.Types.newConnectionRequest:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newConnectionRequest.title'),
                notificationBody: translate(config.userLocale, 'notifications.newConnectionRequest.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.NEW_CONNECTION_REQUEST';
            return baseMessage;
        case PushNotifications.Types.newDirectMessage:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newDirectMessage.title'),
                notificationBody: translate(config.userLocale, 'notifications.newDirectMessage.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.NEW_DIRECT_MESSAGE';
            return baseMessage;
        case PushNotifications.Types.newLikeReceived:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newLikeReceived.title'),
                notificationBody: translate(config.userLocale, 'notifications.newLikeReceived.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.NEW_LIKE_RECEIVED';
            return baseMessage;
        case PushNotifications.Types.newSuperLikeReceived:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newSuperLikeReceived.title'),
                notificationBody: translate(config.userLocale, 'notifications.newSuperLikeReceived.body', {
                    userName: config.fromUserName,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.NEW_SUPER_LIKE_RECEIVED';
            return baseMessage;
        case PushNotifications.Types.newAreasActivated:
            baseMessage = createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newAreasActivated.title'),
                notificationBody: translate(config.userLocale, 'notifications.newAreasActivated.body', {
                    totalAreasActivated: config.totalAreasActivated,
                }),
            });
            baseMessage.android.notification.clickAction = 'app.therrmobile.NEW_AREAS_ACTIVATED';
            return baseMessage;
        case PushNotifications.Types.proximityRequiredMoment:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueMoment.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueMoment.body'),
            });
        case PushNotifications.Types.proximityRequiredSpace:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueSpace.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueSpace.body'),
            });
        case PushNotifications.Types.newThoughtReplyReceived:
            return createBaseMessage({
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

            if (type === PushNotifications.Types.newLikeReceived) {
                return admin.messaging().send(message);
            }

            if (type === PushNotifications.Types.newAreasActivated) {
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
                beeline.addContext({
                    message: 'Push successfully sent',
                    messageData: message.data,
                    messageNotification: message.notification,
                    userId: config.userId,
                    ...metrics,
                });
            }
        })
        .catch((error) => {
            Logger.log({
                errorMessage: error?.stack || 'Failed to send push notification',
                messageData: message && message.data,
                messageNotification: message && message.notification,
                userId: config?.userId,
                significance: 'failed to send push notification',
                ...metrics,
            }, process.env.LOGGING_DATASET);
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
};
