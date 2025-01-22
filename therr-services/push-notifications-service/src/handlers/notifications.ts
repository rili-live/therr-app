import { RequestHandler } from 'express';
import { PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import { predictAndSendNotification } from '../api/firebaseAdmin';
// import translate from '../utilities/translator';

// CREATE/UPDATE
const predictAndSendPushNotification: RequestHandler = (req, res) => {
    const {
        authorization,
        brandVariation,
        userId,
        locale,
    } = parseHeaders(req.headers);

    const headers = {
        authorization,
        locale: (locale as string),
        userId: (userId as string),
    };

    const {
        fromUserName,
        fromUser,
        toUserDeviceToken,
        thought,
        type,

        // optional
        area,
        achievementsCount,
        fromUserId,
        groupId,
        groupName,
        groupMembersList,
        likeCount,
        notificationsCount,
        postType,
        totalAreasActivated,
        viewCount,
    } = req.body;

    return predictAndSendNotification(
        // TODO: This endpoint should accept a type
        type || PushNotifications.Types.newDirectMessage,
        {
            area,
            groupId,
            fromUser: fromUser || {
                id: fromUserId,
                userName: fromUserName,
            },
            postType,
            thought,
        },
        {
            deviceToken: toUserDeviceToken,
            userId: headers.userId,
            userLocale: headers.locale,
            fromUserName: fromUserName || fromUser?.userName,
            achievementsCount,
            likeCount,
            notificationsCount,
            totalAreasActivated,
            viewCount,
            groupName,
            groupMembersList,
        },
        undefined,
        brandVariation,
    )
        .then(() => res.status(201).send({}))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

const predictAndSendMultiPushNotification: RequestHandler = (req, res) => {
    const {
        brandVariation,
        userId,
        locale,
    } = parseHeaders(req.headers);

    const headers = {
        locale: (locale as string),
        userId: (userId as string),
    };

    const {
        area,
        users,
        type,
        fromUser,
        fromUserDetails,
        groupDetails,
        postType,
        thought,

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
            area,
            groupId: groupDetails?.id,
            fromUserDetails,
            groupDetails,
            fromUser: fromUser || {
                id: fromUserDetails?.id,
                userName: fromUserDetails?.userName,
            },
            postType,
            thought,
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
        undefined,
        brandVariation,
    ));

    return Promise.all(promises)
        .then(() => res.status(201).send({}))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

// eslint-disable-next-line max-len
// Example: curl -H "x-userid: 123" "http://localhost:7775/v1/notifications/test?toUserDeviceToken=eGEh3WckRjy_aqM784gNM3:APA91bE2b-eXIOq3Wj-moMhjiwv3Ap-b2N8u7vhXiAsWNKRpkTROogV9Cge-r2CNb7wckP8AkQ4PKtD_Gr3FIuwtbtbdsLF5Bpem1gPNateVCH0wgGbc5I1kx-OUegM4TOp3WY5cbnoY&type=nudge-space-engagement"
// eslint-disable-next-line max-len
// Example: curl -H "x-userid: 123" "http://localhost:7775/v1/notifications/test?toUserDeviceToken=eGEh3WckRjy_aqM784gNM3:APA91bE2b-eXIOq3Wj-moMhjiwv3Ap-b2N8u7vhXiAsWNKRpkTROogV9Cge-r2CNb7wckP8AkQ4PKtD_Gr3FIuwtbtbdsLF5Bpem1gPNateVCH0wgGbc5I1kx-OUegM4TOp3WY5cbnoY&type=new-group-message"
// eslint-disable-next-line max-len
// Example: curl -H "x-userid: 123" "http://localhost:7775/v1/notifications/test?toUserDeviceToken=eGEh3WckRjy_aqM784gNM3:APA91bE2b-eXIOq3Wj-moMhjiwv3Ap-b2N8u7vhXiAsWNKRpkTROogV9Cge-r2CNb7wckP8AkQ4PKtD_Gr3FIuwtbtbdsLF5Bpem1gPNateVCH0wgGbc5I1kx-OUegM4TOp3WY5cbnoY&type=new-direct-message"
// eslint-disable-next-line max-len
// Example: curl -H "x-userid: 123" "http://localhost:7775/v1/notifications/test?toUserDeviceToken=e6HW-ZgHi-p6jgOUJyk-oc:APA91bGIlp4qZYEKXnDyAi1nvbiqIeTs7RAAgj6QzWVZV7vqtZnCzfnfAVmkB3nK_49DmeOEn70s5xm_kIcEyLJ_NntfcQvlTafof7dZo9gZwhBvCmrCXGr6jw_gvpHaxtS2VAYB0FUG&type=nudge-space-engagement"
const testPushNotification: RequestHandler = (req, res) => {
    const {
        authorization,
        brandVariation,
        userId,
        locale,
    } = parseHeaders(req.headers);

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

    let notificationData: any = {
        fromUser: {
            id: 'b5e97b45-3d2e-41c2-a28a-5c47aa36eb32',
            userName: fromUserName?.toString() || 'rilimain',
        },
    };
    const notificationConfig: any = {
        deviceToken: toUserDeviceToken,
        userId: headers.userId,
        userLocale: headers.locale,
        fromUserName: fromUserName?.toString() || 'rilimain',
    };

    if (type === PushNotifications.Types.nudgeSpaceEngagement) {
        notificationData = {
            area: {
                id: 'e512af11-0a70-406a-bb81-794d328dbadb',
            },
        };
    }

    if (type === PushNotifications.Types.newDirectMessage
        || type === PushNotifications.Types.newConnectionRequest
    ) {
        notificationData = {
            fromUser: {
                id: 'b5e97b45-3d2e-41c2-a28a-5c47aa36eb32',
                userName: 'rilimain',
            },
        };
    }

    if (type === PushNotifications.Types.newGroupMessage) {
        notificationData = {
            groupId: '2a220814-2915-46b7-b870-ceb96c388b8f',
            groupName: 'Test Group',
        };
        notificationConfig.groupName = 'Test Group';
    }

    return predictAndSendNotification(
        type as any || PushNotifications.Types.newLikeReceived,
        notificationData,
        notificationConfig,
        undefined,
        brandVariation,
    ).then(() => res.status(201).send(`Sent ${type} notification!`))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

export {
    predictAndSendPushNotification,
    predictAndSendMultiPushNotification,
    testPushNotification,
};
