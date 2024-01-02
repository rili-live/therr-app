import { RequestHandler } from 'express';
import moment from 'moment';
import { getSearchQueryArgs, parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { findUsers } from '../api/usersService';

// CREATE
const createForum = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.forums.createForum({
        authorId: userId,
        authorLocale: locale,
        administratorIds: req.body.administratorIds,
        title: req.body.title,
        subtitle: req.body.subtitle,
        description: req.body.description,
        categoryTags: req.body.categoryTags,
        hashTags: req.body.hashTags || '',
        integrationIds: req.body.integrationIds,
        invitees: req.body.invitees,
        iconGroup: req.body.iconGroup,
        iconId: req.body.iconId,
        iconColor: req.body.iconColor,
        maxCommentsPerMin: req.body.maxCommentsPerMin || 50,
        doesExpire: req.body.doesExpire || true,
        isPublic: req.body.isPublic || true,
    })
        .then(([forum]) => res.status(201).send(forum))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

// READ
const searchForums: RequestHandler = (req: any, res: any) => {
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
    const integerColumns = ['authorId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.forums.searchForums(searchArgs[0], searchArgs[1], {
        usersInvitedForumIds: req.body.usersInvitedForumIds,
        categoryTags: req.body.categoryTags,
        forumIds: req.body.forumIds,
    });
    // const countPromise = Store.forums.countRecords({
    //     filterBy,
    //     query,
    // });
    const countPromise = Promise.resolve();

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const userIdSet = new Set<any>();
        results.forEach((result) => userIdSet.add(result.authorId));
        const userIds = [...userIdSet];

        findUsers({
            authorization,
            'x-userid': userId,
            'x-localecode': locale,
        }, userIds).then((usersResponse) => {
            const users: any[] = usersResponse.data;
            const usersById = users.reduce((acc, cur) => ({
                ...acc,
                [cur.id]: cur,
            }), {});

            const response = {
                results: results // TODO: RFRONT-25 - localize dates
                    .map((result) => {
                        const user = usersById[result.authorId];

                        return {
                            ...result,
                            createdAt: moment(result.createdAt).format('M/D/YY, h:mma'),
                            author: {
                                ...user,
                            },
                        };
                    }),
                pagination: {
                    // totalItems: Number(countResult[0].count),
                    totalItems: 100, // arbitrary number because count is slow and not needed
                    itemsPerPage: Number(itemsPerPage),
                    pageNumber: Number(pageNumber),
                },
            };

            return res.status(200).send(response);
        });
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

// READ
const searchCategories: RequestHandler = (req: any, res: any) => {
    // const userId = req.headers['x-userid'];
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.categories.searchCategories(searchArgs[0], searchArgs[1]);
    // const countPromise = Store.forums.countRecords({
    //     filterBy,
    //     query,
    // });
    const countPromise = Promise.resolve();

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results,
            pagination: {
                // totalItems: Number(countResult[0].count),
                totalItems: 100, // arbitrary number because count is slow and unnecessary
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

const updateForum = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { forumId } = req.params;

    return Store.forums.updateForum({
        id: forumId,
    }, {
        authorId: userId,
        authorLocale: locale,
        administratorIds: req.body.administratorIds,
        title: req.body.title,
        subtitle: req.body.subtitle,
        description: req.body.description,
        integrationIds: req.body.integrationIds,
        invitees: req.body.invitees,
        iconGroup: req.body.iconGroup,
        iconId: req.body.iconId,
        iconColor: req.body.iconColor,
        maxCommentsPerMin: req.body.maxCommentsPerMin || 50,
        doesExpire: req.body.doesExpire || true,
        isPublic: req.body.isPublic || true,
    })
        .then(([forum]) => res.status(202).send(forum))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

export {
    createForum,
    searchCategories,
    searchForums,
    updateForum,
};
