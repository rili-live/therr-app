import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import { Notifications, PushNotifications } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
// import * as globalConfig from '../../../../global-config';
import sendPushNotificationAndEmail from '../utilities/sendPushNotificationAndEmail';

export const translateNotification = (notification, locale = 'en-us') => ({
    ...notification,
    message: translate(locale, notification.messageLocaleKey, notification.messageParams),
});

// CREATE
const createNotification = (req, res) => Store.notifications.createNotification({
    userId: req.body.userId,
    type: req.body.type, // DB Notification type
    associationId: req.body.associationId,
    isUnread: req.body.isUnread,
    messageLocaleKey: req.body.messageLocaleKey,
    messageParams: req.body.messageParams,
})
    .then(([notification]) => {
        const authorization = req.headers.authorization;
        const locale = req.headers['x-localecode'] || 'en-us';
        const fromUserId = req.headers['x-userid'];
        const { shouldSendPushNotification, userId: toUserId, fromUserName } = req.body;
        const notificationType = req.body.type;
        let pushNotificationType = PushNotifications.Types.newDirectMessage;
        if (notificationType === Notifications.Types.NEW_LIKE_RECEIVED) {
            pushNotificationType = PushNotifications.Types.newLikeReceived;
        } else if (notificationType === Notifications.Types.NEW_SUPER_LIKE_RECEIVED) {
            pushNotificationType = PushNotifications.Types.newSuperLikeReceived;
        }

        // TODO: Handle additional notification types (currently only handles DM notification)
        if (shouldSendPushNotification) {
            // Fire and forget
            sendPushNotificationAndEmail(Store.users.findUser, {
                authorization,
                fromUserName,
                fromUserId,
                locale,
                toUserId,
                type: pushNotificationType,
            });
        }

        return res.status(202).send(translateNotification(notification, locale));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

// READ
const getNotification = (req, res) => Store.notifications.getNotifications({
    requestingUserId: req.params.notificationId,
})
    .then((results) => {
        const locale = req.headers['x-localecode'] || 'en-us';

        if (!results.length) {
            return handleHttpError({
                res,
                message: `No notification found with id, ${req.params.notificationId}.`,
                statusCode: 404,
            });
        }
        return res.status(200).send(translateNotification(results[0], locale));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

const searchNotifications: RequestHandler = (req: any, res: any) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = ['id'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.notifications.searchNotifications(searchArgs[0]);
    // const countPromise = Store.notifications.countRecords({
    //     filterBy,
    //     query,
    // });
    const countPromise = Promise.resolve();

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results: results.map((r) => translateNotification(r, locale)),
            pagination: {
                // totalItems: Number(countResult[0].count),
                totalItems: 100, // arbitrary number because count is slow and not needed
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));
};

// UPDATE
const updateNotification = (req, res) => Store.notifications.getNotifications({
    id: req.params.notificationId,
})
    .then((getResults) => {
        const locale = req.headers['x-localecode'] || 'en-us';
        const {
            isUnread,
        } = req.body;

        if (!getResults.length) {
            return handleHttpError({
                res,
                message: `No notification found with id, ${req.params.notificationId}.`,
                statusCode: 404,
            });
        }

        return Store.notifications
            .updateNotification({
                id: req.params.notificationId,
            }, {
                isUnread,
            })
            .then((results) => res.status(202).send(translateNotification(results[0], locale)));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

export {
    createNotification,
    getNotification,
    searchNotifications,
    updateNotification,
};
