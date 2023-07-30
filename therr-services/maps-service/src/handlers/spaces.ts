import axios from 'axios';
import path from 'path';
import { getSearchQueryArgs, getSearchQueryString } from 'therr-js-utilities/http';
import {
    AccessLevels,
    ErrorCodes,
    MetricNames,
    MetricValueTypes,
} from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import { storage } from '../api/aws';
import areaMetricsService from '../api/areaMetricsService';
import * as globalConfig from '../../../../global-config';
import getReactions from '../utilities/getReactions';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import { checkIsMediaSafeForWork } from './helpers';
import { isTextUnsafe } from '../utilities/contentSafety';
import userMetricsService from '../api/userMetricsService';

const MAX_DISTANCE_TO_ADDRESS_METERS = 2000;

// CREATE
const createSpace = async (req, res) => {
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    const isDuplicate = await Store.spaces.get({
        fromUserId: userId,
        message: req.body.message,
        notificationMsg: req.body.notificationMsg,
    })
        .then((spaces) => spaces?.length);

    if (isDuplicate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.posts.duplicatePost'),
            statusCode: 400,
            errorCode: ErrorCodes.DUPLICATE_POST,
        });
    }

    const {
        hashTags,
        media,
        message,
        notificationMsg,
    } = req.body;

    const isTextMature = isTextUnsafe([notificationMsg, message, hashTags]);

    return Store.spaces.createSpace({
        ...req.body,
        locale,
        fromUserId: userId,
    })
        .then(([space]) => axios({ // Create companion reaction for user's own space
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/space-reactions/${space.id}`,
            headers: {
                authorization,
                'x-localecode': locale,
                'x-userid': userId,
            },
            data: {
                userHasActivated: true,
            },
        }).then(({ data: reaction }) => {
            printLogs({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Space Created'],
                tracer: beeline,
                traceArgs: {
                    // TODO: Add a sentiment analysis score property
                    action: 'create-space',
                    category: space.category,
                    radius: space.radius,
                    isPublic: space.isPublic,
                    isDraft: space.isDraft,
                    logCategory: 'user-sentiment',
                    region: space.region,
                    hashTags: space.hashTags,
                    hasMedia: media?.length > 0,
                    isMatureContent: space.isMatureContent,
                    featuredIncentiveKey: space.featuredIncentiveKey,
                    featuredIncentiveValue: space.featuredIncentiveValue,
                    featuredIncentiveRewardKey: space.featuredIncentiveRewardKey,
                    featuredIncentiveRewardValue: space.featuredIncentiveRewardValue,
                    featuredIncentiveCurrencyId: space.featuredIncentiveCurrencyId,
                    locale,
                    userId,
                },
            });
            // if condition could work for any incentive property
            let createIncentivePromise: Promise<any[]> = Promise.resolve([]);
            if (req.body.featuredIncentiveKey) {
                createIncentivePromise = Store.spaceIncentives.create({
                    spaceId: space.id,
                    region: space.region,
                    incentiveKey: req.body.featuredIncentiveKey,
                    incentiveValue: req.body.featuredIncentiveValue,
                    incentiveRewardKey: req.body.featuredIncentiveRewardKey,
                    incentiveRewardValue: req.body.featuredIncentiveRewardValue,
                    incentiveCurrencyId: req.body.featuredIncentiveCurrencyId,
                    isFeatured: true,
                });
            }
            // TODO: This technically leaves room for a gap of time where users may find
            // explicit content before it's flag has been updated. We should solve this by
            // marking the content pending before making it available to search
            // This check is redundant and unnecessary if the text already marked the content as "mature"
            // Async - fire and forget to prevent slow request
            if (!isTextMature) {
                checkIsMediaSafeForWork(media).then((isSafeForWork) => {
                    if (!isSafeForWork) {
                        return Store.spaces.updateSpace(space.id, {
                            fromUserId: userId,
                            isMatureContent: !isSafeForWork,
                        }).catch((err) => {
                            printLogs({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['failed to update space after sightengine check'],
                                tracer: beeline,
                                traceArgs: {
                                    errorMessage: err?.message,
                                    errorResponse: err?.response?.data,
                                },
                            });
                        });
                    }
                });
            }

            return createIncentivePromise.then(([spaceIncentive]) => {
                if (spaceIncentive) {
                    return Store.spaces.updateSpace(space.id, {
                        fromUserId: userId,
                        featuredIncentiveKey: spaceIncentive.incentiveKey,
                        featuredIncentiveValue: spaceIncentive.incentiveValue,
                        featuredIncentiveRewardKey: spaceIncentive.incentiveRewardKey,
                        featuredIncentiveRewardValue: spaceIncentive.incentiveRewardValue,
                        featuredIncentiveCurrencyId: spaceIncentive.incentiveCurrencyId,
                    }).then(() => ({
                        ...space,
                        featuredIncentiveKey: spaceIncentive.incentiveKey,
                        featuredIncentiveValue: spaceIncentive.incentiveValue,
                        featuredIncentiveRewardKey: spaceIncentive.incentiveRewardKey,
                        featuredIncentiveRewardValue: spaceIncentive.incentiveRewardValue,
                        featuredIncentiveCurrencyId: spaceIncentive.incentiveCurrencyId,
                    }));
                }
            }).then((spaceWithFeaturedIncentive) => res.status(201).send({
                ...spaceWithFeaturedIncentive,
                reaction,
            }));
        }))
        .catch((err) => {
            if (err?.constraint === 'no_overlaps') {
                return handleHttpError({
                    res,
                    message: translate(locale, 'spaces.noOverlap'),
                    statusCode: 400,
                    errorCode: ErrorCodes.NO_SPACE_OVERLAP,
                });
            }

            return handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' });
        });
};

// READ
const getSpaceDetails = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const userAccessLevels = req.headers['x-user-access-levels'];
    const accessLevels = userAccessLevels ? JSON.parse(userAccessLevels) : [];

    const { spaceId } = req.params;

    const {
        withMedia,
        withUser,
    } = req.body;

    const shouldFetchMedia = !!withMedia;
    const shouldFetchUser = !!withUser;

    // TODO: Fetch own reaction or reaction count for own space
    return Store.spaces.findSpaces([spaceId], {
        limit: 1,
    }, {
        withMedia: shouldFetchMedia,
        withUser: shouldFetchUser,
        shouldHideMatureContent: true, // TODO: Check the user settings to determine if mature content should be hidden
    })
        .then(({ spaces, media, users }) => {
            const space = spaces[0];
            // Non-blocking
            areaMetricsService.uploadMetric({
                name: MetricNames.SPACE_IMPRESSION,
                value: '1',
                valueType: MetricValueTypes.NUMBER,
                userId,
            }, {}, {
                latitude: space.latitude,
                longitude: space.longitude,
                spaceId: space.id,
            }).catch((err) => {
                printLogs({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['failed to upload space metric'],
                    tracer: beeline,
                    traceArgs: {
                        errorMessage: err?.message,
                        errorResponse: err?.response?.data,
                        userId,
                        spaceId: space.id,
                    },
                });
            });
            userMetricsService.uploadMetric({
                name: `${MetricNames.USER_CONTENT_PREF_CAT_PREFIX}${space.category || 'uncategorized'}` as MetricNames,
                value: '1',
                valueType: MetricValueTypes.NUMBER,
                userId,
            }, {
                spaceId: space.id,
                isMatureContent: space.isMatureContent,
                isPublic: space.isPublic,
            }, {
                contentUserId: space.fromUserId,
                authorization: req.headers.authorization,
                userId,
                locale,
            }).catch((err) => {
                printLogs({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['failed to upload user metric'],
                    tracer: beeline,
                    traceArgs: {
                        errorMessage: err?.message,
                        errorResponse: err?.response?.data,
                        userId,
                        spaceId: space.id,
                    },
                });
            });
            let userHasAccessPromise = () => Promise.resolve(true);
            // Verify that user has activated space and has access to view it
            // TODO: Verify space exists
            if (space?.fromUserId !== userId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
                userHasAccessPromise = () => getReactions('space', spaceId, {
                    'x-userid': userId,
                });
            }

            return userHasAccessPromise().then((isActivated) => {
                if (!isActivated) {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'spaceReactions.spaceNotActivated'),
                        statusCode: 400,
                        errorCode: ErrorCodes.SPACE_ACCESS_RESTRICTED,
                    });
                }

                return res.status(200).send({ space, media, users });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

const searchSpaces: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
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
            },
        });
        fromUserIds = connectionsResponse.data.results
            .map((connection: any) => connection.users.filter((user: any) => user.id != userId)[0].id); // eslint-disable-line eqeqeq
    }
    const searchPromise = Store.spaces.searchSpaces(searchArgs[0], searchArgs[1], fromUserIds, { distanceOverride }, query !== 'me');
    // const countPromise = Store.spaces.countRecords({
    //     filterBy,
    //     query,
    //     longitude,
    //     latitude,
    // }, fromUserIds);
    const countPromise = Promise.resolve();

    // TODO: Get associated reactions for user and return limited details if space is not yet activated
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

const searchMySpaces: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const {
        // filterBy,
        itemsPerPage,
        pageNumber,
    } = req.query;

    const integerColumns = ['maxViews'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.spaces.searchMySpaces(searchArgs[0], searchArgs[1], userId, true);

    return searchPromise.then((results) => {
        const response = {
            results,
            pagination: {
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

const requestSpace: RequestHandler = async (req: any, res: any) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const {
        address,
        longitude,
        latitude,
        title,
        description,

        //
        category,
        media,
        hashTags,
        isPublic,
        maxViews,
        maxProximity,
    } = req.body;

    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/request-space`,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': userId,
        },
        data: {
            address,
            longitude,
            latitude,
            title,
            description,

            //
            category,
            hashTags,
            isPublic,
            maxViews,
            maxProximity,
        },
    })
        .then(({ data }) => {
            const isTextMature = isTextUnsafe([title, description, hashTags]);

            Store.spaces.createSpace({
                addressReadable: address,
                category,
                fromUserId: userId,
                locale,
                isPublic,
                isMatureContent: isTextMature,
                message: description,
                notificationMsg: title,
                media,
                hashTags,
                isClaimPending: true,
                maxViews,
                maxProximity,
                longitude,
                latitude,
            }).then(([space]) => axios({ // Create companion reaction for user's own space
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/space-reactions/${space.id}`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                },
                data: {
                    userHasActivated: true,
                },
            }).then(({ data: reaction }) => {
                printLogs({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Space Created'],
                    tracer: beeline,
                    traceArgs: {
                        // TODO: Add a sentiment analysis score property
                        action: 'create-space',
                        category: space.category,
                        radius: space.radius,
                        isPublic: space.isPublic,
                        isDraft: space.isDraft,
                        logCategory: 'user-sentiment',
                        region: space.region,
                        hashTags: space.hashTags,
                        hasMedia: media?.length > 0,
                        isMatureContent: space.isMatureContent,
                        featuredIncentiveKey: space.featuredIncentiveKey,
                        featuredIncentiveValue: space.featuredIncentiveValue,
                        featuredIncentiveRewardKey: space.featuredIncentiveRewardKey,
                        featuredIncentiveRewardValue: space.featuredIncentiveRewardValue,
                        featuredIncentiveCurrencyId: space.featuredIncentiveCurrencyId,
                        locale,
                        userId,
                    },
                });

                // TODO: This technically leaves room for a gap of time where users may find
                // explicit content before it's flag has been updated. We should solve this by
                // marking the content pending before making it available to search
                // This check is redundant and unnecessary if the text already marked the content as "mature"
                // Async - fire and forget to prevent slow request

                if (!isTextMature) {
                    checkIsMediaSafeForWork(media).then((isSafeForWork) => {
                        if (!isSafeForWork) {
                            return Store.spaces.updateSpace(space.id, {
                                fromUserId: userId,
                                isMatureContent: !isSafeForWork,
                            }).catch((err) => {
                                printLogs({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['failed to update space after sightengine check'],
                                    tracer: beeline,
                                    traceArgs: {
                                        errorMessage: err?.message,
                                        errorResponse: err?.response?.data,
                                        userId,
                                    },
                                });
                            });
                        }
                    });
                }
            })).catch((err) => {
                printLogs({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['failed to create space after claim request'],
                    tracer: beeline,
                    traceArgs: {
                        errorMessage: err?.message,
                        errorResponse: err?.response?.data,
                        locale,
                        userId,
                    },
                });
            });

            return res.status(200).send(data);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

// NOTE: This should remain a non-public endpoint
const findSpaces: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];

    const {
        limit,
        order,
        spaceIds,
        withMedia,
        withUser,
        lastContentCreatedAt,
    } = req.body;

    return Store.spaces.findSpaces(spaceIds, {
        limit: limit || 21,
        order,
        before: lastContentCreatedAt,
    }, {
        withMedia: !!withMedia,
        withUser: !!withUser,
    })
        .then(({ spaces, media }) => res.status(200).send({ spaces, media }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

const getSignedUrl = (req, res, bucket) => {
    const requestId = req.headers['x-requestid'];
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const userAccessLevels = req.headers['x-user-access-levels'];
    const accessLevels = userAccessLevels ? JSON.parse(userAccessLevels) : [];
    const {
        overrideFromUserId,
    } = req.query;

    if (overrideFromUserId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.accessDenied'),
            statusCode: 403,
            errorCode: ErrorCodes.ACCESS_DENIED,
        });
    }

    const {
        action,
        filename,
    } = req.query;

    const options: any = {
        version: 'v4',
        action,
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    // TODO: Improve
    const parsedFileName = path.parse(filename);
    const directory = parsedFileName.dir ? `${parsedFileName.dir}/` : '';

    const filePath = `${overrideFromUserId || userId}/${directory}${parsedFileName.name}_${requestId}${parsedFileName.ext}`;

    return storage
        .bucket(bucket)
        .file(filePath)
        .getSignedUrl(options)
        .then((url) => res.status(201).send({
            url,
            path: `${filePath}`,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

// TODO: Use Env variables
const getSignedUrlPrivateBucket = (req, res) => getSignedUrl(req, res, process.env.BUCKET_PRIVATE_USER_DATA);

const getSignedUrlPublicBucket = (req, res) => getSignedUrl(req, res, process.env.BUCKET_PUBLIC_USER_DATA);

// WRITE
const updateSpace = (req, res) => {
    const userId = req.headers['x-userid'];
    const userAccessLevels = req.headers['x-user-access-levels'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const accessLevels = userAccessLevels ? JSON.parse(userAccessLevels) : [];
    const {
        overrideFromUserId,
    } = req.body;

    // TODO: Check media for mature content

    if (overrideFromUserId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.accessDenied'),
            statusCode: 403,
            errorCode: ErrorCodes.ACCESS_DENIED,
        });
    }

    // TODO: Verify address is close to longitude/latitude
    // const canChangeAddress = req.body.addressReadable && req.body.longitude && req.body.latitude;
    // const isNearLongLat = canChangeAddress ? distanceTo({
    //     lon: req.body.longitude,
    //     lat: req.body.latitude,
    // }, {
    //     lon: longitude,
    //     lat: latitude,
    // }) <= MAX_DISTANCE_TO_ADDRESS_METERS : false;
    // const addressReadable = isNearLongLat ? req.body.addressReadable : undefined;

    return Store.spaces.updateSpace(req.params.spaceId, {
        ...req.body,
        // addressReadable,
        fromUserId: overrideFromUserId || userId,
    })
        .then(([space]) => res.status(200).send(space))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

// DELETE
const deleteSpaces = (req, res) => {
    const userId = req.headers['x-userid'];
    // TODO: RSERV-52 | Consider archiving only, and delete/archive associated reactions from reactions-service

    return Store.spaces.deleteSpaces({
        ...req.body,
        fromUserId: userId,
    })
        .then(([spaces]) => res.status(202).send(spaces))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

export {
    createSpace,
    getSpaceDetails,
    searchSpaces,
    searchMySpaces,
    requestSpace,
    findSpaces,
    getSignedUrlPrivateBucket,
    getSignedUrlPublicBucket,
    updateSpace,
    deleteSpaces,
};
