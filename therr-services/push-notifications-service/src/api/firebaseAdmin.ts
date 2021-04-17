import * as admin from 'firebase-admin';
import beeline from '../beeline';

const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 || '', 'base64').toString());

enum PushNotificationTypes {
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
    userId?: string | string[];
}

interface INotificationMetrics {
    lastNotificationDate: number | null;
}

const createMessage = (type: PushNotificationTypes, data: any, config: ICreateMessageConfig) => {
    switch (type) {
        case PushNotificationTypes.newMomentsActivated:
            return {
                data,
                notification: {
                    title: 'New moments activated',
                    body: `You recently activated ${config.totalMomentsActivated} new moments`,
                },
                token: config.deviceToken,
            };
        case PushNotificationTypes.proximityRequiredMoment:
            return {
                data,
                notification: {
                    title: 'You found a unique moment!',
                    body: 'Check the map to activate a moment with special attributes',
                },
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
    metrics: INotificationMetrics,
) => {
    const message = createMessage(type, data, config);

    return Promise.resolve()
        .then(() => {
            if (!message) {
                return;
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
                });
            }
        })
        .catch((error) => {
            beeline.addContext({
                errorMessage: error?.stack || 'Failed to send push notification',
                messageData: message && message.data,
                messageNotification: message && message.notification,
                userId: config.userId,
                significance: 'failed to send push notification',
            });
        });
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
    PushNotificationTypes,
};
