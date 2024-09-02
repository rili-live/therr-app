import { RequestHandler } from 'express';
import { getSearchQueryArgs, parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
import notifyUserOfUpdate from '../utilities/notifyUserOfUpdate';
import TherrEventEmitter from '../api/TherrEventEmitter';
// import * as globalConfig from '../../../../global-config';

export const translateNotification = (notification?: {
    messageLocaleKey: string;
    messageParams?: any;
}, locale = 'en-us') => {
    if (!notification) {
        return {
            message: '',
        };
    }
    return {
        ...notification,
        message: translate(locale, notification.messageLocaleKey, notification?.messageParams),
    };
};

// CREATE
const createNotification = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return notifyUserOfUpdate({
        authorization: req.headers.authorization,
        locale,
        whiteLabelOrigin,
        brandVariation,
    }, {
        userId: req.body.userId,
        type: req.body.type, // DB Notification type
        associationId: req.body.associationId,
        isUnread: req.body.isUnread,
        messageLocaleKey: req.body.messageLocaleKey,
        messageParams: req.body.messageParams,
    }, {
        toUserId: req.body.userId,
        fromUser: {
            name: req.body.fromUserName,
            id: req.headers['x-userid'],
        },
    }, {
        shouldCreateDBNotification: true,
        shouldSendPushNotification: false,
        shouldSendEmail: false,
    })
        .then((notification) => res.status(202).send(translateNotification(notification, locale)))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));
};

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
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = ['id'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.notifications.searchNotifications(userId, searchArgs[0]);

    /**
     * This is simply an event trigger. It could be triggered by a user logging in, or any other common event.
     * We will probably want to move this to a scheduler to run at a set interval.
     */
    TherrEventEmitter.runThoughtDistributorAlgorithm([userId], 'updatedAt', 0);

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
