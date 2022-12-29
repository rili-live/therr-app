import axios from 'axios';
import path from 'path';
import { getSearchQueryArgs, getSearchQueryString } from 'therr-js-utilities/http';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import * as globalConfig from '../../../../global-config';
import getReactions from '../utilities/getReactions';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';

// CREATE
const createThought = (req, res) => {
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    return Store.thoughts.create({
        ...req.body,
        locale,
        fromUserId: userId,
    })
        .then(([thought]) => axios({ // Create companion reaction for user's own thought
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/thought-reactions/${thought.id}`,
            headers: {
                authorization,
                'x-localecode': locale,
                'x-userid': userId,
            },
            data: {
                userHasActivated: true,
            },
        }).then(({ data: reaction }) => res.status(201).send({
            ...thought,
            reaction,
        })))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// READ
const getThoughtDetails = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { thoughtId } = req.params;

    const {
        withUser,
    } = req.body;

    const shouldFetchUser = !!withUser;

    return Store.thoughts.find([thoughtId], {
        limit: 1,
    }, {
        withUser: shouldFetchUser,
        shouldHideMatureContent: true, // TODO: Check the user settings to determine if mature content should be hidden
    })
        .then(({ thoughts, users }) => {
            const thought = thoughts[0];
            let userHasAccessPromise = () => Promise.resolve(true);
            // Verify that user has activated thought and has access to view it
            // TODO: Verify thought exists
            if (thought?.fromUserId !== userId) {
                userHasAccessPromise = () => getReactions(thoughtId, {
                    'x-userid': userId,
                });
            }

            return userHasAccessPromise().then((isActivated) => {
                if (!isActivated) {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'thoughtReactions.thoughtNotActivated'),
                        statusCode: 400,
                        errorCode: ErrorCodes.THOUGHT_ACCESS_RESTRICTED,
                    });
                }

                return res.status(200).send({ thought, users });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

const searchThoughts: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        // filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const {
        distanceOverride,
    } = req.body;

    const integerColumns = ['maxViews'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    let fromUserIds;
    if (query === 'me') {
        fromUserIds = [userId];
    } else if (query === 'connections') {
        let queryString = getSearchQueryString({
            filterBy: 'acceptingUserId',
            query: userId,
            itemsPerPage,
            pageNumber: 1,
            orderBy: 'interactionCount',
            order: 'desc',
        });
        queryString = `${queryString}&shouldCheckReverse=true`;
        const connectionsResponse: any = await axios({
            method: 'get',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections${queryString}`,
            headers: {
                authorization: req.headers.authorization,
                'x-localecode': req.headers['x-localecode'] || 'en-us',
                'x-userid': userId,
            },
        });
        fromUserIds = connectionsResponse.data.results
            .map((connection: any) => connection.users.filter((user: any) => user.id != userId)[0].id); // eslint-disable-line eqeqeq
    }
    const searchPromise = Store.thoughts.search(searchArgs[0], searchArgs[1], fromUserIds, {}, query !== 'me');
    // const countPromise = Store.thoughts.countRecords({
    //     filterBy,
    //     query,
    // }, fromUserIds);
    const countPromise = Promise.resolve();

    // TODO: Get associated reactions for user and return limited details if thought is not yet activated
    return Promise.all([searchPromise, countPromise]).then(([results]) => {
        const response = {
            results,
            pagination: {
                // totalItems: Number(countResult[0].count),
                totalItems: Number(100), // arbitraty number because count is slow and not needed
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// NOTE: This should remain a non-public endpoint
const findThoughts: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];

    const {
        limit,
        order,
        offset,
        thoughtIds,
        withUser,
    } = req.body;

    return Store.thoughts.find(thoughtIds, {
        limit: limit || 21,
        order,
        offset,
    }, {
        withUser: !!withUser,
    })
        .then(({ thoughts }) => res.status(200).send({ thoughts }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// DELETE
const deleteThoughts = (req, res) => {
    const userId = req.headers['x-userid'];
    // TODO: RSERV-52 | Consider archiving only, and delete/archive associated reactions from reactions-service

    return Store.thoughts.deleteThoughts({
        ...req.body,
        fromUserId: userId,
    })
        .then(([thoughts]) => res.status(202).send(thoughts))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

export {
    createThought,
    getThoughtDetails,
    searchThoughts,
    findThoughts,
    deleteThoughts,
};
