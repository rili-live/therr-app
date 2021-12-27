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
    newMomentsActivated = 'new-moments-activated',
    proximityRequiredMoment = 'proximity-required-moment',
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: 'https://<DATABASE_NAME>.firebaseio.com',
});

interface ICreateMessageConfig {
    totalMomentsActivated?: number;
    deviceToken: any;
    fromUserName?: string;
    userId: string | string[];
    userLocale: string;
}

interface INotificationMetrics {
    lastNotificationDate: number | null;
}

const createMessage = (type: PushNotificationTypes, data: any, config: ICreateMessageConfig): admin.messaging.Message | false => {
    const modifiedData = {
        type,
    };
    Object.keys(data).forEach((key) => { modifiedData[key] = JSON.stringify(data[key]); });

    switch (type) {
        case PushNotificationTypes.connectionRequestAccepted:
            return {
                data: modifiedData,
                notification: {
                    title: translate(config.userLocale, 'notifications.connectionRequestAccepted.title'),
                    body: translate(config.userLocale, 'notifications.connectionRequestAccepted.body', {
                        userName: config.fromUserName,
                    }),
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
                token: config.deviceToken,
            };
        case PushNotificationTypes.newConnectionRequest:
            return {
                data: modifiedData,
                notification: {
                    title: translate(config.userLocale, 'notifications.newConnectionRequest.title'),
                    body: translate(config.userLocale, 'notifications.newConnectionRequest.body', {
                        userName: config.fromUserName,
                    }),
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
                token: config.deviceToken,
            };
        case PushNotificationTypes.newDirectMessage:
            return {
                data: modifiedData,
                notification: {
                    title: translate(config.userLocale, 'notifications.newDirectMessage.title'),
                    body: translate(config.userLocale, 'notifications.newDirectMessage.body', {
                        userName: config.fromUserName,
                    }),
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
                token: config.deviceToken,
            };
        case PushNotificationTypes.newMomentsActivated:
            return {
                data: modifiedData,
                notification: {
                    title: translate(config.userLocale, 'notifications.newMomentsActivated.title'),
                    body: translate(config.userLocale, 'notifications.newMomentsActivated.body', {
                        totalMomentsActivated: config.totalMomentsActivated,
                    }),
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
                token: config.deviceToken,
            };
        case PushNotificationTypes.proximityRequiredMoment:
            return {
                data: modifiedData,
                notification: {
                    title: translate(config.userLocale, 'notifications.discoveredUniqueMoment.title'),
                    body: translate(config.userLocale, 'notifications.discoveredUniqueMoment.body'),
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
                token: config.deviceToken,
            };
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

            if (type === PushNotificationTypes.newMomentsActivated) {
                return admin.messaging().send(message);
            }

            if (type === PushNotificationTypes.proximityRequiredMoment) {
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
