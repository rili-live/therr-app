import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'rili-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import DirectMessagesStore from '../store/DirectMessagesStore';

// CREATE
const createDirectMessage = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';

    return DirectMessagesStore.createDirectMessage({
        message: req.body.message,
        toUserId: req.body.toUserId,
        fromUserId: req.body.fromUserId,
        isUnread: req.body.isUnread,
        locale,
    })
        .then(([directMessage]) => res.status(201).send(directMessage))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:NOTIFICATIONS_ROUTES:ERROR' }));
};

// READ
const searchDirectMessages: RequestHandler = (req: any, res: any) => {
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = ['toUserId', 'fromUserId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = DirectMessagesStore.searchDirectMessages(searchArgs[0]);
    const countPromise = DirectMessagesStore.countRecords({
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:DIRECT_MESSAGES_ROUTES:ERROR' }));
};

export {
    createDirectMessage,
    searchDirectMessages,
};
