import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { RequestHandler } from 'express';
import moment from 'moment';
// eslint-disable-next-line import/extensions, import/no-unresolved
import {
    getBrandContext, getSearchQueryArgs, getSearchQueryString, isTestAccount, parseHeaders,
} from 'therr-js-utilities/http';
import {
    ErrorCodes,
    GroupRequestStatuses,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
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
import { FORUM_READ_TRACKING_STARTED_AT } from '../store/ForumReadStatesStore';
import { FORUM_REPORT_HIDE_THRESHOLD, FORUM_REPORT_REASONS } from '../store/ForumReportsStore';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CREATE
const createActivity = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

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

    return Store.forums.createForum(brandVariation, {
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
        isPublic: isTestAccount(req.headers) ? false : group.isPublic,
        city: group.city,
        region: group.region,
        country: group.country,
        localLatitude: group.localLatitude,
        localLongitude: group.localLongitude,
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
                Store.forums.deleteForum(brandVariation, forumId).catch((error) => {
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
    const { brandVariation } = getBrandContext(req.headers);

    const isDuplicate = await Store.forums.getForums(brandVariation, {
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

    const media: any = {};
    if (req.body.media?.length) {
        media.featuredImage = req.body.media[0]?.path;
    }

    return Store.forums.createForum(brandVariation, {
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
        // Store-review / QA accounts' forums stay out of public discovery; the test account
        // cleanup worker purges them (DELETE /test-account-content).
        isPublic: isTestAccount(req.headers) ? false : (req.body.isPublic || true),
        media: JSON.stringify(media),
        city: req.body.city,
        region: req.body.region,
        country: req.body.country,
        localLatitude: req.body.localLatitude,
        localLongitude: req.body.localLongitude,
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
    const { brandVariation } = getBrandContext(req.headers);
    const { forumId } = req.params;
    const isAuthenticated = !!userId;

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
    }).catch((err) => {
        console.log('getForum: events fetch failed (may be missing auth for SSR)', err?.message); // eslint-disable-line no-console
        return { data: { results: [] } };
    })
        .then((response) => {
            const events = response?.data?.results || [];

            return Store.forums.getForum(brandVariation, forumId)
                .then((forums) => {
                    if (!forums?.length) {
                        return handleHttpError({
                            res,
                            message: 'Forum not found',
                            statusCode: 404,
                        });
                    }

                    const forum = forums[0];

                    // For unauthenticated users viewing private groups, return minimal info
                    if (!isAuthenticated && !forum.isPublic) {
                        return res.status(202).send({
                            id: forum.id,
                            title: forum.title,
                            isPublic: forum.isPublic,
                        });
                    }

                    // Update forum to mark most recently updated/active
                    Store.forums.updateForum(brandVariation, {
                        id: forum.id,
                    }, {}).catch((err) => {
                        console.log(err);
                    });

                    // For unauthenticated users, return public-safe fields only
                    if (!isAuthenticated) {
                        return res.status(202).send({
                            id: forum.id,
                            authorId: forum.authorId,
                            title: forum.title,
                            subtitle: forum.subtitle,
                            description: forum.description,
                            hashTags: forum.hashTags,
                            categoryTags: forum.categoryTags,
                            iconGroup: forum.iconGroup,
                            iconId: forum.iconId,
                            iconColor: forum.iconColor,
                            isPublic: forum.isPublic,
                            media: forum.media,
                            featuredImage: forum.featuredImage,
                            createdAt: forum.createdAt,
                            updatedAt: forum.updatedAt,
                            events,
                        });
                    }

                    return res.status(202).send({
                        ...forum,
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
    const { brandVariation } = getBrandContext(req.headers);
    const {
        ids,
    } = req.body;

    return Store.forums.findForums(brandVariation, ids).then((results) => res.status(200).send(results));
};

/**
 * Groups to leave out of Discover because of member reports (see ForumReportsStore). Fails open:
 * Discover must keep working in the window between this build rolling out and its migration
 * running (`_bin/cicd/run-migrations.sh` runs after the rollout), when the table does not exist.
 */
const getDiscoverExclusions = (viewerUserId?: string): Promise<string[]> => Store.forumReports
    .getHiddenFromDiscoverIds(viewerUserId)
    .catch((err) => {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Forums: report exclusions unavailable; Discover is unfiltered'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': viewerUserId,
                source: 'messages-service',
            },
        });
        return [];
    });

/**
 * Adds `lastMessage` and `unreadCount` to each of the viewer's groups and orders them by latest
 * activity, for the "Your Groups" inbox. Fails safe, like getDiscoverExclusions: without the read
 * state table the groups come back as before rather than the request failing.
 */
const attachInboxDetails = async (brand, groups: any[], viewerUserId: string): Promise<any[]> => {
    if (!groups.length) {
        return groups;
    }

    try {
        const forumIds = groups.map((group) => group.id);
        const [latestMessages, unreadCounts] = await Promise.all([
            Store.forumMessages.getLatestByForums(brand, forumIds),
            Store.forumMessages.countUnreadByForum(brand, forumIds, viewerUserId, FORUM_READ_TRACKING_STARTED_AT),
        ]);
        const latestByForumId = latestMessages.reduce((acc, message) => {
            acc[message.forumId] = message;
            return acc;
        }, {});

        const activityTime = (group) => new Date(latestByForumId[group.id]?.createdAt || group.createdAt).getTime() || 0;

        return groups
            .map((group) => {
                const latest = latestByForumId[group.id];

                return {
                    ...group,
                    lastMessage: latest ? {
                        id: latest.id,
                        text: latest.message,
                        fromUserId: latest.fromUserId,
                        createdAt: latest.createdAt,
                    } : null,
                    unreadCount: unreadCounts[group.id] || 0,
                };
            })
            .sort((a, b) => activityTime(b) - activityTime(a));
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Forums: inbox details unavailable; returning groups without them'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': viewerUserId,
                source: 'messages-service',
            },
        });
        return groups;
    }
};

/**
 * Serves two lists:
 * - Discover (no `forumIds`): public groups ranked by recent activity, minus groups hidden by
 *   member reports, with groups the viewer already belongs to moved to the end.
 * - Your Groups (`forumIds` given): those groups with their latest message and unread count,
 *   newest activity first.
 */
const searchForums: RequestHandler = (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
    } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const {
        filterBy,
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const isAuthenticated = !!userId;
    const integerColumns = ['authorId'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const isMyGroupsRequest = Array.isArray(req.body.forumIds) && req.body.forumIds.length > 0;
    const sharedSearchOptions = {
        categoryTags: req.body.categoryTags,
        forumIds: req.body.forumIds,
        nearbyCity: req.body.nearbyCity,
        nearbyLatitude: req.body.nearbyLatitude,
        nearbyLongitude: req.body.nearbyLongitude,
        nearbyMaxDistanceKm: req.body.nearbyMaxDistanceKm,
    };

    const exclusionsPromise = isMyGroupsRequest
        ? Promise.resolve([] as string[])
        : getDiscoverExclusions(isAuthenticated ? userId : undefined);

    // For unauthenticated users, return only public forums without user/member enrichment
    if (!isAuthenticated) {
        return exclusionsPromise
            .then((excludeForumIds) => Store.forums.searchForums(brandVariation, searchArgs[0], searchArgs[1], {
                ...sharedSearchOptions,
                usersInvitedForumIds: undefined,
                excludeForumIds,
                rankByActivity: !isMyGroupsRequest,
            }))
            .then((results) => {
                const response = {
                    results: results.map((result) => ({
                        ...result,
                        createdAt: moment(result.createdAt).format('M/D/YY, h:mma'),
                    })),
                    pagination: {
                        totalItems: 100,
                        itemsPerPage: Number(itemsPerPage),
                        pageNumber: Number(pageNumber),
                    },
                };

                return res.status(200).send(response);
            }).catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
    }

    const searchPromise = exclusionsPromise.then((excludeForumIds) => Store.forums.searchForums(
        brandVariation,
        searchArgs[0],
        searchArgs[1],
        {
            ...sharedSearchOptions,
            usersInvitedForumIds: req.body.usersInvitedForumIds,
            excludeForumIds,
            rankByActivity: !isMyGroupsRequest,
        },
    ));
    // const countPromise = Store.forums.countRecords({
    //     filterBy,
    //     query,
    // });
    const countPromise = Promise.resolve();

    return getUserForums(req.headers).then((userGroupsResponse) => {
        const userGroups = userGroupsResponse?.data?.userGroups || [];
        const validGroupIds = userGroups
            .filter((userGroup) => userGroup?.status === GroupRequestStatuses.APPROVED || userGroup?.status === GroupRequestStatuses.PENDING)
            .map((userGroup) => userGroup.groupId);
        const approvedGroupIds = new Set(userGroups
            .filter((userGroup) => userGroup?.status === GroupRequestStatuses.APPROVED)
            .map((userGroup) => userGroup.groupId));

        // Private groups that the user has an open or accepted invite to
        // TODO: It's probably better for the frontend to request this from a separate endpoint
        const userMemberGroupsPromise = Store.forums.searchForums(brandVariation, searchArgs[0], searchArgs[1], {
            ...sharedSearchOptions,
            usersInvitedForumIds: validGroupIds,
        });

        return Promise.all([searchPromise, userMemberGroupsPromise, countPromise]).then(async ([results, userMemberResults, countResult]) => {
            const userMemberGroups = userMemberResults?.filter((group) => !group.isPublic);
            let resultGroups = [...userMemberGroups, ...results];

            if (isMyGroupsRequest) {
                resultGroups = await attachInboxDetails(brandVariation, resultGroups, userId);
            } else {
                // Groups the viewer already belongs to have their own tab; keep them out of the top of
                // Discover. Stable, so each half keeps its ranking. Pending invites stay up top.
                resultGroups = [
                    ...resultGroups.filter((group) => !approvedGroupIds.has(group.id)),
                    ...resultGroups.filter((group) => approvedGroupIds.has(group.id)),
                ];
            }

            const userIdSet = new Set<any>();
            resultGroups.forEach((result) => {
                userIdSet.add(result.authorId);
                if (result.lastMessage?.fromUserId) {
                    userIdSet.add(result.lastMessage.fromUserId);
                }
            });
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
                                ...(result.lastMessage ? {
                                    lastMessage: {
                                        ...result.lastMessage,
                                        fromUserName: usersById[result.lastMessage.fromUserId]?.userName,
                                    },
                                } : {}),
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

/**
 * PUT /forums/:forumId/read — moves the caller's unread watermark for this group to now.
 * Called when the group's chat is opened and when it is left, so messages that arrived while it
 * was open do not count as unread.
 */
const markForumRead: RequestHandler = (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { forumId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: translate(locale, 'errorMessages.accessDenied'), statusCode: 401 });
    }
    if (!UUID_PATTERN.test(String(forumId || ''))) {
        return handleHttpError({
            res, message: translate(locale, 'errorMessages.forums.forumNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    return Store.forums.getForum(brandVariation, forumId)
        .then((forums) => {
            if (!forums?.length) {
                return handleHttpError({
                    res, message: translate(locale, 'errorMessages.forums.forumNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
                });
            }

            return Store.forumReadStates.markRead(forumId, userId)
                .then((lastReadAt) => res.status(200).send({ forumId, lastReadAt }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

/**
 * POST /forums/:forumId/report — a member reports a group (spam, scam, offensive, other).
 * The group leaves the reporter's Discover at once, and everyone's once enough different people
 * have reported it (ForumReportsStore.FORUM_REPORT_HIDE_THRESHOLD). Logged at warn so reports show
 * up where moderation already looks.
 */
const reportForum: RequestHandler = (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { forumId } = req.params;
    const reason = (FORUM_REPORT_REASONS as readonly string[]).includes(req.body?.reason) ? req.body.reason : undefined;

    if (!userId) {
        return handleHttpError({ res, message: translate(locale, 'errorMessages.accessDenied'), statusCode: 401 });
    }
    if (!UUID_PATTERN.test(String(forumId || ''))) {
        return handleHttpError({
            res, message: translate(locale, 'errorMessages.forums.forumNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    return Store.forums.getForum(brandVariation, forumId)
        .then(async (forums) => {
            const forum = forums?.[0];
            if (!forum) {
                return handleHttpError({
                    res, message: translate(locale, 'errorMessages.forums.forumNotFound'), statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
                });
            }
            if (forum.authorId === userId) {
                return handleHttpError({
                    res, message: translate(locale, 'errorMessages.forums.cannotReportOwn'), statusCode: 400, errorCode: ErrorCodes.BAD_REQUEST,
                });
            }

            const isNewReport = await Store.forumReports.create(forumId, userId, reason);
            const reporterCount = await Store.forumReports.countReporters(forumId);

            if (isNewReport) {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['Forums: group reported'],
                    traceArgs: {
                        'forum.id': forumId,
                        'forum.reason': reason || 'unspecified',
                        'forum.reporterCount': reporterCount,
                        'forum.isHiddenFromDiscover': reporterCount >= FORUM_REPORT_HIDE_THRESHOLD,
                        'user.id': userId,
                        source: 'messages-service',
                    },
                });
            }

            return res.status(200).send({ forumId, isReported: true });
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
    const { brandVariation } = getBrandContext(req.headers);
    const { forumId } = req.params;

    const updateParams: any = {
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
        isPublic: isTestAccount(req.headers) ? false : req.body.isPublic,
        city: req.body.city,
        region: req.body.region,
        country: req.body.country,
        localLatitude: req.body.localLatitude,
        localLongitude: req.body.localLongitude,
    };

    if (req.body.media?.length) {
        updateParams.media = JSON.stringify({ featuredImage: req.body.media[0]?.path });
    }

    return Store.forums.updateForum(brandVariation, {
        id: forumId,
        authorId: userId,
    }, updateParams)
        .then(([forum]) => res.status(202).send(forum))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:FORUMS_ROUTES:ERROR' }));
};

const archiveForum = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { brandVariation } = getBrandContext(req.headers);
    const { forumId } = req.params;

    return Store.forums.archiveForum(brandVariation, {
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
    markForumRead,
    reportForum,
};
