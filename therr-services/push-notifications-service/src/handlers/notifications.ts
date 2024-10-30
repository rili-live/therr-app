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
        fromUserId,
        groupId,
        groupName,
        groupMembersList,
    } = req.body;

    return predictAndSendNotification(
        // TODO: This endpoint should accept a type
        type || PushNotifications.Types.newDirectMessage,
        {
            groupId,
            fromUser: {
                id: fromUserId,
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
            groupName,
            groupMembersList,
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

// eslint-disable-next-line max-len
// Example: curl -H "x-userid: 123" "http://localhost:7775/v1/notifications/test?toUserDeviceToken=eGEh3WckRjy_aqM784gNM3:APA91bE2b-eXIOq3Wj-moMhjiwv3Ap-b2N8u7vhXiAsWNKRpkTROogV9Cge-r2CNb7wckP8AkQ4PKtD_Gr3FIuwtbtbdsLF5Bpem1gPNateVCH0wgGbc5I1kx-OUegM4TOp3WY5cbnoY&type=nudge-space-engagement"
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

    if (type && type === PushNotifications.Types.nudgeSpaceEngagement) {
        return predictAndSendNotification(
            PushNotifications.Types.nudgeSpaceEngagement,
            {
                area: {
                    id: 'e512af11-0a70-406a-bb81-794d328dbadb',
                },
            },
            {
                deviceToken: toUserDeviceToken,
                userId: headers.userId,
                userLocale: headers.locale,
                fromUserName: fromUserName?.toString(),
            },
        ).then(() => res.status(201).send('Sent nudge!'))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
    }

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
        .then(() => res.status(201).send('Sent!'))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

export {
    predictAndSendPushNotification,
    predictAndSendMultiPushNotification,
    testPushNotification,
};
