import axios from 'axios';
import { getSearchQueryArgs, getSearchQueryString, parseHeaders } from 'therr-js-utilities/http';
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
    createReactions,
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
    } = parseHeaders(req.headers);

    const isDuplicate = await Store.thoughts.get({
        fromUserId: userId,
        message: req.body.message,
        parentId: req.body.parentId,
    })
        .then((thoughts) => thoughts?.length);

    if (isDuplicate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.posts.duplicatePost'),
            statusCode: 400,
            errorCode: ErrorCodes.DUPLICATE_POST,
        });
    }

    return Store.thoughts.create({
        ...req.body,
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
                    Store.thoughts.getById(thought.parentId, {}).then(({ thoughts }) => {
                        if (thoughts.length) {
                            const parentThought = thoughts[0];
                            if (parentThought.fromUserId !== userId) {
                                createOrUpdateAchievement({
                                    authorization,
                                    userId: parentThought.fromUserId,
                                    locale,
                                    whiteLabelOrigin,
                                    brandVariation,
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
                            return notifyUserOfUpdate({
                                authorization,
                                locale,
                                whiteLabelOrigin,
                                brandVariation,
                            }, {
                                userId: thoughts[0].fromUserId, // Notify parent thought's author
                                type: Notifications.Types.THOUGHT_REPLY,
                                associationId: thought.parentId,
                                isUnread: true,
                                messageLocaleKey: Notifications.MessageKeys.THOUGHT_REPLY,
                                messageParams: {
                                    thoughtId: thought.parentId,
                                    fromUserName: user.userName,
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
                        userId,
                        locale,
                        whiteLabelOrigin,
                        brandVariation,
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
                }
            });

            return axios({ // Create companion reaction for user's own thought
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
            }).then(({ data: reaction }) => res.status(201).send({
                ...thought,
                reaction,
            }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// READ
const getThoughtDetails = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { thoughtId } = req.params;

    const {
        withUser,
        withReplies,
    } = req.body;

    const shouldFetchUser = !!withUser;
    const shouldFetchReplies = !!withReplies;

    return Promise.all([
        Store.thoughts.getById(thoughtId, {}, {
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
                userHasAccessPromise = hasUserReacted(thoughtId, {
                    'x-userid': userId,
                });
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
                countReactionsPromise = countReactions(thoughtId, {
                    'x-userid': userId,
                });

                // Activate child thoughts otherwise
                if (thought.replies?.length) {
                    createReactionsPromise = createReactions(thought.replies.map((reply) => reply.id), {
                        'x-userid': userId,
                    });
                }

                return Promise.all([countReactionsPromise, createReactionsPromise]).then(([thoughtCounts]) => {
                    const thoughtResult = {
                        ...thought,
                    };

                    thoughtResult.viewCount = parseInt(viewCount || '0', 10);
                    thoughtResult.likeCount = parseInt(thoughtCounts?.count || '0', 10);

                    if (userId && userId !== thought.fromUserId) {
                        Store.userConnections.incrementUserConnection(userId, thought.fromUserId, 1)
                            .catch((err) => console.log(err));
                        if (thought.interestsKeys?.length) {
                            Store.userInterests.incrementUserInterests(userId, thought.interestsKeys, 1)
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

        return res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

// NOTE: This should remain a non-public endpoint
// It gets called by the reactions service when a thought is activated
const findThoughts: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];

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

    return isFriendPromise.then((connections) => Store.thoughts.find(thoughtIds, {
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
        isFriend: connections?.[0]?.requestStatus === UserConnectionTypes.COMPLETE,
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
