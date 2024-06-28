import { RequestHandler } from 'express';
import moment from 'moment';
import { getSearchQueryArgs, parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { findUsers } from '../api/usersService';

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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:DIRECT_MESSAGES_ROUTES:ERROR' }));
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
    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.directMessages.searchDirectMessages(userId, searchArgs[0], searchArgs[1], shouldCheckReverse);
    // const countPromise = Store.directMessages.countRecords({
    //     filterBy,
    //     query,
    // });
    const countPromise = Promise.resolve();

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results: results // TODO: RFRONT-25 - localize dates
                .map((result) => ({ ...result, createdAt: moment(result.createdAt).format('M/D/YY, h:mma') })),
            pagination: {
                // totalItems: Number(countResult[0].count),
                totalItems: 100, // arbitraty number because count is slow and not needed
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:DIRECT_MESSAGES_ROUTES:ERROR' }));
};

const searchMyDirectMessages: RequestHandler = (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
    } = parseHeaders(req.headers);
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);

    return Store.directMessages.searchLatestDMs(userId, searchArgs[0]).then((results) => {
        const userIds = results?.map((result) => (result.toUserId !== userId ? result.toUserId : result.fromUserId));
        // TODO: Fetch user details for display
        return findUsers({
            authorization,
            'x-userid': userId,
            'x-localecode': locale,
        }, userIds).then((usersResponse) => {
            const usersMap = usersResponse?.data?.reduce((acc, cur) => { acc[cur.id] = cur; return acc; }, {});
            const resultsWithUser = results.map((result) => {
                const otherUserId = (result.toUserId !== userId ? result.toUserId : result.fromUserId);

                return {
                    ...result,
                    userDetails: usersMap[otherUserId],
                };
            }).filter((result) => result.userDetails);

            const response = {
                results: resultsWithUser // TODO: RFRONT-25 - localize dates
                    .map((result) => ({ ...result, createdAtFormatted: moment(result.createdAt).format('M/D/YY, h:mma') })),
                pagination: {
                    // totalItems: Number(countResult[0].count),
                    totalItems: 100, // arbitraty number because count is slow and not needed
                    itemsPerPage: Number(itemsPerPage),
                    pageNumber: Number(pageNumber),
                },
            };

            res.status(200).send(response);
        });
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:DIRECT_MESSAGES_ROUTES:ERROR' }));
};

export {
    createDirectMessage,
    searchDirectMessages,
    searchMyDirectMessages,
};
