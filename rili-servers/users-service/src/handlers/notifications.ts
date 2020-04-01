import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'rili-public-library/utilities/http.js';
import handleHttpError from '../utilities/handleHttpError';
import NotificationsStore from '../store/NotificationsStore';
import translate from '../utilities/translator';

const translateNotification = (notification, locale = 'en-us') => ({
    ...notification,
    message: translate(locale, notification.messageLocaleKey, notification.messageParams),
});

// READ
const getNotification = (req, res) => NotificationsStore.getNotifications({
    requestingUserId: req.params.notificationId,
})
    .then((results) => {
        const locale = req.headers['x-localecode'];

        if (!results.length) {
            return handleHttpError({
                res,
                message: `No notification found with id, ${req.params.notificationId}.`,
                statusCode: 404,
            });
        }
        return res.status(200).send(translateNotification(results[0], locale || 'en-us'));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

const searchNotifications: RequestHandler = (req: any, res: any) => {
    const locale = req.headers['x-localecode'];
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = ['id', 'userId', 'associationId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = NotificationsStore.searchNotifications(searchArgs[0]);
    const countPromise = NotificationsStore.countRecords({
        filterBy,
        query,
    });

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results: results.map((r) => translateNotification(r, locale || 'en-us')),
            pagination: {
                totalItems: Number(countResult[0].count),
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => {
            console.log(err);
            handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' });
        });
};

// UPDATE
const updateNotification = (req, res) => NotificationsStore.getNotifications({
    requestingUserId: req.params.requestingUserId,
    acceptingUserId: req.body.acceptingUserId,
})
    .then((getResults) => {
        const locale = req.headers['x-localecode'];
        const {
            isUnread,
        } = req.body;

        if (!getResults.length) {
            return handleHttpError({
                res,
                message: `No notification found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }

        return NotificationsStore
            .updateNotification({
                id: req.params.notificationId,
            }, {
                isUnread,
            })
            .then((results) => res.status(202).send(translateNotification(results[0], locale || 'en-us')));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

export {
    getNotification,
    searchNotifications,
    updateNotification,
};
