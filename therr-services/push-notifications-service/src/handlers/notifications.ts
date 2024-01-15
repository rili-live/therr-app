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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

const predictAndSendMultiPushNotification: RequestHandler = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const headers = {
        locale: (locale as string),
        userId: (userId as string),
    };

    const {
        users,
        type,
        fromUserDetails,
        groupDetails,

        // optional
        achievementsCount,
        likeCount,
        notificationsCount,
        totalAreasActivated,
        viewCount,
    } = req.body;

    const promises = users.filter((user) => !user.shouldMuteNotifs).map((user) => predictAndSendNotification(
        // TODO: This endpoint should accept a type
        type || PushNotifications.Types.newGroupMessage,
        {
            fromUserDetails,
            groupDetails,
        },
        {
            deviceToken: user.deviceMobileFirebaseToken,
            userId: headers.userId,
            userLocale: headers.locale,
            fromUserName: fromUserDetails?.userName,
            groupName: groupDetails?.name,
            achievementsCount,
            likeCount,
            notificationsCount,
            totalAreasActivated,
            viewCount,
        },
    ));

    return Promise.all(promises)
        .then(() => res.status(201).send({}))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

export {
    predictAndSendPushNotification,
    predictAndSendMultiPushNotification,
    testPushNotification,
};
