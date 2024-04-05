import axios from 'axios';
import { getSearchQueryArgs, getSearchQueryString, parseHeaders } from 'therr-js-utilities/http';
import {
    ErrorCodes, MetricNames, MetricValueTypes, Notifications,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { RequestHandler } from 'express';
import userMetricsService from '../api/userMetricsService';
import * as globalConfig from '../../../../global-config';
import { countReactions, findReactions, hasUserReacted } from '../api/reactions';
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
                        }, {
                            userId: thoughts[0].fromUserId, // Notify parent thought's author
                            type: Notifications.Types.THOUGHT_REPLY,
                            associationId: thought.parentId,
                            isUnread: true,
                            messageLocaleKey: Notifications.MessageKeys.THOUGHT_REPLY,
                            messageParams: {
                                thoughtId: thought.parentId,
                                // TODO: Add fromUserName for notification text
                            },
                        }, {
                            toUserId: thoughts[0].fromUserId, // Notify parent thought's author
                            fromUser: {
                                id: userId,
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

    // TODO: Fetch own reaction or reaction count for own thought ("likeCount")
    return Store.thoughts.getById(thoughtId, {}, {
        withUser: shouldFetchUser,
        withReplies: shouldFetchReplies,
        shouldHideMatureContent: true, // TODO: Check the user settings to determine if mature content should be hidden
    })
        .then(async ({ thoughts, users }) => {
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
            let listReactionsPromise: Promise<any> = Promise.resolve();

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
            // TODO: Verify thought exists
            if (!thought.isPublic && thought?.fromUserId !== userId) {
                userHasAccessPromise = hasUserReacted(thoughtId, {
                    'x-userid': userId,
                });
            }

            if (isOwnThought) {
                listReactionsPromise = findReactions(thoughtId, {
                    'x-userid': userId,
                });
            }

            countReactionsPromise = countReactions(thoughtId, {
                'x-userid': userId,
            });

            return Promise.all([userHasAccessPromise, listReactionsPromise, countReactionsPromise]).then(([isActivated, reactionResponse, thoughtCounts]) => {
                if (!isActivated) {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'thoughtReactions.thoughtNotActivated'),
                        statusCode: 400,
                        errorCode: ErrorCodes.THOUGHT_ACCESS_RESTRICTED,
                    });
                }

                let thoughtResult = {
                    ...thought,
                };

                // Users are only allowed to see their own reactions
                if (isOwnThought) {
                    const reactions = reactionResponse?.data?.reactions;
                    const reactionCounts = (reactions || []).reduce((acc, reaction) => {
                        if (reaction.userHasLiked) {
                            acc.likeCount += 1;
                        }
                        if (reaction.userHasSuperLiked) {
                            acc.superLikeCount += 1;
                        }
                        if (reaction.userHasDisliked) {
                            acc.dislikeCount += 1;
                        }
                        if (reaction.userHasSuperDisliked) {
                            acc.superDislikeCount += 1;
                        }
                        if (reaction.userBookmarkCategory) {
                            acc.bookmarkCount += 1;
                        }

                        return acc;
                    }, {
                        likeCount: 0,
                        superLikeCount: 0,
                        dislikeCount: 0,
                        superDislikeCount: 0,
                        bookmarkCount: 0,
                    });

                    thoughtResult = {
                        ...thoughtResult,
                        ...reactionCounts,
                    };
                }

                thoughtResult.likeCount = parseInt(thoughtCounts?.count || '0', 10);

                return res.status(200).send({ thought: thoughtResult, users });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHTS_ROUTES:ERROR' }));
};

const searchThoughts: RequestHandler = async (req: any, res: any) => {
    const {
        userId,
        whiteLabelOrigin,
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

    return Store.thoughts.find(thoughtIds, {
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
    })
        .then(({ thoughts, isLastPage }) => res.status(200).send({ thoughts, isLastPage }))
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
