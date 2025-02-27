import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { RequestHandler } from 'express';
import moment from 'moment';
import { getSearchQueryArgs, getSearchQueryString, parseHeaders } from 'therr-js-utilities/http';
import {
    ErrorCodes,
    GroupRequestStatuses,
} from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import {
    countForumMembers,
    createUserForum,
    createUserForums,
    findUsers,
    getUserForums,
} from '../api/usersService';
import { isTextUnsafe } from '../utilities/contentSafety';
import translate from '../utilities/translator';

// CREATE
const createActivity = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    let forumId;

    const {
        group,
        event,
    } = req.body;

    const isTextMature = isTextUnsafe([group.title, group.subtitle, group.description]);

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
        administratorIds: group.administratorIds,
        title: group.title,
        subtitle: group.subtitle,
        description: group.description,
        categoryTags: group.categoryTags,
        hashTags: group.hashTags || '',
        integrationIds: group.integrationIds,
        invitees: group.invitees,
        iconGroup: group.iconGroup,
        iconId: group.iconId,
        iconColor: group.iconColor,
        maxCommentsPerMin: group.maxCommentsPerMin || 50,
        doesExpire: group.doesExpire || true,
        isPublic: group.isPublic,
    })
        .then(([dbForum]) => {
            forumId = dbForum.id;

            return createUserForums(req.headers, dbForum, group.memberIds).then((userGroupsResponse) => [dbForum, userGroupsResponse?.data?.userGroups]);
        })
        .then(([dbForum, userGroups]) => internalRestRequest({
            headers: req.headers,
        }, {
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/events`,
            headers: {
                authorization,
                'x-localecode': locale,
                'x-userid': userId,
                'x-therr-origin-host': whiteLabelOrigin,
            },
            data: {
                groupId: dbForum.id,
                ...event,
            },
        }).then((eventResponse) => res.status(201).send({
            group: dbForum,
            event: eventResponse?.data,
            userGroups,
        })))
        .catch((err) => {
            if (forumId) {
                // Delete the forum if we fail to created the associated event
                Store.forums.deleteForum(forumId).catch((error) => {
                    console.log('Failed to delete forum after error');
                    console.log(error);
                });
            }

            return handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' });
        });
};

const createForum = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
    } = parseHeaders(req.headers);

    const isDuplicate = await Store.forums.getForums({
        authorId: userId,
        title: req.body.title,
    }, {
        authorId: userId,
        subtitle: req.body.subtitle,
    }, true)
        .then((forums) => forums?.length);

    if (isDuplicate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.forums.duplicatePost'),
            statusCode: 400,
            errorCode: ErrorCodes.DUPLICATE_POST,
        });
    }

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
        .then(([forum]) => createUserForum(req.headers, forum.id).then((response) => {
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
    if (!forumId || forumId === 'undefined' || forumId === 'null') {
        return handleHttpError({
            res,
            message: 'Forum not found',
            statusCode: 404,
        });
    }
    const queryString = getSearchQueryString({
        itemsPerPage: 20,
        pageNumber: 1,
        withMedia: true,
    });

    return internalRestRequest({
        headers: req.headers,
    }, {
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

    return getUserForums(req.headers).then((userGroupsResponse) => {
        const validGroupIds = userGroupsResponse?.data?.userGroups
            ?.filter((userGroup) => userGroup?.status === GroupRequestStatuses.APPROVED || userGroup?.status === GroupRequestStatuses.PENDING)
            .map((userGroup) => userGroup.groupId);

        // Private groups that the user has an open or accepted invite to
        // TODO: It's probably better for the frontend to request this from a separate endpoint
        const userMemberGroupsPromise = Store.forums.searchForums(searchArgs[0], searchArgs[1], {
            usersInvitedForumIds: validGroupIds,
            categoryTags: req.body.categoryTags,
            forumIds: req.body.forumIds,
        });

        return Promise.all([searchPromise, userMemberGroupsPromise, countPromise]).then(([results, userMemberResults, countResult]) => {
            const userMemberGroups = userMemberResults?.filter((group) => !group.isPublic);
            const userIdSet = new Set<any>();
            const resultGroups = [...userMemberGroups, ...results];
            resultGroups.forEach((result) => userIdSet.add(result.authorId));
            const userIds = [...userIdSet];

            return Promise.all([
                findUsers(req.headers, userIds),
                countForumMembers(req.headers, resultGroups.map((g) => g.id)),
            ]).then(([usersResponse, countResponse]) => {
                const users: any[] = usersResponse.data;
                const usersById = users.reduce((acc, cur) => ({
                    ...acc,
                    [cur.id]: cur,
                }), {});

                const response = {
                    results: resultGroups // TODO: RFRONT-25 - localize dates
                        .map((result) => {
                            const user = usersById[result.authorId];

                            return {
                                ...result,
                                createdAt: moment(result.createdAt).format('M/D/YY, h:mma'),
                                author: {
                                    ...user,
                                },
                                memberCount: countResponse?.data?.[result.id],
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
        categoryTags: req.body.categoryTags,
        hashTags: req.body.hashTags || undefined,
        integrationIds: req.body.integrationIds,
        invitees: req.body.invitees,
        iconGroup: req.body.iconGroup,
        iconId: req.body.iconId,
        iconColor: req.body.iconColor,
        maxCommentsPerMin: req.body.maxCommentsPerMin,
        doesExpire: req.body.doesExpire,
        isPublic: req.body.isPublic,
    })
        .then(([forum]) => res.status(202).send(forum))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

const archiveForum = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { forumId } = req.params;

    return Store.forums.archiveForum({
        id: forumId,
        authorId: userId,
    })
        .then(([forum]) => res.status(202).send(forum))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

export {
    createActivity,
    createForum,
    searchCategories,
    getForum,
    findForums,
    searchForums,
    updateForum,
    archiveForum,
};
