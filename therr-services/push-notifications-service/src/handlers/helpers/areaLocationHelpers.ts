import axios from 'axios';
import { distanceTo } from 'geolocation-utils';
import logSpan from 'therr-js-utilities/log-or-update-span';
import {
    Location,
    MetricNames,
    MetricValueTypes,
    Notifications,
    PushNotifications,
} from 'therr-js-utilities/constants';
import { getSearchQueryString } from 'therr-js-utilities/http';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAreaType } from 'therr-js-utilities/types';
import UserLocationCache from '../../store/UserLocationCache';
import { predictAndSendNotification } from '../../api/firebaseAdmin';
import * as globalConfig from '../../../../../global-config';

export interface IUserlocation {
    longitude: number;
    latitude: number;
}

interface IHeaders {
    authorization: any;
    locale: any;
    userId: any;
    userDeviceToken: string;
}

interface IAreaGetSettings {
    headers: IHeaders;
    userLocation: IUserlocation;
    limit: number;
}

interface IActivationArgs {
    activatedMomentIds: string[];
    activatedSpaceIds: string[];
    moments: any[];
    spaces: any[];
}

const hasSentNotificationRecently = (lastNotificationDate) => lastNotificationDate
    && (Date.now() - lastNotificationDate < Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS);

const canActivateArea = (area, userLocation: IUserlocation) => {
    const areaRequiredProximityMeters = area.radius + area.maxProximity;

    const distToCenter = distanceTo({
        lon: area.longitude,
        lat: area.latitude,
    }, {
        lon: userLocation.longitude,
        lat: userLocation.latitude,
    });

    // TODO: We should gradually reduce tempLocationExpansionDistMeters toward zero as more users join
    return distToCenter - areaRequiredProximityMeters <= parseInt(globalConfig[process.env.NODE_ENV].tempLocationExpansionDistMeters || 0, 10);
};

const getCachedNearbyAreas = (areaType: IAreaType, userLocationCache: UserLocationCache, {
    headers,
    userLocation,
    limit,
}: IAreaGetSettings) => {
    const maxActivationDistancePromise = areaType === 'moments'
        ? userLocationCache.getMaxMomentActivationDistance()
        : userLocationCache.getMaxSpaceActivationDistance();
    return maxActivationDistancePromise
        .then((maxDistance) => {
            // NOTE: User cached max to only search moments that a user could possibly be close enough to activate
            const radius = maxDistance ? Number(maxDistance) : Location.FALLBACK_CACHE_SEARCH_RADIUS_METERS;

            if (areaType === 'moments') {
                return userLocationCache.getMomentsWithinDistance(userLocation, radius, {
                    locale: headers.locale,
                    userDeviceToken: headers.userDeviceToken,
                    userId: headers.userId,
                    limit,
                });
            }

            return userLocationCache.getSpacesWithinDistance(userLocation, radius, {
                locale: headers.locale,
                userDeviceToken: headers.userDeviceToken,
                userId: headers.userId,
                limit,
            });
        });
};

// Find areas within distance that have not been activated and are close enough to activate
const filterNearbyAreas = (areaType: IAreaType, areas, userLocationCache: UserLocationCache, headers: IHeaders, userLocation: IUserlocation) => {
    if (!areas.length) {
        return Promise.resolve([]);
    }

    const areaTypeSingular = areaType === 'moments' ? 'moment' : 'space';
    const data = areaType === 'moments'
        ? {
            limit: areas.length,
            momentIds: areas.map((area: any) => area.id) || [],
        }
        : {
            limit: areas.length,
            spaceIds: areas.map((area: any) => area.id) || [],
        };

    // Find associated reactions for/to the nearby areas
    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/${areaTypeSingular}-reactions/find/dynamic`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data,
    })
        .then((reactionsResponse) => {
            logSpan({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Start date cache lookup for last sent push notification'],
                traceArgs: {
                    message: 'Start date cache lookup for last sent push notification',
                    context: 'redis',
                    issue: `helps prevent excessive push notifications for location ${areaTypeSingular} activations`,
                },
            });

            if (areaType === 'moments') {
                return userLocationCache.getLastMomentNotificationDate()
                    .then((lastNotificationDate) => [reactionsResponse, lastNotificationDate]);
            }

            // spaces
            return userLocationCache.getLastSpaceNotificationDate()
                .then((lastNotificationDate) => [reactionsResponse, lastNotificationDate]);
        })
        .then(([reactionsResponse, lastNotificationDate]: any[]) => {
            const reactions = reactionsResponse?.data?.reactions || [];
            // TODO: RDATA-3 - Determine smart rules around sending push notifications
            let shouldSkipNotification = hasSentNotificationRecently(lastNotificationDate);
            const cacheableAreas: any[] = [];
            let maxActivationDistance = Location.AREA_PROXIMITY_METERS;
            let filteredAreasCount = 0;

            // Only interested in reactions that have not been activated
            const filteredAreas = areas.filter((area, index) => {
                maxActivationDistance = Math.max(maxActivationDistance, (area.radius + area.maxProximity));
                const userIsCloseEnough = canActivateArea(area, userLocation);

                // Unique areas
                if (area.doesRequireProximityView) { // Requires manual interaction (by clicking)
                    if (!shouldSkipNotification) {
                        if (areaType === 'moments') {
                            userLocationCache.setLastMomentNotificationDate(); // fire and forget
                        } else {
                            userLocationCache.setLastSpaceNotificationDate(); // fire and forget
                        }
                        let notificationData = {};
                        shouldSkipNotification = true;

                        return axios({ // fire and forget
                            method: 'post',
                            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/notifications`,
                            headers: {
                                authorization: headers.authorization,
                                'x-localecode': headers.locale,
                                'x-userid': headers.userId,
                            },
                            data: {
                                userId: headers.userId,
                                type: areaType === 'moments' ? Notifications.Types.DISCOVERED_UNIQUE_MOMENT : Notifications.Types.DISCOVERED_UNIQUE_SPACE,
                                isUnread: true,
                                associationId: area.id,
                                messageLocaleKey: areaType === 'moments'
                                    ? Notifications.MessageKeys.DISCOVERED_UNIQUE_MOMENT
                                    : Notifications.MessageKeys.DISCOVERED_UNIQUE_SPACE,
                            },
                        }).then((response) => {
                            notificationData = response?.data;
                        }).catch((error) => {
                            console.log(error);
                        }).finally(() => {
                            const metrics = areaType === 'moments'
                                ? {
                                    lastMomentNotificationDate: lastNotificationDate,
                                }
                                : {
                                    lastSpaceNotificationDate: lastNotificationDate,
                                };
                            return predictAndSendNotification(
                                (areaType === 'moments' ? PushNotifications.Types.proximityRequiredMoment : PushNotifications.Types.proximityRequiredSpace),
                                {
                                    area,
                                    notificationData,
                                },
                                {
                                    deviceToken: headers.userDeviceToken,
                                    userId: headers.userId,
                                    userLocale: headers.locale,
                                },
                                metrics,
                            );
                        });
                    }

                    return false; // Filter out these areas from being automatically-activated
                }

                const hasAlreadyActivated = reactions.find((reaction) => {
                    if (areaType === 'moments') {
                        return reaction.momentId === area.id && reaction.userHasActivated;
                    }

                    return reaction.spaceId === area.id && reaction.userHasActivated;
                });

                if (hasAlreadyActivated) {
                    return false;
                }

                // Only cache areas that have not already been viewed and do not require manual activation
                if (!userIsCloseEnough || filteredAreasCount >= Location.MAX_AREA_ACTIVATE_COUNT) {
                    cacheableAreas.push(area);
                }

                if (userIsCloseEnough) {
                    filteredAreasCount += 1;
                }

                return userIsCloseEnough;
            });

            if (areaType === 'moments') {
                userLocationCache.setMaxMomentActivationDistance(maxActivationDistance); // fire and forget
                // fire and forget
                userLocationCache.addMoments(cacheableAreas, {
                    locale: headers.locale,
                    userDeviceToken: headers.userDeviceToken,
                    userId: headers.userId,
                });
            } else {
                userLocationCache.setMaxSpaceActivationDistance(maxActivationDistance); // fire and forget
                // fire and forget
                userLocationCache.addSpaces(cacheableAreas, {
                    locale: headers.locale,
                    userDeviceToken: headers.userDeviceToken,
                    userId: headers.userId,
                });
            }

            return filteredAreas;
        });
};

const fetchNearbyAreas = (areaType: IAreaType, userLocationCache: UserLocationCache, {
    headers,
    userLocation,
    limit,
}: IAreaGetSettings): Promise<any> => {
    // Creates/Resets the origin each time we re-fetch areas
    userLocationCache.setOrigin({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    });

    const query = {
        query: 'connections',
        itemsPerPage: limit,
        pageNumber: 1,
        order: 'desc',
        filterBy: 'fromUserIds',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    };

    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/${areaType}/search${getSearchQueryString(query)}`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data: {
            distanceOverride: Location.AREA_PROXIMITY_EXPANDED_METERS,
        },
    })
        .then((areasResponse) => (areasResponse?.data?.results || [])) // relevant areas within x meters
        .then((areas) => filterNearbyAreas(areaType, areas, userLocationCache, headers, userLocation));
};

const getAllNearbyAreas = (userLocationCache: UserLocationCache, shouldInvalidateCache: boolean, {
    headers,
    userLocation,
    limit,
}: IAreaGetSettings): Promise<any[]> => {
    if (shouldInvalidateCache) {
        userLocationCache.invalidateCache();

        // TODO: Update user.lastKnownLocation
        axios({
            method: 'put',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/${headers.userId}/location`,
            headers: {
                authorization: headers.authorization,
                'x-localecode': headers.locale,
                'x-userid': headers.userId,
            },
            data: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
            },
        }).catch((error) => {
            console.log(error);
        });

        const momentsPromise = fetchNearbyAreas('moments', userLocationCache, {
            headers,
            userLocation,
            limit,
        });

        const spacesPromise = fetchNearbyAreas('spaces', userLocationCache, {
            headers,
            userLocation,
            limit,
        });

        return Promise.all([momentsPromise, spacesPromise]);
    }

    const momentsPromise = getCachedNearbyAreas(
        'moments',
        userLocationCache,
        {
            headers,
            userLocation,
            limit,
        },
    );

    const spacesPromise = getCachedNearbyAreas(
        'spaces',
        userLocationCache,
        {
            headers,
            userLocation,
            limit,
        },
    );

    return Promise.all([momentsPromise, spacesPromise]);
};

const sendSpaceMetric = (headers: IHeaders, spaces: any[], userLocation: IUserlocation, metricName: MetricNames) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/space-metrics`,
    headers: {
        authorization: headers.authorization,
        'x-localecode': headers.locale,
        'x-userid': headers.userId,
    },
    data: {
        name: metricName,
        spaceIds: spaces.map((space) => space.id),
        value: '1',
        valueType: MetricValueTypes.NUMBER,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    },
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: err.toString(),
        traceArgs: {
            'error.message': err?.message,
            source: 'areaLocationHelpers',
            issue: 'failed to create space metrics',
        },
    });
});

const activateAreasAndNotify = (
    headers: IHeaders,
    activationArgs: IActivationArgs,
    userLocationCache: UserLocationCache,
    userLocation: {
        latitude: number,
        longitude: number,
    },
): Promise<void | undefined> => {
    const {
        activatedMomentIds,
        activatedSpaceIds,
        moments,
        spaces,
    } = activationArgs;
    const momentReactionsPromise: Promise<any> = activatedMomentIds.length ? axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/create-update/multiple`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data: {
            momentIds: activatedMomentIds,
            userHasActivated: true,
        },
    }) : Promise.resolve();
    const spaceReactionsPromise: Promise<any> = activatedSpaceIds.length ? axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/space-reactions/create-update/multiple`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data: {
            spaceIds: activatedSpaceIds,
            userHasActivated: true,
        },
    }) : Promise.resolve();

    // Send Metrics
    if (spaces.length) {
        // TODO: Add moment metrics
        const spacesVisited: any = [];
        const spacesProspected: any = [];
        spaces.forEach((space) => {
            const distanceFromSpace = distanceTo({
                lon: userLocation.latitude,
                lat: userLocation.longitude,
            }, {
                lon: space.longitude,
                lat: space.latitude,
            });

            // If user is very close to a space, we consider it visited
            if (distanceFromSpace > Location.AREA_PROXIMITY_METERS - 1) {
                spacesVisited.push(space);
            } else {
                // Otherwise the user is a "prospective" customer
                spacesProspected.push(space);
            }
        });
        if (spacesVisited.length) {
            sendSpaceMetric(headers, spacesVisited, userLocation, MetricNames.SPACE_VISIT);
        }
        if (spacesProspected.length) {
            sendSpaceMetric(headers, spacesProspected, userLocation, MetricNames.SPACE_PROSPECT);
        }
    }

    return Promise.all([momentReactionsPromise, spaceReactionsPromise])
        .then(() => Promise.all([userLocationCache.getLastMomentNotificationDate(), userLocationCache.getLastSpaceNotificationDate()]))
        .then(([lastMomentNotificationDate, lastSpaceNotificationDate]) => {
            if (!hasSentNotificationRecently(lastMomentNotificationDate) && !hasSentNotificationRecently(lastSpaceNotificationDate)) {
                let notificationData = {};

                return axios({
                    method: 'post',
                    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/notifications`,
                    headers: {
                        authorization: headers.authorization,
                        'x-localecode': headers.locale,
                        'x-userid': headers.userId,
                    },
                    data: {
                        userId: headers.userId,
                        type: Notifications.Types.NEW_AREAS_ACTIVATED,
                        isUnread: true,
                        messageLocaleKey: Notifications.MessageKeys.NEW_AREAS_ACTIVATED,
                        messageParams: {
                            activatedMomentIds,
                            activatedSpaceIds,
                            totalAreasActivated: activatedMomentIds.length + activatedSpaceIds.length,
                        },
                    },
                }).then((response) => {
                    notificationData = response?.data;
                }).catch((error) => {
                    console.log(error);
                }).finally(() => {
                    predictAndSendNotification(
                        PushNotifications.Types.newAreasActivated,
                        {
                            // NOTE: Not needed in push notification. Payload too big for firebase
                            areasActivated: activatedSpaceIds.map((id) => ({ spaceId: id }))
                                .concat(activatedMomentIds.map((id) => ({ spaceId: id })))
                                .slice(0, 20), // Slice to fix max size of 4000 Bytes
                            notificationData,
                        },
                        {
                            deviceToken: headers.userDeviceToken,
                            userId: headers.userId,
                            userLocale: headers.locale,
                            totalAreasActivated: activatedMomentIds.length + activatedSpaceIds.length,
                        },
                        {
                            lastMomentNotificationDate: lastMomentNotificationDate as any,
                            lastSpaceNotificationDate: lastSpaceNotificationDate as any,
                        },
                    );
                });
            }
        })
        .catch((err) => {
            console.log('WARNING WARNING WARNING: Moment activation is failing!', err);
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: err.toString(),
                traceArgs: {
                    'error.message': err?.message,
                    source: 'areaLocationHelpers',
                },
            });
        });
};

export {
    activateAreasAndNotify,
    hasSentNotificationRecently,
    getAllNearbyAreas,
    fetchNearbyAreas,
};
