import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';

export const translateNotification = (notification, locale = 'en-us') => ({
    ...notification,
    message: translate(locale, notification.messageLocaleKey, notification.messageParams),
});

// CREATE
const createNotification = (req, res) => Store.notifications.createNotification({
    userId: req.body.userId,
    type: req.body.type,
    associationId: req.body.associationId,
    isUnread: req.body.isUnread,
    messageLocaleKey: req.body.messageLocaleKey,
    messageParams: req.body.messageParams,
})
    .then(([notification]) => {
        const locale = req.headers['x-localecode'] || 'en-us';

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
    const integerColumns = ['id', 'userId', 'associationId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.notifications.searchNotifications(searchArgs[0]);
    const countPromise = Store.notifications.countRecords({
        filterBy,
        query,
    });

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results: results.map((r) => translateNotification(r, locale)),
            pagination: {
                totalItems: Number(countResult[0].count),
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
