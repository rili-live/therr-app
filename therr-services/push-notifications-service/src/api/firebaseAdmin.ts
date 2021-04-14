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

const predictAndSendNotification = (type: PushNotificationTypes, data, config: ICreateMessageConfig) => {
    const message = createMessage(type, data, config);

    if (!message) {
        return Promise.resolve();
    }

    if (type === PushNotificationTypes.proximityRequiredMoment) {
        return admin.messaging().send(message)
            .catch((error) => {
                beeline.addContext({
                    errorMessage: error?.stack || 'Failed to send push notification',
                    messageData: message.data,
                    messageNotification: message.notification,
                    userId: config.userId,
                });
            });
    }
};

export default admin;

export {
    createMessage,
    predictAndSendNotification,
    PushNotificationTypes,
};
