import { RequestHandler } from 'express';
import axios from 'axios';
import moment from 'moment';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// CREATE
const createForumMessage = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.forumMessages.createForumMessage({
        forumId: req.body.forumId,
        message: req.body.message,
        fromUserId: req.body.fromUserId,
        fromUserLocale: locale,
    })
        .then(([directMessage]) => res.status(201).send(directMessage))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUM_MESSAGES_ROUTES:ERROR' }));
};

// READ
const searchForumMessages: RequestHandler = (req: any, res: any) => {
    // const userId = req.headers['x-userid'];
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const { forumId } = req.params;
    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.forumMessages.searchForumMessages(forumId, searchArgs[0], searchArgs[1]);
    const countPromise = Store.forumMessages.countRecords({
        filterBy,
        query,
    });

    // TODO: Fetch username and media for each user (as aggregate)
    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        // const userIdSet = new Set();
        // results.forEach((result) => userIdSet.add(result.fromUserId));
        // const userIds = [...userIdSet];
        // TODO: Fetch userName and media
        // axios({
        //     method: 'post',
        //     url: `${baseUsersServiceRoute}/users`,
        //     headers,
        //     data: {
        //         thoughtIds,
        //         userHasActivated: true,
        //     },
        // })
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUM_MESSAGES_ROUTES:ERROR' }));
};

export {
    createForumMessage,
    searchForumMessages,
};
