import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'rili-public-library/utilities/http.js';
import handleHttpError from '../utilities/handleHttpError';
import NotificationsStore from '../store/NotificationsStore';

// READ
const getNotification = (req, res) => NotificationsStore.getNotifications({
    requestingUserId: req.params.notificationId,
})
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: `No notification found with id, ${req.params.notificationId}.`,
                statusCode: 404,
            });
        }
        return res.status(200).send(results[0]);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

const searchNotifications: RequestHandler = (req: any, res: any) => {
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = ['id', 'userId', 'associationId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = NotificationsStore.searchNotifications(searchArgs[0], searchArgs[1]);
    const countPromise = NotificationsStore.countRecords({
        filterBy,
        query,
    });

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results,
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
const updateNotification = (req, res) => NotificationsStore.getNotifications({
    requestingUserId: req.params.requestingUserId,
    acceptingUserId: req.body.acceptingUserId,
})
    .then((getResults) => {
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
            .then((results) => res.status(202).send(results[0]));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));

export {
    getNotification,
    searchNotifications,
    updateNotification,
};
