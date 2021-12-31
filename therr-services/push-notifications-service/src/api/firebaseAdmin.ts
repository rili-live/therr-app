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
    totalAreasActivated?: number;
    deviceToken: any;
    fromUserName?: string;
    userId: string | string[];
    userLocale: string;
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
                userId: config.userId,
                significance: 'failed to send push notification',
                ...metrics,
            }, {});
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
};
