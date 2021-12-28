import * as admin from 'firebase-admin';
import beeline from '../beeline';
import translate from '../utilities/translator';
import Logger from './Logger';

const serviceAccount = JSON.parse(Buffer.from(process.env.PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64 || '', 'base64').toString());

// TODO: Move these to therr-utilities and share with other services
// eslint-disable-next-line no-shadow
enum PushNotificationTypes {
    connectionRequestAccepted = 'connection-request-accepted',
    newConnectionRequest = 'new-connection-request',
    newDirectMessage = 'new-direct-message',
    newAreasActivated = 'new-moments-activated',
    proximityRequiredMoment = 'proximity-required-moment',
    proximityRequiredSpace = 'proximity-required-space',
}

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
            // clickAction: '',
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

const createMessage = (type: PushNotificationTypes, data: any, config: ICreateMessageConfig): admin.messaging.Message | false => {
    const modifiedData = {
        type,
    };
    Object.keys(data).forEach((key) => { modifiedData[key] = JSON.stringify(data[key]); });

    switch (type) {
        case PushNotificationTypes.connectionRequestAccepted:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.connectionRequestAccepted.title'),
                notificationBody: translate(config.userLocale, 'notifications.connectionRequestAccepted.body', {
                    userName: config.fromUserName,
                }),
            });
        case PushNotificationTypes.newConnectionRequest:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newConnectionRequest.title'),
                notificationBody: translate(config.userLocale, 'notifications.newConnectionRequest.body', {
                    userName: config.fromUserName,
                }),
            });
        case PushNotificationTypes.newDirectMessage:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newDirectMessage.title'),
                notificationBody: translate(config.userLocale, 'notifications.newDirectMessage.body', {
                    userName: config.fromUserName,
                }),
            });
        case PushNotificationTypes.newAreasActivated:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.newAreasActivated.title'),
                notificationBody: translate(config.userLocale, 'notifications.newAreasActivated.body', {
                    totalAreasActivated: config.totalAreasActivated,
                }),
            });
        case PushNotificationTypes.proximityRequiredMoment:
            return createBaseMessage({
                data: modifiedData,
                deviceToken: config.deviceToken,
                notificationTitle: translate(config.userLocale, 'notifications.discoveredUniqueMoment.title'),
                notificationBody: translate(config.userLocale, 'notifications.discoveredUniqueMoment.body'),
            });
        case PushNotificationTypes.proximityRequiredSpace:
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
    type: PushNotificationTypes,
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

            if (type === PushNotificationTypes.connectionRequestAccepted) {
                return admin.messaging().send(message);
            }

            if (type === PushNotificationTypes.newConnectionRequest) {
                return admin.messaging().send(message);
            }

            if (type === PushNotificationTypes.newDirectMessage) {
                return admin.messaging().send(message);
            }

            if (type === PushNotificationTypes.newAreasActivated) {
                return admin.messaging().send(message);
            }

            if (type === PushNotificationTypes.proximityRequiredMoment) {
                return admin.messaging().send(message);
            }

            if (type === PushNotificationTypes.proximityRequiredSpace) {
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
    PushNotificationTypes,
};
