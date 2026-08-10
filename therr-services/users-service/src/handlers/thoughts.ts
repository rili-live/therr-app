import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import {
    getBrandContext,
    getSearchQueryArgs,
    getSearchQueryString,
    parseHeaders,
} from 'therr-js-utilities/http';
import {
    ErrorCodes, MetricNames, MetricValueTypes, Notifications,
    UserConnectionTypes,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { RequestHandler } from 'express';
import userMetricsService from '../api/userMetricsService';
import * as globalConfig from '../../../../global-config';
import {
    countReactions,
    countReactionsByThoughtId,
    createReactions,
    findReactionsByUser,
    hasUserReacted,
} from '../api/reactions';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import notifyUserOfUpdate from '../utilities/notifyUserOfUpdate';
import { createOrUpdateAchievement } from './helpers/achievements';

// CREATE
const createThought = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
        platform,
        requestId,
        userDeviceToken,
        userName,
    } = parseHeaders(req.headers);
    const { brandVariation: brand } = getBrandContext(req.headers);

    // REPOST
    // Resolved before the duplicate check because the check keys on it, and before the insert
    // because a repost row pointing at something the author cannot see is not recoverable
    // after the fact.
    let originalThought: any;
    let repostThoughtId: string | undefined;

    if (req.body.repostThoughtId) {
        const [requestedOriginal] = await Store.thoughts.getById(brand, req.body.repostThoughtId, {}, {
            shouldHideMatureContent: true,
        }).then(({ thoughts }) => thoughts);

        if (!requestedOriginal) {
            return handleHttpError({
                res,
                message: translate(locale, 'thoughts.notFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        // Reposting is a public act — it puts the original in front of the reposter's audience.
        // A non-public thought is only ever reposted by its own author (who is choosing to
        // surface their own post), never by a reader who happened to be granted access to it.
        if (!requestedOriginal.isPublic && requestedOriginal.fromUserId !== userId) {
            return handleHttpError({
                res,
                message: translate(locale, 'thoughts.repostRestricted'),
                statusCode: 403,
                errorCode: ErrorCodes.THOUGHT_ACCESS_RESTRICTED,
            });
        }

        // Reposting a repost points at the root, not at the intermediate row. Chains would make
        // the embed recursive (and `attachRepostDetails` only hydrates one level), and every
        // repost in a chain crediting a different author is not what any of them intended.
        if (requestedOriginal.repostThoughtId) {
            const [rootThought] = await Store.thoughts.getById(brand, requestedOriginal.repostThoughtId, {}, {
                shouldHideMatureContent: true,
            }).then(({ thoughts }) => thoughts).catch(() => []);
            // A root that is gone or out of brand leaves the intermediate repost as the best
            // available target rather than failing the request.
            originalThought = rootThought || requestedOriginal;
        } else {
            originalThought = requestedOriginal;
        }

        repostThoughtId = originalThought.id;
    }

    const isDuplicate = await Store.thoughts.get(brand, {
        fromUserId: userId,
        message: req.body.message,
        parentId: req.body.parentId,
        repostThoughtId,
    })
        .then((thoughts) => thoughts?.length);

    if (isDuplicate) {
        return handleHttpError({
            res,
            message: translate(locale, repostThoughtId
                ? 'errorMessages.posts.duplicateRepost'
                : 'errorMessages.posts.duplicatePost'),
            statusCode: 400,
            errorCode: ErrorCodes.DUPLICATE_POST,
        });
    }

    return Store.thoughts.create(brand, {
        ...req.body,
        // A repost is always a top-level post. Letting it also carry a parentId would file it
        // as a reply, where `ThoughtsStore.find` never surfaces it and the reply-side isPublic
        // assumptions do not hold.
        parentId: repostThoughtId ? undefined : req.body.parentId,
        repostThoughtId,
        locale,
        fromUserId: userId,
    })
        .then(([thought]) => {
            logSpan({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Thought Created'],
                traceArgs: {
                    // TODO: Add a sentiment analysis property
                    action: 'create-thought',
                    logCategory: 'user-sentiment',
                    'thought.category': thought.category,
                    'thought.parentId': thought.parentId,
                    'thought.isPublic': thought.isPublic,
                    'thought.isRepost': thought.isRepost,
                    'thought.hashTags': thought.hashTags,
                    'thought.isMatureContent': thought.isMatureContent,
                    'user.locale': locale,
                    'user.id': userId,
                },
            });

            Store.users.getUserById(userId, ['userName']).then((usersResponse) => {
                const user = usersResponse[0] || {};

                if (thought.parentId) {
                    // Reward users for replying to thoughts
                    Store.thoughts.getById(brand, thought.parentId, {}).then(({ thoughts }) => {
                        if (thoughts.length) {
                            const parentThought = thoughts[0];
                            if (parentThought.fromUserId !== userId) {
                                createOrUpdateAchievement({
                                    authorization,
                                    'x-userid': parentThought.fromUserId,
                                    ...req.headers,
                                }, {
                                    achievementClass: 'thinker',
                                    achievementTier: '1_2',
                                    progressCount: 1,
                                }).catch((err) => {
                                    logSpan({
                                        level: 'error',
                                        messageOrigin: 'API_SERVER',
                                        messages: ['Error while creating thinker achievement after creating a thought on parent, tier 1_2'],
                                        traceArgs: {
                                            'error.message': err?.message,
                                        },
                                    });
                                });

                                // Log metric when replying to other users' thoughts
                                userMetricsService.uploadMetric({
                                    name: `${MetricNames.USER_CONTENT_PREF_CAT_PREFIX}${thought.category || 'uncategorized'}` as MetricNames,
                                    value: '5', // Replying to a should is weighted more than viewing or liking
                                    valueType: MetricValueTypes.NUMBER,
                                    userId,
                                }, {
                                    thoughtId: thought.id,
                                    isMatureContent: thought.isMatureContent,
                                    isPublic: thought.isPublic,
                                }, {
                                    authorization,
                                    'x-platform': platform,
                                    'x-brand-variation': brandVariation,
                                    'x-therr-origin-host': whiteLabelOrigin,
                                    'x-localecode': locale,
                                    'x-requestid': requestId,
                                    'x-user-device-token': userDeviceToken,
                                    'x-userid': userId,
                                    'x-username': userName,
                                }, {
                                    contentUserId: thought.fromUserId,
                                }).catch((err) => {
                                    logSpan({
                                        level: 'error',
                                        messageOrigin: 'API_SERVER',
                                        messages: ['failed to upload user metric'],
                                        traceArgs: {
                                            'error.message': err?.message,
                                            'error.response': err?.response?.data,
                                            'user.id': userId,
                                            'thought.id': thought.id,
                                        },
                                    });
                                });
                            }
                            return notifyUserOfUpdate(req.headers, {
                                userId: thoughts[0].fromUserId, // Notify parent thought's author
                                type: Notifications.Types.THOUGHT_REPLY,
                                associationId: thought.parentId,
                                isUnread: true,
                                messageLocaleKey: Notifications.MessageKeys.THOUGHT_REPLY,
                                messageParams: {
                                    thoughtId: thought.parentId,
                                    userName: user.userName,
                                    fromUserName: user.userName,
                                    contentUserId: thoughts[0].fromUserId, // author
                                    postType: 'thoughts',
                                },
                            }, {
                                toUserId: thoughts[0].fromUserId, // Notify parent thought's author
                                fromUser: {
                                    id: userId,
                                    userName: user.userName,
                                    name: user.userName,
                                },
                            }, {
                                shouldCreateDBNotification: true,
                                shouldSendPushNotification: true,
                                shouldSendEmail: true,
                            }).catch((err) => {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['Error while creating total notification for thought reply'],
                                    traceArgs: {
                                        'error.message': err?.message,
                                        'thought.id': thought.parentId,
                                    },
                                });
                            });
                        }

                        return Promise.resolve();
                    }).catch((err) => console.log(err));
                } else {
                    // TODO: Create reactions for (some of) user's connections
                    // requires new endpoint createReactionsForUsers
                    createOrUpdateAchievement({
                        authorization,
                        ...req.headers,
                    }, {
                        achievementClass: 'thinker',
                        achievementTier: '1_1',
                        progressCount: 1,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error while creating thinker achievement after creating a thought, tier 1_1'],
                            traceArgs: {
                                'error.message': err?.message,
                            },
                        });
                    });

                    // Tell the original author their post was reposted. Skipped when reposting
                    // your own thought — that is a self-notification with nothing to say.
                    if (originalThought && originalThought.fromUserId !== userId) {
                        // Reposting is at least as strong an interest signal as replying, so it
                        // carries the same weight. Without this the metric model would score a
                        // reader who reposts a category lower than one who merely views it.
                        userMetricsService.uploadMetric({
                            name: `${MetricNames.USER_CONTENT_PREF_CAT_PREFIX}${originalThought.category || 'uncategorized'}` as MetricNames,
                            value: '5',
                            valueType: MetricValueTypes.NUMBER,
                            userId,
                        }, {
                            thoughtId: originalThought.id,
                            isMatureContent: originalThought.isMatureContent,
                            isPublic: originalThought.isPublic,
                        }, {
                            authorization,
                            'x-platform': platform,
                            'x-brand-variation': brandVariation,
                            'x-therr-origin-host': whiteLabelOrigin,
                            'x-localecode': locale,
                            'x-requestid': requestId,
                            'x-user-device-token': userDeviceToken,
                            'x-userid': userId,
                            'x-username': userName,
                        }, {
                            contentUserId: originalThought.fromUserId,
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['failed to upload user metric'],
                                traceArgs: {
                                    'error.message': err?.message,
                                    'error.response': err?.response?.data,
                                    'user.id': userId,
                                    'thought.id': originalThought.id,
                                },
                            });
                        });

                        notifyUserOfUpdate(req.headers, {
                            userId: originalThought.fromUserId,
                            type: Notifications.Types.THOUGHT_REPOST,
                            // Points at the original, not the repost: tapping the notification
                            // should land the author on their own post.
                            associationId: originalThought.id,
                            isUnread: true,
                            messageLocaleKey: Notifications.MessageKeys.THOUGHT_REPOST,
                            messageParams: {
                                thoughtId: originalThought.id,
                                userName: user.userName,
                                fromUserName: user.userName,
                                contentUserId: originalThought.fromUserId,
                                postType: 'thoughts',
                            },
                        }, {
                            toUserId: originalThought.fromUserId,
                            fromUser: {
                                id: userId,
                                userName: user.userName,
                                name: user.userName,
                            },
                        }, {
                            shouldCreateDBNotification: true,
                            shouldSendPushNotification: true,
                            shouldSendEmail: false,
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Error while creating notification for thought repost'],
                                traceArgs: {
                                    'error.message': err?.message,
                                    'thought.id': originalThought.id,
                                },
                            });
                        });
                    }
                }
            });

            return internalRestRequest({
                headers: req.headers,
            }, { // Create companion reaction for user's own thought
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/thought-reactions/${thought.id}`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    userHasActivated: true,
                },
            }).then(async ({ data: reaction }) => {
                // The same hydration every read path applies, so a freshly created repost comes
                // back with its embed already attached instead of rendering as an empty card
                // until the next feed fetch replaces it.
                const [hydratedThought] = await Store.thoughts.attachRepostDetails(brand, [{ ...thought }])
                    .catch(() => [thought]);

                return res.status(201).send({
                    ...hydratedThought,
                    reaction,
                });
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// READ
const getThoughtDetails = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
        platform,
        requestId,
        userDeviceToken,
        userName,
    } = parseHeaders(req.headers);
    const { brandVariation: brand } = getBrandContext(req.headers);

    const { thoughtId } = req.params;

    const {
        withUser,
        withReplies,
    } = req.body;

    const shouldFetchUser = !!withUser;
    const shouldFetchReplies = !!withReplies;

    return Promise.all([
        Store.thoughts.getById(brand, thoughtId, {}, {
            withUser: shouldFetchUser,
            withReplies: shouldFetchReplies,
            shouldHideMatureContent: true, // TODO: Check the user settings to determine if mature content should be hidden
        }),
        Store.userMetrics.countWhere('thoughtId', thoughtId),
    ])
        .then(async ([{ thoughts, users }, [{ count: viewCount }]]) => {
            if (!thoughts.length) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'thoughts.notFound'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
                });
            }

            const thought = thoughts[0];
            const isOwnThought = userId === thought.fromUserId;
            let userHasAccessPromise = Promise.resolve(true);
            let countReactionsPromise = Promise.resolve({
                count: '0',
            });

            userMetricsService.uploadMetric({
                name: `${MetricNames.USER_CONTENT_PREF_CAT_PREFIX}${thought.category || 'uncategorized'}` as MetricNames,
                value: '1',
                valueType: MetricValueTypes.NUMBER,
                userId,
            }, {
                thoughtId: thought.id,
                isMatureContent: thought.isMatureContent,
                isPublic: thought.isPublic,
            }, {
                authorization,
                'x-platform': platform,
                'x-brand-variation': brandVariation,
                'x-therr-origin-host': whiteLabelOrigin,
                'x-localecode': locale,
                'x-requestid': requestId,
                'x-user-device-token': userDeviceToken,
                'x-userid': userId,
                'x-username': userName,
            }, {
                contentUserId: thought.fromUserId,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['failed to upload user metric'],
                    traceArgs: {
                        'error.message': err?.message,
                        'error.response': err?.response?.data,
                        'user.id': userId,
                        'thought.id': thought.id,
                    },
                });
            });

            // Verify that user has activated thought and has access to view it
            if (!thought.isPublic && !isOwnThought) {
                // Replies are always minted with isPublic=false, so the flag is not a privacy
                // signal on them — their visibility follows the parent thought. Falling back to
                // the parent's activation is what lets a thread be opened from a deep link (or
                // any order other than parent-then-reply) instead of 400ing on a reply the user
                // is plainly allowed to read.
                userHasAccessPromise = hasUserReacted(thoughtId, req.headers)
                    .then((hasActivated) => (hasActivated || !thought.parentId
                        ? hasActivated
                        : hasUserReacted(thought.parentId, req.headers)));
            }

            return userHasAccessPromise.then((isActivated) => {
                if (!isActivated) {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'thoughtReactions.thoughtNotActivated'),
                        statusCode: 400,
                        errorCode: ErrorCodes.THOUGHT_ACCESS_RESTRICTED,
                    });
                }

                let createReactionsPromise = Promise.resolve({});
                countReactionsPromise = countReactions(thoughtId, req.headers);

                const replyIds = (thought.replies || []).map((reply) => reply.id).filter((id) => !!id);
                // Activating this thought too (when it is itself a reply) keeps a reply reachable
                // on its own after it was first opened via the parent's access.
                const idsToActivate = thought.parentId ? [thought.id, ...replyIds] : replyIds;

                // Activate child thoughts otherwise
                if (idsToActivate.length) {
                    createReactionsPromise = createReactions(idsToActivate, req.headers);
                }

                // Replies render their own like control, so they need the same reaction state the
                // root thought gets — the count across all users, plus this user's own reaction.
                const replyCountsPromise = countReactionsByThoughtId(replyIds, req.headers);
                const replyReactionsPromise = findReactionsByUser(replyIds, req.headers);

                return Promise.all([
                    countReactionsPromise,
                    createReactionsPromise,
                    replyCountsPromise,
                    replyReactionsPromise,
                ]).then(([thoughtCounts, , replyLikeCounts, replyReactions]) => {
                    const thoughtResult = {
                        ...thought,
                    };

                    thoughtResult.viewCount = parseInt(viewCount || '0', 10);
                    thoughtResult.likeCount = parseInt(thoughtCounts?.count || '0', 10);
                    thoughtResult.replies = (thought.replies || []).map((reply) => ({
                        ...reply,
                        likeCount: replyLikeCounts[reply.id] || 0,
                        reaction: replyReactions[reply.id],
                    }));

                    if (userId && userId !== thought.fromUserId) {
                        Store.userConnections.incrementUserConnection(userId, thought.fromUserId, 1)
                            .catch((err) => console.log(err));
                        if (thought.interestsKeys?.length) {
                            // In-service call, so it does not go through the coalescing
                            // buffer the maps/reactions services use — one thought view is
                            // one event, and the map shape is just how the store now takes
                            // per-key weights.
                            const increments = thought.interestsKeys
                                .reduce((acc: any, key: string) => ({ ...acc, [key]: 1 }), {});
                            Store.userInterests.incrementUserInterestsByKey(userId, increments)
                                .catch((err) => console.log(err));
                        }
                    }

                    return res.status(200).send({ thought: thoughtResult, users });
                });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

const searchThoughts: RequestHandler = async (req: any, res: any) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { brandVariation: brand } = getBrandContext(req.headers);
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
        searchArgs[0].filterBy = 'fromUserIds';
    } else if (query === 'user' && req.body.targetUserId) {
        fromUserIds = [req.body.targetUserId];
        searchArgs[0].filterBy = 'fromUserIds';
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
        const connectionsResponse: any = await internalRestRequest({
            headers: req.headers,
        }, {
            method: 'get',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections${queryString}`,
            headers: {
                authorization: req.headers.authorization,
                'x-localecode': req.headers['x-localecode'] || 'en-us',
                'x-userid': userId,
                'x-therr-origin-host': whiteLabelOrigin,
            },
        }).catch(() => ({
            data: {
                results: [],
            },
        }));
        fromUserIds = connectionsResponse.data.results
            .map((connection: any) => connection.users.filter((user: any) => user.id !== userId)?.[0]?.id || undefined)
            .filter((id) => !!id); // eslint-disable-line eqeqeq
        searchArgs[0].filterBy = 'fromUserIds';
    }
    const searchPromise = Store.thoughts.search(brand, searchArgs[0], searchArgs[1], fromUserIds, {}, query !== 'me');
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

        return res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// NOTE: This should remain a non-public endpoint
// It gets called by the reactions service when a thought is activated
const findThoughts: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const { brandVariation: brand } = getBrandContext(req.headers);

    const {
        limit,
        order,
        offset,
        thoughtIds,
        withUser,
        withReplies,
        lastContentCreatedAt,
        authorId,
        isDraft,
    } = req.body;

    const isFriendPromise = !authorId
        ? Promise.resolve([])
        : Store.userConnections.getUserConnections({
            requestingUserId: userId,
            acceptingUserId: authorId,
        }, true);

    return isFriendPromise.then((connections) => Store.thoughts.find(brand, thoughtIds, {
        authorId,
        limit: limit || 21,
        order,
        offset,
        before: lastContentCreatedAt,
        isDraft,
    }, {
        withUser: !!withUser,
        withReplies: !!withReplies,
        shouldHideMatureContent: true, // TODO: Check the user settings to determine if mature content should be hidden
        isMe: userId === authorId,
        // `isFriend` drops the `isPublic = true` filter in ThoughtsStore.find, so it has to
        // mean a *live* connection. Keying off requestStatus alone left a broken (unconnected)
        // row reading as a friendship, which handed a former connection continued access to
        // the author's non-public thoughts.
        isFriend: connections?.[0]?.requestStatus === UserConnectionTypes.COMPLETE
            && !connections?.[0]?.isConnectionBroken,
    })
        .then(({ thoughts, isLastPage }) => res.status(200).send({ thoughts, isLastPage })))
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
