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
import { InternalConfigHeaders, internalRestRequest } from 'therr-js-utilities/internal-rest-request';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAreaType } from 'therr-js-utilities/types';
import UserLocationCache from '../../store/UserLocationCache';
import { updateAchievements } from './updateAchievements';
import { predictAndSendNotification } from '../../api/firebaseAdmin';
import * as globalConfig from '../../../../../global-config';

export interface IUserlocation {
    longitude: number;
    latitude: number;
}

export interface IHeaders {
    authorization: any;
    locale: any;
    userId: any;
    userDeviceToken: string;
    whiteLabelOrigin: string;
}

interface IAreaGetSettings {
    headers: InternalConfigHeaders;
    userLocation: IUserlocation;
    limit: number;
}

interface IActivationArgs {
    activatedMomentIds: string[];
    activatedSpaceIds: string[];
    moments: any[];
    spaces: any[];
}

const hasSentNotificationRecently = (lastNotificationDate, isCheckInNotification = false) => {
    const minDuration = isCheckInNotification
        ? Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS
        : Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS;

    return lastNotificationDate
    && (Date.now() - lastNotificationDate < minDuration);
};

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
}: IAreaGetSettings): Promise<any[]> => {
    const maxActivationDistancePromise = areaType === 'moments'
        ? userLocationCache.getMaxMomentActivationDistance()
        : userLocationCache.getMaxSpaceActivationDistance();
    return maxActivationDistancePromise
        .then((maxDistance) => {
            // NOTE: User cached max to only search moments that a user could possibly be close enough to activate
            const radius = maxDistance ? Number(maxDistance) : Location.FALLBACK_CACHE_SEARCH_RADIUS_METERS;

            if (areaType === 'moments') {
                return userLocationCache.getMomentsWithinDistance(userLocation, radius, {
                    locale: headers['x-localecode'],
                    userDeviceToken: headers['x-user-device-token'],
                    userId: headers['x-userid'],
                    limit,
                });
            }

            return userLocationCache.getSpacesWithinDistance(userLocation, radius, {
                locale: headers['x-localecode'],
                userDeviceToken: headers['x-user-device-token'],
                userId: headers['x-userid'],
                limit,
            });
        });
};

const createAppAndPushNotification = (
    areaType: IAreaType,
    userLocationCache: UserLocationCache,
    headers: InternalConfigHeaders,
    associationId: string,
    messageData: any,
    shouldSendAppNotification: boolean,
    lastNotificationDate?: any,
    pushNotificationType: PushNotifications.Types = (areaType === 'moments'
        ? PushNotifications.Types.proximityRequiredMoment
        : PushNotifications.Types.proximityRequiredSpace),
) => {
    if (areaType === 'moments') {
        userLocationCache.setLastMomentNotificationDate(); // fire and forget
    } else {
        userLocationCache.setLastSpaceNotificationDate(); // fire and forget
    }
    let notificationData = {};

    const appNotificationPromise = shouldSendAppNotification
        ? internalRestRequest({
            headers,
        }, { // fire and forget
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/notifications`,
            data: {
                userId: headers['x-userid'],
                type: (areaType === 'moments'
                    ? Notifications.Types.DISCOVERED_UNIQUE_MOMENT
                    : Notifications.Types.DISCOVERED_UNIQUE_SPACE),
                isUnread: true,
                associationId,
                messageLocaleKey: areaType === 'moments'
                    ? Notifications.MessageKeys.DISCOVERED_UNIQUE_MOMENT
                    : Notifications.MessageKeys.DISCOVERED_UNIQUE_SPACE,
            },
        }) : Promise.resolve({
            data: {},
        });

    return appNotificationPromise.then((response) => {
        notificationData = response?.data;
    }).catch((error) => {
        console.log(error);
    }).finally(() => {
        const metrics = (areaType === 'moments' && lastNotificationDate)
            ? {
                lastMomentNotificationDate: lastNotificationDate,
            }
            : {
                lastSpaceNotificationDate: lastNotificationDate,
            };
        const locale = headers['x-localecode'] || 'en-us';
        const userDeviceToken = headers['x-user-device-token'] || '';
        const userId = headers['x-userid'] || '';

        return predictAndSendNotification(
            pushNotificationType,
            {
                ...messageData,
                notificationData,
            },
            {
                deviceToken: userDeviceToken,
                userId,
                userLocale: locale,
            },
            metrics,
            headers['x-brand-variation'] as any,
        );
    });
};

// Find areas within distance that have not been activated and are close enough to activate
const filterNearbyAreas = (areaType: IAreaType, areas, userLocationCache: UserLocationCache, headers: InternalConfigHeaders, userLocation: IUserlocation) => {
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
    return internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/${areaTypeSingular}-reactions/find/dynamic`,
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
            const shouldSkipNotification = hasSentNotificationRecently(lastNotificationDate);
            const cacheableAreas: any[] = [];
            let maxActivationDistance = Location.AREA_PROXIMITY_METERS;
            let filteredAreasCount = 0;

            // Only interested in reactions that have not been activated
            const filteredAreas = areas.filter((area) => {
                maxActivationDistance = Math.max(maxActivationDistance, (area.radius + area.maxProximity));
                const userIsCloseEnough = canActivateArea(area, userLocation);

                // Unique areas
                if (area.doesRequireProximityView) { // Requires manual interaction (by clicking)
                    if (!shouldSkipNotification) {
                        createAppAndPushNotification(
                            areaType,
                            userLocationCache,
                            headers,
                            area.id,
                            {
                                area,
                            },
                            true,
                            lastNotificationDate,
                        );
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
                    locale: headers['x-localecode'],
                    userDeviceToken: headers['x-user-device-token'],
                    userId: headers['x-userid'],
                });
            } else {
                userLocationCache.setMaxSpaceActivationDistance(maxActivationDistance); // fire and forget
                // fire and forget
                userLocationCache.addSpaces(cacheableAreas, {
                    locale: headers['x-localecode'],
                    userDeviceToken: headers['x-user-device-token'],
                    userId: headers['x-userid'],
                });
            }

            return filteredAreas;
        });
};

const fetchNearbyAreas = (areaType: IAreaType, userLocationCache: UserLocationCache, {
    headers,
    userLocation,
    limit,
}: IAreaGetSettings, distanceOverride = Location.AREA_PROXIMITY_EXPANDED_METERS): Promise<{
    areas: any[],
    newlyDiscoveredAreas: any[],
}> => {
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

    return internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/${areaType}/search${getSearchQueryString(query)}`,
        data: {
            distanceOverride,
        },
    })
        .then((areasResponse) => (areasResponse?.data?.results || [])) // relevant areas within x meters
        .then((areas) => filterNearbyAreas(areaType, areas, userLocationCache, headers, userLocation).then((newlyDiscoveredAreas) => ({
            areas,
            newlyDiscoveredAreas,
        })));
};

const getAllNearbyAreas = (userLocationCache: UserLocationCache, shouldInvalidateCache: boolean, {
    headers,
    userLocation,
    limit,
}: IAreaGetSettings, distanceOverride = Location.AREA_PROXIMITY_EXPANDED_METERS): Promise<[
    {
        areas: any[],
        newlyDiscoveredAreas: any[],
    },
    {
        areas: any[],
        newlyDiscoveredAreas: any[],
    }
]> => {
    if (shouldInvalidateCache) {
        userLocationCache.invalidateCache();

        // Update user.lastKnownLocation
        internalRestRequest({
            headers,
        }, {
            method: 'put',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/${headers['x-userid']}/location`,
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
        }, distanceOverride);

        // Use tighter radius for activating spaces to prevent cluttering user timeline
        const spacesPromise = fetchNearbyAreas('spaces', userLocationCache, {
            headers,
            userLocation,
            limit,
        }, (distanceOverride || Location.AREA_PROXIMITY_METERS) / 2);

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
    ).then((moments) => ({
        areas: moments, // We didn't call ALL areas, so just return the (cached) areas that can be activated here
        newlyDiscoveredAreas: moments,
    }));

    const spacesPromise = getCachedNearbyAreas(
        'spaces',
        userLocationCache,
        {
            headers,
            userLocation,
            limit,
        },
    ).then((spaces) => ({
        areas: spaces, // We didn't call ALL areas, so just return the (cached) areas that can be activated here
        newlyDiscoveredAreas: spaces,
    }));

    return Promise.all([momentsPromise, spacesPromise]);
};

const sendSpaceMetric = (headers: InternalConfigHeaders, spaces: any[], userLocation: IUserlocation, metricName: MetricNames) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/space-metrics`,
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
    headers: InternalConfigHeaders,
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
        // moments, // TODO: Add moment metrics
        spaces,
    } = activationArgs;
    const momentReactionsPromise: Promise<any> = activatedMomentIds.length ? internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/create-update/multiple`,
        data: {
            momentIds: activatedMomentIds,
            userHasActivated: true,
        },
    }) : Promise.resolve();
    const spaceReactionsPromise: Promise<any> = activatedSpaceIds.length ? internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/space-reactions/create-update/multiple`,
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

                return internalRestRequest({
                    headers,
                }, {
                    method: 'post',
                    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/notifications`,
                    data: {
                        userId: headers['x-userid'],
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
                    const locale = headers['x-localecode'] || 'en-us';
                    const userDeviceToken = headers['x-user-device-token'] || '';
                    const userId = headers['x-userid'] || '';

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
                            deviceToken: userDeviceToken,
                            userId,
                            userLocale: locale,
                            totalAreasActivated: activatedMomentIds.length + activatedSpaceIds.length,
                        },
                        {
                            lastMomentNotificationDate: lastMomentNotificationDate as any,
                            lastSpaceNotificationDate: lastSpaceNotificationDate as any,
                        },
                        headers['x-brand-variation'] as any,
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

const selectAreasAndActivate = (
    headers: InternalConfigHeaders,
    userLocationCache: UserLocationCache,
    userLocation: IUserlocation,
    filteredMoments: any[],
    filteredSpaces: any[],
) => {
    const momentIdsToActivate: string[] = [];
    const momentsToActivate: any[] = [];
    const spaceIdsToActivate: string[] = [];
    const spacesToActivate: any[] = [];
    // NOTE: only activate 'x' spaces max to limit high density locations
    for (let i = 0; i <= Location.MAX_AREA_ACTIVATE_COUNT && i <= filteredSpaces.length - 1; i += 1) {
        spaceIdsToActivate.push(filteredSpaces[i].id);
        spacesToActivate.push(filteredSpaces[i]);
    }
    for (let i = 0; (i <= (Location.MAX_AREA_ACTIVATE_COUNT - spaceIdsToActivate.length) && i <= filteredMoments.length - 1); i += 1) {
        momentIdsToActivate.push(filteredMoments[i].id);
        momentsToActivate.push(filteredMoments[i]);
    }

    if (momentIdsToActivate.length) {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Moments Activated'],
            traceArgs: {
                'user.id': headers['x-userid'],
                'location.momentIdsToActivate': JSON.stringify(momentIdsToActivate),
            },
        });
    }
    if (spaceIdsToActivate.length) {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Spaces Activated'],
            traceArgs: {
                'user.id': headers['x-userid'],
                'location.spaceIdsToActivate': JSON.stringify(spaceIdsToActivate),
            },
        });
    }

    // Fire and forget (create or update reactions)
    if (spaceIdsToActivate.length || momentIdsToActivate.length) {
        activateAreasAndNotify(
            headers,
            {
                moments: momentsToActivate,
                spaces: spacesToActivate,
                activatedMomentIds: momentIdsToActivate,
                activatedSpaceIds: spaceIdsToActivate,
            },
            userLocationCache,
            userLocation,
        );

        updateAchievements(headers, momentIdsToActivate, spaceIdsToActivate);

        userLocationCache.removeMoments(momentIdsToActivate, headers);

        userLocationCache.removeMoments(spaceIdsToActivate, headers);
    }

    return [momentsToActivate, filteredSpaces];
};

export {
    createAppAndPushNotification,
    activateAreasAndNotify,
    selectAreasAndActivate,
    hasSentNotificationRecently,
    getAllNearbyAreas,
    fetchNearbyAreas,
};
