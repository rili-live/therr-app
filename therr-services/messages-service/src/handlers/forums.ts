import axios from 'axios';
import { RequestHandler } from 'express';
import moment from 'moment';
import { getSearchQueryArgs, getSearchQueryString, parseHeaders } from 'therr-js-utilities/http';
import * as globalConfig from '../../../../global-config';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserForum, findUsers } from '../api/usersService';
import { isTextUnsafe } from '../utilities/contentSafety';
import translate from '../utilities/translator';

// CREATE
const createForum = (req, res) => {
    const {
        authorization,
        locale,
        userId,
    } = parseHeaders(req.headers);

    const isTextMature = isTextUnsafe([req.body.title, req.body.subtitle, req.body.description]);

    if (isTextMature) {
        return handleHttpError({
            res,
            message: translate(locale, 'errors.matureText'),
            statusCode: 400,
        });
    }

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
        .then(([forum]) => createUserForum({
            'x-userid': userId,
            'x-localecode': locale,
        }, forum.id).then((response) => {
            const userGroup = response.data;

            return res.status(201).send({
                forum,
                userGroup,
            });
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

// READ
const getForum = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const { forumId } = req.params;
    const queryString = getSearchQueryString({
        itemsPerPage: 20,
        pageNumber: 1,
        withMedia: true,
    });

    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/events/search/for-group-ids${queryString}`,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
        data: {
            groupIds: [forumId],
            withUser: true,
        },
    }).then((response) => {
        const events = response?.data?.results || [];

        return Store.forums.getForum(forumId)
            .then((forums) => {
                if (!forums?.length) {
                    return handleHttpError({
                        res,
                        message: 'Forum not found',
                        statusCode: 404,
                    });
                }

                // Update forum to main most recently updated/active
                Store.forums.updateForum({
                    id: forums[0].id,
                }, {}).catch((err) => {
                    console.log(err);
                });

                return res.status(202).send({
                    ...forums[0],
                    events,
                });
            })
            .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
    });
};

const findForums: RequestHandler = (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
    } = parseHeaders(req.headers);
    const {
        ids,
    } = req.body;

    return Store.forums.findForums(ids).then((results) => res.status(200).send(results));
};

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
        authorId: userId,
    }, {
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
    getForum,
    findForums,
    searchForums,
    updateForum,
};
