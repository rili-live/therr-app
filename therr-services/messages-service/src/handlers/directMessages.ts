import { RequestHandler } from 'express';
import moment from 'moment';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// CREATE
const createDirectMessage = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.directMessages.createDirectMessage({
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
    const userId = req.headers['x-userid'];
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
        shouldCheckReverse,
    } = req.query;
    const integerColumns = ['toUserId', 'fromUserId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.directMessages.searchDirectMessages(userId, searchArgs[0], searchArgs[1], shouldCheckReverse);
    const countPromise = Store.directMessages.countRecords({
        filterBy,
        query,
    });

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results: results // TODO: RFRONT-25 - localize dates
                .map((result) => ({ ...result, createdAt: moment(result.createdAt).format('M/D/YY, h:mma') })),
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
