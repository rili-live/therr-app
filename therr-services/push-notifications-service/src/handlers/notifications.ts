import { RequestHandler } from 'express';
import { PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
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
        // HABITS streak / pact / partner payload fields
        streakCount,
        previousRecordDays,
        partnerName,
        pactId,
        pactName,
        habitId,
        habitName,
        daysRemaining,
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
            streakCount,
            previousRecordDays,
            partnerName,
            pactId,
            pactName,
            habitId,
            habitName,
            daysRemaining,
        },
        undefined,
        brandVariation,
        req.headers as unknown as InternalConfigHeaders,
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
        // HABITS streak / pact / partner payload fields
        streakCount,
        previousRecordDays,
        partnerName,
        pactId,
        pactName,
        habitId,
        habitName,
        daysRemaining,
    } = req.body;

    const recipients: any[] = (users || []).filter((user: any) => !user.shouldMuteNotifs);
    const promises = recipients.map((user: any) => predictAndSendNotification(
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
            // Identify the recipient, not the request initiator, so invalid-
            // token cleanup and error logging target the right user.
            userId: user.id || headers.userId,
            userLocale: user.settingsLocale || headers.locale,
            fromUserName: fromUserDetails?.userName,
            groupName: groupDetails?.name,
            achievementsCount,
            likeCount,
            notificationsCount,
            totalAreasActivated,
            viewCount,
            streakCount,
            previousRecordDays,
            partnerName,
            pactId,
            pactName,
            habitId,
            habitName,
            daysRemaining,
        },
        undefined,
        brandVariation,
        req.headers as unknown as InternalConfigHeaders,
    ));

    // allSettled (not all) so one bad token doesn't mask the rest. predictAnd-
    // SendNotification already swallows send errors internally, so these will
    // usually all fulfill — the fallback is belt-and-suspenders.
    return Promise.allSettled(promises)
        .then((results) => {
            const rejected = results.filter((r) => r.status === 'rejected');
            if (rejected.length) {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Multi push notification: unexpected rejection(s) escaped predictAndSendNotification'],
                    traceArgs: {
                        'pushNotification.recipientCount': recipients.length,
                        'pushNotification.rejectedCount': rejected.length,
                    },
                });
            }
            return res.status(201).send({
                sent: results.length,
                rejected: rejected.length,
            });
        })
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
        req.headers as unknown as InternalConfigHeaders,
    ).then(() => res.status(201).send(`Sent ${type} notification!`))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
};

export {
    predictAndSendPushNotification,
    predictAndSendMultiPushNotification,
    testPushNotification,
};
