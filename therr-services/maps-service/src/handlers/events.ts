import axios from 'axios';
import * as countryGeo from 'country-reverse-geocoding';
import { getSearchQueryArgs, getSearchQueryString, parseHeaders } from 'therr-js-utilities/http';
import {
    AccessLevels,
    Content,
    CurrencyTransactionMessages,
    ErrorCodes,
    IncentiveRequirementKeys,
    IncentiveRewardKeys,
    Location,
    MetricNames,
    MetricValueTypes,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { distanceTo } from 'geolocation-utils';
import { getReadableDistance } from 'therr-js-utilities/location';
import { RequestHandler } from 'express';
import * as globalConfig from '../../../../global-config';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import {
    checkIsMediaSafeForWork,
    getSignedUrlResponse,
} from './helpers';
import updateAchievements from './helpers/updateAchievements';
import { isTextUnsafe } from '../utilities/contentSafety';
import userMetricsService from '../api/userMetricsService';
import areaMetricsService from '../api/areaMetricsService';
import getUserGroup from '../utilities/getUserGroup';
import { DEFAULT_RADIUS_MEDIUM } from '../store/SpacesStore';

const countryReverseGeo = countryGeo.country_reverse_geocoding();

const rewardEventPosted = ({
    authorization,
    locale,
    whiteLabelOrigin,
}, {
    spaceId,
    userId,
}): Promise<number> => Store.spaces.getById(spaceId)
    .then((spaces) => {
        const space = spaces[0];

        if (userId !== space?.fromUserId && space?.incentives?.length) {
            // 1. Attempt to create a transaction (only if user has not exceeded limits)
            const therrCoinIncentive = space.incentives
                .find((incentive) => (
                    incentive.incentiveKey === IncentiveRequirementKeys.HOST_AN_EVENT
                    && incentive.incentiveRewardKey === IncentiveRewardKeys.THERR_COIN_REWARD
                ));

            if (therrCoinIncentive) {
                // This prevents spamming and claiming a reward for every post
                return Store.spaceIncentiveCoupons.get(userId, therrCoinIncentive.id)
                    .then((existingCoupons) => ({
                        isClaimable: !existingCoupons.length || existingCoupons[0].useCount < therrCoinIncentive.maxUseCount,
                        space,
                        therrCoinIncentive,
                    }));
            }

            return {
                isClaimable: false,
                space,
                therrCoinIncentive,
            };
        }

        return {
            isClaimable: false,
            space,

        };
    }).then(({
        isClaimable,
        space,
        therrCoinIncentive,
    }) => {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['User attempted to claim rewards'],
            traceArgs: {
                'space.incentive': therrCoinIncentive,
                'space.incentiveKey': IncentiveRequirementKeys.HOST_AN_EVENT,
                'space.isIncentiveClaimable': isClaimable,
                'space.incentiveAmount': therrCoinIncentive?.incentiveRewardValue,
                'user.id': userId,
                'space.region': space?.region,
            },
        });

        if (isClaimable && therrCoinIncentive) {
            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/rewards/transfer-coins`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,

                },
                data: {
                    fromUserId: space.fromUserId,
                    toUserId: userId,
                    amount: therrCoinIncentive.incentiveRewardValue,
                    spaceId,
                    spaceName: space?.notificationMsg,
                },
            }).then(({ data }) => {
                if (data.transactionStatus === 'success') {
                    return Store.spaceIncentiveCoupons.upsert({
                        spaceIncentiveId: therrCoinIncentive.id,
                        userId,
                        useCount: 1,
                        region: therrCoinIncentive.region,
                    }).then(() => therrCoinIncentive.incentiveRewardValue);
                }

                // 3. If unsuccessful, return response with error. Frontend will show dialog
                // to user to confirm they want to create the space without the reward
                throw new Error(CurrencyTransactionMessages.INSUFFICIENT_FUNDS);
            });
        }

        return 0;
    })
    .catch((err) => {
        if (err?.message === CurrencyTransactionMessages.INSUFFICIENT_FUNDS
            || err?.response?.data?.message === CurrencyTransactionMessages.INSUFFICIENT_FUNDS) {
            throw new Error(CurrencyTransactionMessages.INSUFFICIENT_FUNDS);
        }

        throw new Error(`An error occurred while attempting to transfer Therr Coins: ${err?.message}`);
    });

// CREATE
const createEvent = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    let therrCoinRewarded = 0;

    const isDuplicate = await Store.events.get({
        fromUserId: userId,
        message: req.body.message,
        notificationMsg: req.body.notificationMsg,
    })
        .then((events) => events?.length);

    if (isDuplicate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.posts.duplicatePost'),
            statusCode: 400,
            errorCode: ErrorCodes.DUPLICATE_POST,
        });
    }

    const {
        latitude,
        longitude,
        userLatitude,
        userLongitude,
    } = req.body;
    const distanceBetween = distanceTo({
        lon: longitude,
        lat: latitude,
    }, {
        lon: userLongitude,
        lat: userLatitude,
    });

    if (distanceBetween > Location.MAX_DISTANCE_TO_EVENT) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.events.toFarFromEvent'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const region = countryReverseGeo.get_country(req.body.latitude, req.body.longitude);

    const rewardsPromise = req.body.spaceId && !req.body.skipReward && !req.body.isDraft
        ? rewardEventPosted({
            authorization,
            locale,
            whiteLabelOrigin,
        }, {
            spaceId: req.body.spaceId,
            userId,
        }).then((coinRewardValue) => {
            therrCoinRewarded = coinRewardValue;
        })
        : Promise.resolve();

    return rewardsPromise.then(async () => {
        // 2. If successful, create the event
        const {
            hashTags,
            media,
            message,
            notificationMsg,
            spaceId,
            groupId,

            addressReadable,
            addressNotificationMsg,
            postalCode,
            addressStreetAddress,
            addressRegion,
            addressLocality,
            websiteUrl,
            phoneNumber,
            openingHours,
            thirdPartyRatings,
        } = req.body;

        const isTextMature = isTextUnsafe([notificationMsg, message, hashTags]);

        const newSpaceRadius = DEFAULT_RADIUS_MEDIUM;
        let existingSpaces = spaceId
            ? await Store.spaces.getById(spaceId)
            : await Store.spaces.getByLocation({
                latitude,
                longitude,
            }, newSpaceRadius);
        if (spaceId && !existingSpaces.length) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.posts.spaceNotFound'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        if (!existingSpaces.length) {
            existingSpaces = await Store.spaces.createSpace({
                addressReadable,
                postalCode,
                addressStreetAddress,
                addressRegion,
                addressLocality,
                websiteUrl,
                phoneNumber,
                openingHours,
                thirdPartyRatings,

                fromUserId: userId,
                locale,
                latitude,
                longitude,
                message: addressReadable,
                notificationMsg: addressNotificationMsg,
                isPublic: req.body.isPublic,
                radius: newSpaceRadius,
            });
        }

        return Store.events.createEvent({
            ...req.body,
            spaceId: existingSpaces[0].id,
            locale,
            fromUserId: userId,
        })
            .then(([event]) => axios({ // Create companion reaction for user's own event
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/event-reactions/${event.id}`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    userHasActivated: true,
                },
            }).then(({ data: reaction }) => {
                // Create reaction for first n group members
                const MEMBERS_LIMIT = 200;
                axios({ // Create companion reaction for user's own event
                    method: 'get',
                    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/${groupId}?limit=${MEMBERS_LIMIT}&returning=simple`,
                    headers: {
                        authorization,
                        'x-localecode': locale,
                        'x-userid': userId,
                        'x-therr-origin-host': whiteLabelOrigin,
                    },
                }).then((response) => axios({ // Create companion reaction for user's own event
                    method: 'post',
                    url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/event-reactions/create-update/multiple-users`,
                    headers: {
                        authorization,
                        'x-localecode': locale,
                        'x-userid': userId,
                        'x-therr-origin-host': whiteLabelOrigin,
                    },
                    data: {
                        eventId: event.id,
                        userIds: response.data?.userGroups?.map((g) => g.userId),
                    },
                }).then((reactionsResponse) => {
                    logSpan({
                        level: 'info',
                        messageOrigin: 'API_SERVER',
                        messages: ['Group Member Event Reactions Created'],
                        traceArgs: {
                            action: 'create-event',
                            logCategory: 'user-sentiment',
                            createdCount: reactionsResponse?.data?.created?.length,
                            updatedCount: reactionsResponse?.data?.updated?.length,
                        },
                    });
                })).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error while creating group member event reactions'],
                        traceArgs: {
                            // TODO: Add a sentiment analysis property
                            action: 'create-event-reactions',
                            logCategory: 'user-sentiment',
                            'event.groupId': event.groupId,
                            'event.spaceId': event.spaceId,
                            'event.region': event.region,
                            'user.id': userId,
                        },
                    });
                });
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Event Created'],
                    traceArgs: {
                        // TODO: Add a sentiment analysis property
                        action: 'create-event',
                        logCategory: 'user-sentiment',
                        'event.category': event.category,
                        'event.radius': event.radius,
                        'event.groupId': event.groupId,
                        'event.spaceId': event.spaceId,
                        'event.isPublic': event.isPublic,
                        'event.isDraft': event.isDraft,
                        'event.region': event.region,
                        'event.hashTags': event.hashTags,
                        'event.hasMedia': media?.length > 0,
                        'event.isMatureContent': event.isMatureContent,
                        'user.id': userId,
                        'user.locale': locale,
                    },
                });
                if (spaceId) {
                    areaMetricsService.uploadMetric({
                        name: MetricNames.SPACE_EVENT_CREATED,
                        value: '1',
                        valueType: MetricValueTypes.NUMBER,
                        userId: userId || undefined,
                    }, {}, {
                        latitude: event.latitude,
                        longitude: event.longitude,
                        spaceId,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['failed to upload space event metric'],
                            traceArgs: {
                                'error.message': err?.message,
                                'error.response': err?.response?.data,
                                'user.id': userId,
                                'space.id': spaceId,
                            },
                        });
                    });
                }
                // TODO: This technically leaves room for a gap of time where users may find
                // explicit content before it's flag has been updated. We should solve this by
                // marking the content pending before making it available to search.
                // This check is redundant and unnecessary if the text already marked the content as "mature"
                // Async - fire and forget to prevent slow request
                if (!isTextMature) {
                    checkIsMediaSafeForWork(media).then((isSafeForWork) => {
                        if (!isSafeForWork) {
                            const eventArgs = {
                                ...event,
                                isMatureContent: true,
                                isPublic: false, // NOTE: For now make this content private to reduce public, mature content
                            };
                            return Store.events.updateEvent(event.id, eventArgs).catch((err) => {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['failed to update event after sightengine check'],
                                    traceArgs: {
                                        'error.message': err?.message,
                                        'error.response': err?.response?.data,
                                        'event.region': region,
                                    },
                                });
                            });
                        }
                    });
                }

                updateAchievements({
                    authorization,
                    locale,
                    userId,
                    whiteLabelOrigin,
                }, req.body);

                return res.status(201).send({
                    ...event,
                    reaction,
                    therrCoinRewarded,
                });
            }));
    }).catch((err) => {
        if (err?.message === CurrencyTransactionMessages.INSUFFICIENT_FUNDS) {
            return handleHttpError({
                res,
                message: 'Space owner does not have enough Therr Coins to reward you.',
                statusCode: 400,
                errorCode: ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS,
            });
        }

        return handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' });
    });
};

// UPDATE
const updateEvent = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];
    const whiteLabelOrigin = req.headers['x-therr-origin-host'] || '';
    const { eventId } = req.params;

    // Ensure user can only update own events
    return Store.events.findEvents([eventId], { fromUserId: userId }).then(({ events }) => {
        if (!events.length) {
            return handleHttpError({
                res,
                message: `No event found with id, ${eventId}.`,
                statusCode: 404,
            });
        }

        const {
            isDraft,
            spaceId,
            groupId,
        } = req.body;

        // TODO: Ensure group exists

        const [event] = events;
        let therrCoinRewarded = 0;
        let rewardsPromise: Promise<number> = Promise.resolve(therrCoinRewarded);

        if (event.isDraft && isDraft === false) {
            if (spaceId) {
                areaMetricsService.uploadMetric({
                    name: MetricNames.SPACE_EVENT_CREATED,
                    value: '1',
                    valueType: MetricValueTypes.NUMBER,
                    userId: userId || undefined,
                }, {}, {
                    latitude: event.latitude,
                    longitude: event.longitude,
                    spaceId,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['failed to upload space event metric'],
                        traceArgs: {
                            'error.message': err?.message,
                            'error.response': err?.response?.data,
                            'user.id': userId,
                            'space.id': spaceId,
                        },
                    });
                });

                if (!req.body.skipReward) {
                    rewardsPromise = rewardEventPosted({
                        authorization: req.headers.authorization,
                        locale,
                        whiteLabelOrigin,
                    }, {
                        spaceId: req.body.spaceId,
                        userId,
                    }).then((coinRewardValue) => {
                        therrCoinRewarded = coinRewardValue;
                        return therrCoinRewarded;
                    });
                }
            }
        }

        return rewardsPromise.then(() => Store.events.updateEvent(eventId, {
            ...event,
            ...req.body,
            locale,
            fromUserId: userId,
        })
            .then(([response]) => res.status(201).send({
                ...response,
                therrCoinRewarded,
            })))
            .catch((err) => {
                if (err?.message === CurrencyTransactionMessages.INSUFFICIENT_FUNDS) {
                    return handleHttpError({
                        res,
                        message: 'Space owner does not have enough Therr Coins to reward you.',
                        statusCode: 400,
                        errorCode: ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS,
                    });
                }
                return handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' });
            });
    });
};

// READ
const getEventDetails = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const userAccessLevels = req.headers['x-user-access-levels'];
    const whiteLabelOrigin = req.headers['x-therr-origin-host'] || '';
    const accessLevels = userAccessLevels ? JSON.parse(userAccessLevels) : [];

    const { eventId } = req.params;

    const {
        withMedia,
        withUser,
        withRatings,
    } = req.body;

    const shouldFetchMedia = !!withMedia;
    const shouldFetchUser = !!withUser;
    const shouldFetchRating = !!withRatings;

    // TODO: Fetch own reaction or reaction count for own event
    return Store.events.findEvents([eventId], {
        limit: 1,
    }, {
        withMedia: shouldFetchMedia,
        withUser: shouldFetchUser,
        withRatings: shouldFetchRating,
    })
        .then(({ events, media, users }) => {
            const event = events[0];
            let userHasAccessPromise = () => Promise.resolve(true);
            const isOwnEvent = userId === event?.fromUserId;

            if (!event) {
                return handleHttpError({
                    res,
                    message: 'Event not found',
                    statusCode: 404,
                });
            }

            if (!isOwnEvent) {
                userHasAccessPromise = () => {
                    if (event.isPublic) {
                        return Promise.resolve(true);
                    }

                    // Private events require a reactions/activation
                    if (userId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
                        // Check if user is a member of the group hosting this event
                        return getUserGroup(event.groupId, {
                            'x-userid': userId || undefined,
                        });
                    }

                    return Promise.resolve(false);
                };

                if (userId) {
                    userMetricsService.uploadMetric({
                        name: `${MetricNames.USER_CONTENT_PREF_CAT_PREFIX}${event.category || 'uncategorized'}` as MetricNames,
                        value: '1',
                        valueType: MetricValueTypes.NUMBER,
                        userId,
                    }, {
                        eventId: event.id,
                        isMatureContent: event.isMatureContent,
                        isPublic: event.isPublic,
                    }, {
                        contentUserId: event.fromUserId,
                        authorization: req.headers.authorization,
                        userId,
                        locale,
                        originDomain: whiteLabelOrigin,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['failed to upload user metric'],
                            traceArgs: {
                                'error.message': err?.message,
                                'error.response': err?.response?.data,
                                'user.id': userId,
                                'event.id': event.id,
                            },
                        });
                    });
                }
            }

            // Verify that user has activated event and has access to view it
            return userHasAccessPromise().then((isActivated) => {
                if (!isActivated) {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'eventReactions.eventNotActivated'),
                        statusCode: 400,
                        errorCode: ErrorCodes.EVENT_ACCESS_RESTRICTED,
                    });
                }

                if (event.spaceId) {
                    return Store.spaces.getByIdSimple(event.spaceId).then(([space]) => {
                        if (space) {
                            // Response including space details for navigation
                            event.space = space;
                            return res.status(200).send({
                                event,
                                media,
                                users,
                                space,
                            });
                        }
                    });
                }

                return res.status(200).send({ event, media, users });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

// TODO: This should only return events from public groups
const searchEvents: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const whiteLabelOrigin = req.headers['x-therr-origin-host'] || '';

    const {
        // filterBy,
        query,
        itemsPerPage,
        // longitude,
        // latitude,
        pageNumber,
    } = req.query;
    const {
        distanceOverride,
        userLatitude,
        userLongitude,
    } = req.body;

    const integerColumns = ['maxViews', 'longitude', 'latitude'];
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
        }).catch((err) => {
            console.log(err);
            return {
                data: {
                    results: [],
                },
            };
        });
        fromUserIds = connectionsResponse.data.results
            .map((connection: any) => connection.users.filter((user: any) => user.id != userId)[0].id); // eslint-disable-line eqeqeq
    }
    const searchPromise = Store.events.searchEvents(searchArgs[0], searchArgs[1], fromUserIds, { distanceOverride }, query !== 'me');
    // const countPromise = Store.events.countRecords({
    //     filterBy,
    //     query,
    //     longitude,
    //     latitude,
    // }, fromUserIds);
    const countPromise = Promise.resolve();

    // TODO: Get associated userGroups for user and return limited details if event is not public
    return Promise.all([searchPromise, countPromise]).then(([results]) => {
        const resultsWithDistance = results.map((event) => {
            const alteredEvent = event;
            if (userLatitude && userLongitude) {
                const distance = distanceTo({
                    lon: event.longitude,
                    lat: event.latitude,
                }, {
                    lon: userLongitude,
                    lat: userLatitude,
                }) / 1069.344; // convert meters to miles
                alteredEvent.distance = getReadableDistance(distance);
            }

            return alteredEvent;
        });
        const response = {
            results: resultsWithDistance,
            pagination: {
                // totalItems: Number(countResult[0].count),
                totalItems: Number(100), // arbitraty number because count is slow and not needed
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

const searchMyEvents: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        query,
        itemsPerPage,
        pageNumber,
        withMedia,
    } = req.query;
    const {
        distanceOverride,
    } = req.body;

    const integerColumns = ['maxViews', 'longitude', 'latitude'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const requirements: any = {
        fromUserId: userId,
    };
    if (query.includes('drafts-only')) {
        requirements.isDraft = true;
    }
    if (query.includes('public-only')) {
        requirements.isPublic = true;
    }
    const searchPromise = Store.events.searchMyEvents(
        userId,
        requirements,
        searchArgs[0],
        searchArgs[1],
        {
            distanceOverride,
            withMedia,
        },
    );
    const countPromise = Promise.resolve();

    return Promise.all([searchPromise, countPromise]).then(([result]) => {
        const response = {
            results: result.events,
            media: result.media,
            pagination: {
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

const searchGroupEvents: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        withUser,
        groupIds,
    } = req.body;
    const {
        query,
        itemsPerPage,
        pageNumber,
        withMedia,
    } = req.query;

    const searchPromise = Store.events.findGroupEvents(groupIds || [], {
        withUser,
        withMedia,
    });

    return Promise.all([searchPromise]).then(([result]) => {
        const response = {
            results: result.events,
            media: result.media,
            pagination: {
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

const searchSpaceEvents: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        spaceIds,
    } = req.body;
    const {
        query,
        itemsPerPage,
        pageNumber,
        withMedia,
    } = req.query;

    const searchPromise = Store.events.findSpaceEvents(spaceIds || []);

    return Promise.all([searchPromise]).then(([events]) => {
        const response = {
            results: events,
            pagination: {
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

// NOTE: This should remain a non-public endpoint
const findEvents: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];

    const {
        limit,
        order,
        eventIds,
        withMedia,
        withUser,
        lastContentCreatedAt,
        authorId,
        isDraft,
    } = req.body;

    return Store.events.findEvents(eventIds, {
        authorId,
        limit: limit || 21,
        order,
        before: lastContentCreatedAt,
        isDraft,
    }, {
        withMedia: !!withMedia,
        withUser: !!withUser,
        shouldHideMatureContent: true, // TODO: Check the user settings to determine if mature content should be hidden
    })
        .then(({ events, media }) => res.status(200).send({ events, media }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

// TODO: Use Env variables
const getSignedUrlPrivateBucket = (req, res) => getSignedUrlResponse(req, res, process.env.BUCKET_PRIVATE_USER_DATA);

const getSignedUrlPublicBucket = (req, res) => getSignedUrlResponse(req, res, process.env.BUCKET_PUBLIC_USER_DATA);

// DELETE
const deleteEvents = (req, res) => {
    const userId = req.headers['x-userid'];
    // TODO: RSERV-52 | Consider archiving only, and delete/archive associated reactions from reactions-service

    return Store.events.deleteEvents({
        ...req.body,
        fromUserId: userId,
    })
        .then(([events]) => res.status(202).send(events))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTS_ROUTES:ERROR' }));
};

export {
    createEvent,
    updateEvent,
    getEventDetails,
    // searchEvents,
    searchGroupEvents,
    searchSpaceEvents,
    searchEvents,
    searchMyEvents,
    findEvents,
    getSignedUrlPrivateBucket,
    getSignedUrlPublicBucket,
    deleteEvents,
};
