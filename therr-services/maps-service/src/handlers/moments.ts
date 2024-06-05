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
    MetricNames,
    MetricValueTypes,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { getReadableDistance } from 'therr-js-utilities/location';
import { distanceTo } from 'geolocation-utils';
import { RequestHandler } from 'express';
import * as globalConfig from '../../../../global-config';
import getReactions, { countReactions } from '../utilities/getReactions';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import {
    checkIsMediaSafeForWork,
    getSignedUrlResponse,
    getSupportedIntegrations,
    guessCategoryFromText,
    streamUploadFile,
} from './helpers';
import updateAchievements from './helpers/updateAchievements';
import { isTextUnsafe } from '../utilities/contentSafety';
import userMetricsService from '../api/userMetricsService';
import areaMetricsService from '../api/areaMetricsService';
import incrementInterestEngagement from '../utilities/incrementInterestEngagement';

const MAX_INTERGRATIONS_PER_USER = 50;
const countryReverseGeo = countryGeo.country_reverse_geocoding();

const rewardMomentPosted = ({
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
                    incentive.incentiveKey === IncentiveRequirementKeys.SHARE_A_MOMENT
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
                'space.incentiveKey': IncentiveRequirementKeys.SHARE_A_MOMENT,
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
const createMoment = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    let therrCoinRewarded = 0;

    const isDuplicate = await Store.moments.get({
        fromUserId: userId,
        message: req.body.message,
        notificationMsg: req.body.notificationMsg,
    })
        .then((moments) => moments?.length);

    if (isDuplicate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.posts.duplicatePost'),
            statusCode: 400,
            errorCode: ErrorCodes.DUPLICATE_POST,
        });
    }

    const region = countryReverseGeo.get_country(req.body.latitude, req.body.longitude);

    const rewardsPromise = req.body.spaceId && !req.body.skipReward && !req.body.isDraft
        ? rewardMomentPosted({
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

    return rewardsPromise.then(() => {
        // 2. If successful, create the moment
        const {
            hashTags,
            media,
            message,
            notificationMsg,
            spaceId,
        } = req.body;

        const isTextMature = isTextUnsafe([notificationMsg, message, hashTags]);

        return Store.moments.createMoment({
            ...req.body,
            locale,
            fromUserId: userId,
        })
            .then(([moment]) => axios({ // Create companion reaction for user's own moment
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/${moment.id}`,
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
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Moment Created'],
                    traceArgs: {
                        // TODO: Add a sentiment analysis property
                        action: 'create-moment',
                        logCategory: 'user-sentiment',
                        'moment.category': moment.category,
                        'moment.radius': moment.radius,
                        'moment.spaceId': moment.spaceId,
                        'moment.isPublic': moment.isPublic,
                        'moment.isDraft': moment.isDraft,
                        'moment.region': moment.region,
                        'moment.hashTags': moment.hashTags,
                        'moment.hasMedia': media?.length > 0,
                        'moment.isMatureContent': moment.isMatureContent,
                        'user.id': userId,
                        'user.locale': locale,
                    },
                });
                if (spaceId) {
                    areaMetricsService.uploadMetric({
                        name: MetricNames.SPACE_MOMENT_CREATED,
                        value: '1',
                        valueType: MetricValueTypes.NUMBER,
                        userId: userId || undefined,
                    }, {}, {
                        latitude: moment.latitude,
                        longitude: moment.longitude,
                        spaceId,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['failed to upload space moment metric'],
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
                            const momentArgs = {
                                ...moment,
                                isMatureContent: true,
                                isPublic: false, // NOTE: For now make this content private to reduce public, mature content
                            };
                            return Store.moments.updateMoment(moment.id, momentArgs).catch((err) => {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['failed to update moment after sightengine check'],
                                    traceArgs: {
                                        'error.message': err?.message,
                                        'error.response': err?.response?.data,
                                        'moment.region': region,
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
                    ...moment,
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

        return handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' });
    });
};

const createIntegratedMomentBase = ({
    authorization,
    locale,
    platform,
    requestId,
    userId,
    media,
    whiteLabelOrigin,
}, res) => Store.externalMediaIntegrations.get({
    fromUserId: userId,
    platform,
})
    .then((integrations) => {
        if (integrations.length > MAX_INTERGRATIONS_PER_USER) {
            return handleHttpError({
                res,
                message: `Each user is limited to ${MAX_INTERGRATIONS_PER_USER} external media integrations per platform`,
                statusCode: 400,
            });
        }

        if (integrations.some((integration) => integration.externalId === media.id)) {
            return handleHttpError({
                res,
                message: 'This is a duplicate integration',
                statusCode: 400,
            });
        }

        const fileExtension = 'jpeg';
        const storageFilename = `content/${((media.caption || 'no_caption')
            .substring(0, 20))
            .replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
        const mediaFileUrl = media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url;
        // TODO: Abstract and add nudity filter sightengine.com
        const maybeFileUploadPromise = mediaFileUrl.length
            ? streamUploadFile(mediaFileUrl, storageFilename, {
                requestId,
                userId,
            })
            : Promise.resolve('');

        let momentArgs: any = {};

        return maybeFileUploadPromise
            .then((mediaUrl: string | void) => {
                let hashTags = (media.caption?.match(/#[a-z]+/gi) || []);
                hashTags = hashTags.map((tag) => tag.replace('#', '')).toString();
                momentArgs = {
                    areaType: 'moments',
                    category: guessCategoryFromText(media.caption),
                    createdAt: media.timestamp,
                    fromUserId: userId,
                    locale,
                    isPublic: true,
                    media: [],
                    message: media.caption,
                    hashTags,
                    latitude: 37.2585862, // default since IG does not allow geotag
                    // this will require manual update after creation
                    longitude: -104.6498689, // default since IG does not allow geotag
                    // this will require manual update after creation
                    radius: 200,
                };

                if (mediaUrl) {
                    momentArgs.media[0] = {
                        path: mediaUrl,
                        type: Content.mediaTypes.USER_IMAGE_PUBLIC,
                    };
                }

                return Store.moments.createMoment({
                    ...momentArgs,
                    locale,
                    fromUserId: userId,
                });
            })
            .then(([moment]) => {
                // TODO: This technically leaves room for a gap of time where users may fin
                // explicit content before it's flag has been updated. We should solve this by
                // marking the content pending before making it available to search
                // Async - fire and forget to prevent slow request
                checkIsMediaSafeForWork(media).then((isSafeForWork) => {
                    momentArgs.isMatureContent = !isSafeForWork;
                    // NOTE: For now make this content private to reduce public, mature content
                    if (!isSafeForWork) {
                        momentArgs.isPublic = false;
                    }
                    if (!isSafeForWork) {
                        Store.moments.updateMoment(moment.id, momentArgs).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['failed to update moment after sightengine check'],
                                traceArgs: {
                                    'error.message': err?.message,
                                    'error.response': err?.response?.data,
                                },
                            });
                        });
                    }
                });

                return Promise.all([
                    Promise.resolve(moment),
                    axios({ // Create companion reaction for user's own moment
                        method: 'post',
                        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/${moment.id}`,
                        headers: {
                            authorization,
                            'x-localecode': locale,
                            'x-userid': userId,
                            'x-therr-origin-host': whiteLabelOrigin,
                        },
                        data: {
                            userHasActivated: true,
                        },
                    }),
                    Store.externalMediaIntegrations.create({
                        fromUserId: userId,
                        momentId: moment.id,
                        externalId: media.id,
                        platform: 'instagram',
                        permalink: media.permalink,
                    }),
                ]);
            })
            .then(([moment, { data: reaction }, externalIntegration]) => res.status(201).send({
                ...moment,
                reaction,
                externalIntegration,
            }));
    });

const createIntegratedMoment = (req, res) => {
    const {
        authorization,
        locale,
        requestId,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const {
        accessToken,
        mediaId,
        platform,
    } = req.body;

    const externalIntegrationEndpoint = getSupportedIntegrations(platform, {
        accessToken,
        mediaId,
    });

    if (!externalIntegrationEndpoint.length) {
        return handleHttpError({
            res,
            message: `No supported integration for provided request body, ${JSON.stringify({
                accessToken,
                mediaId,
                platform,
            })}.`,
            statusCode: 404,
        });
    }

    return axios({
        method: 'get',
        // eslint-disable-next-line max-len
        url: externalIntegrationEndpoint,
    })
        .then((response) => createIntegratedMomentBase({
            authorization,
            locale,
            media: response?.data,
            platform,
            requestId,
            userId,
            whiteLabelOrigin,
        }, res))
        .catch((err) => {
            if (err?.message?.includes('duplicate key value violates unique constraint')) {
                return handleHttpError({
                    err,
                    res,
                    message: `Integration with platformId, ${mediaId}, already exists`,
                    statusCode: 400,
                });
            }
            handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' });
        });
};

// TODO: Delete this endpoint after it has served its purpose
const dynamicCreateIntegratedMoment = (req, res) => {
    const authorization = req.headers.authorization;
    const requestId = req.headers['x-requestid'];
    const whiteLabelOrigin = req.headers['x-therr-origin-host'] || '';
    const locale = req.headers['x-localecode'] || 'en-us';

    const {
        media,
        platform,
        userId,
    } = req.body;

    return createIntegratedMomentBase({
        authorization,
        locale,
        media,
        platform,
        requestId,
        userId,
        whiteLabelOrigin,
    }, res)
        .catch((err) => {
            if (err?.message?.includes('duplicate key value violates unique constraint')) {
                return handleHttpError({
                    err,
                    res,
                    message: `Integration with platformId, ${media?.id}, already exists`,
                    statusCode: 400,
                });
            }
            handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' });
        });
};

// UPDATE
const updateMoment = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];
    const whiteLabelOrigin = req.headers['x-therr-origin-host'] || '';
    const { momentId } = req.params;

    // Ensure user can only update own moments
    return Store.moments.findMoments([momentId], { fromUserId: userId }).then(({ moments }) => {
        if (!moments.length) {
            return handleHttpError({
                res,
                message: `No moment found with id, ${momentId}.`,
                statusCode: 404,
            });
        }

        const {
            isDraft,
            spaceId,
        } = req.body;

        const [moment] = moments;
        let therrCoinRewarded = 0;
        let rewardsPromise: Promise<number> = Promise.resolve(therrCoinRewarded);

        if (moment.isDraft && isDraft === false) {
            if (spaceId) {
                areaMetricsService.uploadMetric({
                    name: MetricNames.SPACE_MOMENT_CREATED,
                    value: '1',
                    valueType: MetricValueTypes.NUMBER,
                    userId: userId || undefined,
                }, {}, {
                    latitude: moment.latitude,
                    longitude: moment.longitude,
                    spaceId,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['failed to upload space moment metric'],
                        traceArgs: {
                            'error.message': err?.message,
                            'error.response': err?.response?.data,
                            'user.id': userId,
                            'space.id': spaceId,
                        },
                    });
                });

                if (!req.body.skipReward) {
                    rewardsPromise = rewardMomentPosted({
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

        return rewardsPromise.then(() => Store.moments.updateMoment(momentId, {
            ...moment,
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
                return handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' });
            });
    });
};

// READ
const getMomentDetails = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        userAccessLevels,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const { momentId } = req.params;

    const {
        withMedia,
        withUser,
    } = req.body;

    const shouldFetchMedia = !!withMedia;
    const shouldFetchUser = !!withUser;

    // TODO: Fetch own reaction or reaction count for own moment
    return Store.moments.findMoments([momentId], {
        limit: 1,
    }, {
        withMedia: shouldFetchMedia,
        withUser: shouldFetchUser,
    })
        .then(({ moments, media, users }) => {
            const moment = moments[0];
            let userHasAccessPromise = () => Promise.resolve(true);
            const isOwnMoment = userId === moment?.fromUserId;

            if (!moment) {
                return handleHttpError({
                    res,
                    message: 'Moment not found',
                    statusCode: 404,
                });
            }

            if (!isOwnMoment) {
                userHasAccessPromise = () => {
                    if (moment.isPublic) {
                        return Promise.resolve(true);
                    }

                    // Private moments require a reactions/activation
                    if (userId && !userAccessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
                        return getReactions('moment', momentId, {
                            'x-userid': userId || undefined,
                        });
                    }

                    return Promise.resolve(false);
                };

                if (userId) {
                    userMetricsService.uploadMetric({
                        name: `${MetricNames.USER_CONTENT_PREF_CAT_PREFIX}${moment.category || 'uncategorized'}` as MetricNames,
                        value: '1',
                        valueType: MetricValueTypes.NUMBER,
                        userId,
                    }, {
                        momentId: moment.id,
                        isMatureContent: moment.isMatureContent,
                        isPublic: moment.isPublic,
                    }, {
                        contentUserId: moment.fromUserId,
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
                                'moment.id': moment.id,
                            },
                        });
                    });
                }
            }

            // Verify that user has activated moment and has access to view it
            return userHasAccessPromise().then((isActivated) => {
                if (!isActivated) {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'momentReactions.momentNotActivated'),
                        statusCode: 400,
                        errorCode: ErrorCodes.MOMENT_ACCESS_RESTRICTED,
                    });
                }

                const promises = [
                    countReactions('moment', momentId, {
                        'x-userid': userId || undefined,
                    }),
                ];

                if (moment.spaceId) {
                    promises.push(Store.spaces.getByIdSimple(moment.spaceId).then(([space]) => space));
                }

                return Promise.all(promises).then(([momentCount, space]) => {
                    if (space) {
                        // Response including space details for navigation
                        moment.space = space;
                    }

                    if (userId !== moment.fromUserId) {
                        axios({
                            method: 'post',
                            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections/increment`,
                            headers: {
                                authorization: req.headers.authorization,
                                'x-localecode': req.headers['x-localecode'] || 'en-us',
                                'x-userid': userId,
                                'x-therr-origin-host': whiteLabelOrigin,
                            },
                            data: {
                                acceptingUserId: moment.fromUserId,
                                incrBy: 2,
                            },
                        }).catch((err) => {
                            console.log(err);
                        });

                        if (userId !== moment.fromUserId) {
                            incrementInterestEngagement(moment.interestsKeys, 2, {
                                authorization,
                                locale,
                                userId,
                                whiteLabelOrigin,
                            });
                        }
                    }

                    moment.likeCount = parseInt(momentCount?.count || 0, 10);
                    return res.status(200).send({
                        moment,
                        media,
                        users,
                        space,
                    });
                });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

// NOTE: This should remain a non-public endpoint
const getIntegratedMoments: RequestHandler = async (req: any, res: any) => {
    const { userId } = req.params;

    return Store.externalMediaIntegrations.get({
        fromUserId: userId,
    })
        .then((integrations) => {
            const integrationsMap: any = {};
            const momentIds = integrations.map((integration) => {
                integrationsMap[integration.momentId] = integration;
                return integration.momentId;
            });
            return Store.moments.findMoments(momentIds, {
                limit: MAX_INTERGRATIONS_PER_USER,
            }, {
                withMedia: true,
            }).then(({ moments, media }) => {
                const externalIntegrations = moments.map((moment) => ({
                    ...integrationsMap[moment.id],
                    moment,
                })).sort((a, b) => a.priority - b.priority);
                return res.status(200).send({ externalIntegrations, moments, media });
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

const searchMoments: RequestHandler = async (req: any, res: any) => {
    const {
        authorization,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const isRequestAuthorized = !!authorization;

    const {
        // filterBy,
        query,
        itemsPerPage,
        // longitude,
        // latitude,
        pageNumber,
        withUser,
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
        const connectionsResponse: any = !userId
            ? {}
            : await axios({
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
                return {};
            });
        const connections = connectionsResponse?.data?.results || [];
        fromUserIds = connections
            .map((connection: any) => connection.users.filter((user: any) => user.id !== userId)?.[0]?.id || undefined)
            .filter((id) => !!id); // eslint-disable-line eqeqeq
    }
    const searchPromise = Store.moments.searchMoments(
        searchArgs[0],
        searchArgs[1],
        fromUserIds,
        { distanceOverride, withUser, isRequestAuthorized },
        query !== 'me',
    );
    // const countPromise = Store.moments.countRecords({
    //     filterBy,
    //     query,
    //     longitude,
    //     latitude,
    // }, fromUserIds);
    const countPromise = Promise.resolve();

    // TODO: Get associated reactions for user and return limited details if moment is not yet activated
    return Promise.all([searchPromise, countPromise]).then(([results]) => {
        const resultsWithDistance = results.map((moment) => {
            const alteredMoment = moment;
            if (userLatitude && userLongitude) {
                const distance = distanceTo({
                    lon: moment.longitude,
                    lat: moment.latitude,
                }, {
                    lon: userLongitude,
                    lat: userLatitude,
                }) / 1069.344; // convert meters to miles
                alteredMoment.distance = getReadableDistance(distance);
            }

            return alteredMoment;
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

const searchMyMoments: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        query,
        itemsPerPage,
        pageNumber,
        withMedia,
        withUser,
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
    const searchPromise = Store.moments.searchMyMoments(
        userId,
        requirements,
        searchArgs[0],
        searchArgs[1],
        {
            distanceOverride,
            withMedia,
            withUser,
        },
    );
    const countPromise = Promise.resolve();

    return Promise.all([searchPromise, countPromise]).then(([result]) => {
        const response = {
            results: result.moments,
            media: result.media,
            pagination: {
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

// TODO: Order by most relevant post
const searchSpaceMoments: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        spaceIds,
        withUser,
    } = req.body;
    const {
        query,
        itemsPerPage,
        pageNumber,
        withMedia,
    } = req.query;

    const searchPromise = Store.moments.findSpaceMoments(spaceIds || [], {
        withMedia,
        withUser,
    }, itemsPerPage || 100);

    return Promise.all([searchPromise]).then(([moments]) => {
        const response = {
            results: moments,
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
const findMoments: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];

    const {
        limit,
        order,
        momentIds,
        withMedia,
        withUser,
        lastContentCreatedAt,
        authorId,
        isDraft,
    } = req.body;

    return Store.moments.findMoments(momentIds, {
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
        .then(({ moments, media }) => res.status(200).send({ moments, media }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

// TODO: Use Env variables
const getSignedUrlPrivateBucket = (req, res) => getSignedUrlResponse(req, res, process.env.BUCKET_PRIVATE_USER_DATA);

const getSignedUrlPublicBucket = (req, res) => getSignedUrlResponse(req, res, process.env.BUCKET_PUBLIC_USER_DATA);

// DELETE
const deleteMoments = (req, res) => {
    const userId = req.headers['x-userid'];
    // TODO: RSERV-52 | Consider archiving only, and delete/archive associated reactions from reactions-service

    return Store.moments.deleteMoments({
        ...req.body,
        fromUserId: userId,
    })
        .then(([moments]) => res.status(202).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

export {
    createMoment,
    createIntegratedMoment,
    dynamicCreateIntegratedMoment,
    updateMoment,
    getMomentDetails,
    getIntegratedMoments,
    searchMoments,
    searchMyMoments,
    searchSpaceMoments,
    findMoments,
    getSignedUrlPrivateBucket,
    getSignedUrlPublicBucket,
    deleteMoments,
};
