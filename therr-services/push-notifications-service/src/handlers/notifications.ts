import { RequestHandler } from 'express';
import { PushNotifications } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import { predictAndSendNotification } from '../api/firebaseAdmin';
// import translate from '../utilities/translator';

// CREATE/UPDATE
const predictAndSendPushNotification: RequestHandler = (req, res) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const headers = {
        authorization,
        locale: (locale as string),
        userId: (userId as string),
    };

    const {
        fromUserName,
        toUserDeviceToken,
        type,

        // optional
        achievementsCount,
        likeCount,
        notificationsCount,
        totalAreasActivated,
        viewCount,
    } = req.body;

    return predictAndSendNotification(
        // TODO: This endpoint should accept a type
        type || PushNotifications.Types.newDirectMessage,
        {
            fromUser: {
                userName: fromUserName,
            },
        },
        {
            deviceToken: toUserDeviceToken,
            userId: headers.userId,
            userLocale: headers.locale,
            fromUserName,
            achievementsCount,
            likeCount,
            notificationsCount,
            totalAreasActivated,
            viewCount,
        },
    )
        .then(() => res.status(201).send({}))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

const testPushNotification: RequestHandler = (req, res) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const headers = {
        authorization,
        locale: (locale as string),
        userId: (userId as string),
    };

    const {
        fromUserName,
        toUserDeviceToken,
        type,
    } = req.query;

    return predictAndSendNotification(
        // TODO: This endpoint should accept a type
        type as any || PushNotifications.Types.newLikeReceived,
        {
            fromUser: {
                userName: fromUserName,
            },
        },
        {
            deviceToken: toUserDeviceToken,
            userId: headers.userId,
            userLocale: headers.locale,
            fromUserName: fromUserName?.toString(),
        },
    )
        .then(() => res.status(201).send({}))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

export {
    predictAndSendPushNotification,
    testPushNotification,
};
