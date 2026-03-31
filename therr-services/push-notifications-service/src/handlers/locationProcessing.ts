import { Location, PushNotifications } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import { distanceTo } from 'geolocation-utils';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders, internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import UserLocationCache from '../store/UserLocationCache';
import {
    createAppAndPushNotification,
    getAllNearbyAreas,
    hasSentNotificationRecently,
    selectAreasAndActivate,
} from './helpers/areaLocationHelpers';
import { createUserLocation, getUserLocations, updateUserLocation } from './helpers/userLocations';
import { getCurrentUser } from './helpers/user';
import { predictAndSendNotification } from '../api/firebaseAdmin';
import * as globalConfig from '../../../../global-config';
// import translate from '../utilities/translator';

// CREATE/UPDATE
const processUserLocationChange: RequestHandler = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);

    const {
        // radiusOfAwareness,
        // radiusOfInfluence,
        latitude,
        longitude,
        // lastLocationSendForProcessing,
    } = req.body;

    const userLocationCache = new UserLocationCache(userId);

    return userLocationCache.getOrigin().then((origin) => {
        let isCacheInvalid = !origin;

        if (!isCacheInvalid) {
            const distanceFromOriginMeters = distanceTo({
                lon: longitude,
                lat: latitude,
            }, {
                lon: origin.longitude,
                lat: origin.latitude,
            });

            isCacheInvalid = distanceFromOriginMeters > Location.AREA_PROXIMITY_NEARBY_METERS - 1;
        }

        // Fetches x nearest areas within y meters of the user's current location (from the users's connections)
        return getAllNearbyAreas(userLocationCache, isCacheInvalid, {
            headers: req.headers as any,
            userLocation: {
                longitude,
                latitude,
            },
            limit: 100,
        })
            .then(([nearbyMoments, nearbySpaces]) => selectAreasAndActivate(
                req.headers as any,
                userLocationCache,
                {
                    longitude,
                    latitude,
                },
                nearbyMoments?.newlyDiscoveredAreas,
                nearbySpaces?.newlyDiscoveredAreas,
            ))
            .then(([momentsToActivate, spacesToActivate]) => res.status(200).send({
                activatedAreas: [spacesToActivate, ...momentsToActivate],
            }))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
    });
};

const processUserBackgroundLocation: RequestHandler = (req, res) => {
    const {
        authorization,
        brandVariation,
        locale,
        userId,
        userDeviceToken,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const incompleteHeaders = {
        authorization,
        brandVariation,
        locale,
        userId,
        userDeviceToken,
        whiteLabelOrigin,
    };

    const {
        location,
        platformOS,
        deviceModel,
        isDeviceTablet,
    } = req.body;
    // const formattedDetails = {
    //     event: location?.event,
    //     isMoving: location?.is_moving,
    //     isBatteryCharging: location?.battery.is_charging,
    //     coords: {
    //         latitude: location?.coords.latitude,
    //         longitude: location?.coords.longitude,
    //     },
    //     timestamp: location?.timestamp,
    // };

    const latitude = location?.coords.latitude;
    const longitude = location?.coords.longitude;

    if (location?.is_moving || !latitude || !longitude) {
        return res.status(200).send();
    }

    const userLocationPromise = createUserLocation(userId, req.headers as any, {
        latitude,
        longitude,
    });

    const userLocationCache = new UserLocationCache(userId);

    return userLocationCache.getOrigin().then((origin) => {
        let isCacheInvalid = !origin;

        if (!isCacheInvalid) {
            const distanceFromOriginMeters = distanceTo({
                lon: longitude,
                lat: latitude,
            }, {
                lon: origin.longitude,
                lat: origin.latitude,
            });

            // More sensitive invalidation for background location when use is stationary
            isCacheInvalid = distanceFromOriginMeters > (Location.AREA_PROXIMITY_NEARBY_METERS / 4) - 1;
        }

        // Need device token for notifications
        const userPromise = !incompleteHeaders?.userDeviceToken
            ? getCurrentUser(req.headers as any).then((response) => response?.data)
            : Promise.resolve({
                deviceMobileFirebaseToken: userDeviceToken,
            });

        userPromise.then(({
            deviceMobileFirebaseToken,
        }) => {
            const headers: InternalConfigHeaders = {
                ...req.headers as any,
                'x-user-device-token': deviceMobileFirebaseToken,
            };
            // Fetches x nearest areas within y meters of the user's current location (from the users's connections)
            // AREA_PROXIMITY_METERS - More sensitive invalidation for background location when use is stationary
            // TODO: Add some dynamic caching that captures all nearby spaces along with cached newly discoverable areas
            return getAllNearbyAreas(userLocationCache, true, {
                headers,
                userLocation: {
                    longitude,
                    latitude,
                },
                limit: 100,
            }, Location.AREA_PROXIMITY_METERS)
                .then(([nearbyMoments, nearbySpaces]) => {
                    const filteredMoments = nearbyMoments?.newlyDiscoveredAreas;
                    const filteredSpaces = nearbySpaces?.newlyDiscoveredAreas;

                    // Determine isCheckIn synchronously from available space data.
                    // Home detection (async) only gates the nudge notification, not visit recording.
                    // A check-in means the user is stationary within 20m of at least one space.
                    const isCheckIn = (nearbySpaces?.areas || []).some((s) => {
                        const dist = distanceTo(
                            { lon: longitude, lat: latitude },
                            { lon: s.longitude, lat: s.latitude },
                        );
                        return dist <= Location.MAX_DISTANCE_TO_CHECK_IN_METERS;
                    });

                    if (filteredSpaces?.length) {
                        Promise.all([
                            userLocationPromise,
                            getUserLocations(userId, headers),
                        ]).then(([userLocationResponse, allLocationsResponse]) => {
                            const pastLocations = allLocationsResponse?.data?.userLocations || [];
                            const currentLocation = userLocationResponse?.data?.userLocations?.[0];
                            const sortedPastLocations = pastLocations
                                .filter((loc) => !loc.isDeclaredHome)
                                .sort((a, b) => b.visitCount - a.visitCount);
                            const possibleHomesCount = 3;
                            const homeLocations = sortedPastLocations
                                .slice(0, possibleHomesCount); // Assume top 3 are probably home
                            const nonHomeLocations = sortedPastLocations
                                .slice(possibleHomesCount);

                            logSpan({
                                level: 'info',
                                messageOrigin: 'API_SERVER',
                                messages: ['DEBUG non-home locations'],
                                traceArgs: {
                                    brandVariation,
                                    userId,
                                    whiteLabelOrigin,
                                    nonHomeLocations: JSON.stringify(nonHomeLocations || []),
                                },
                            });

                            const userIsNotAtHome = homeLocations.every((homeLocation) => distanceTo({
                                lon: latitude,
                                lat: longitude,
                            }, {
                                lon: homeLocation.longitude,
                                lat: homeLocation.latitude,
                            }) > Location.MAX_DISTANCE_TO_CHECK_IN_METERS);

                            if (userIsNotAtHome && nonHomeLocations?.length) {
                                const possibleSpacesUserIsVisiting: any[] = [];
                                const spacesOrderedByDistance = nearbySpaces?.areas
                                    .map((s) => ({
                                        ...s,
                                        distanceFromUserMeters: distanceTo({
                                            lon: latitude,
                                            lat: longitude,
                                        }, {
                                            lon: s.longitude,
                                            lat: s.latitude,
                                        }),
                                    }))
                                    .sort((a, b) => a.distanceFromUserMeters - b.distanceFromUserMeters);
                                spacesOrderedByDistance.some((space) => {
                                    if (space.distanceFromUserMeters > Location.MAX_DISTANCE_TO_CHECK_IN_METERS) {
                                        return true; // stop without pushing out-of-range space
                                    }
                                    possibleSpacesUserIsVisiting.push(space);
                                    return false;
                                });

                                logSpan({
                                    level: 'info',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['BackgroundGeolocation - DEBUG - Possible spaces visited'],
                                    traceArgs: {
                                        brandVariation,
                                        userId,
                                        whiteLabelOrigin,
                                        possibleSpaces: possibleSpacesUserIsVisiting.map((s) => ({ id: s.id, name: s.notificationMsg })),
                                    },
                                });

                                if (possibleSpacesUserIsVisiting.length) {
                                    // Select the first, closest space by default
                                    const spaceWithRewards = possibleSpacesUserIsVisiting[0];
                                    const now = Date.now();
                                    const msSinceLastNotification = now - (new Date(currentLocation.lastPushNotificationSent || now).getTime());
                                    // eslint-disable-next-line max-len
                                    const shouldSendNotification = !currentLocation.lastPushNotificationSent || msSinceLastNotification > Location.MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS;

                                    if (shouldSendNotification) {
                                        createAppAndPushNotification(
                                            'spaces',
                                            userLocationCache,
                                            headers,
                                            spaceWithRewards.id,
                                            {
                                                area: {
                                                    id: spaceWithRewards.id,
                                                    notificationMsg: spaceWithRewards.notificationMsg,
                                                    fromUserId: spaceWithRewards.fromUserId,
                                                    featuredIncentiveKey: spaceWithRewards.featuredIncentiveKey,
                                                    featuredIncentiveRewardKey: spaceWithRewards.featuredIncentiveRewardKey,
                                                },
                                                possibleSpacesUserIsVisiting: possibleSpacesUserIsVisiting?.slice(0, 3)
                                                    .map((s) => ({
                                                        id: s.id,
                                                        notificationMsg: s.notificationMsg,
                                                        fromUserId: s.fromUserId,
                                                        featuredIncentiveKey: s.featuredIncentiveKey,
                                                        featuredIncentiveRewardKey: s.featuredIncentiveRewardKey,
                                                    })), // Top 3 are most relevant and keeps payload within limits
                                            },
                                            false,
                                            null,
                                            PushNotifications.Types.nudgeSpaceEngagement,
                                        ).then(() => {
                                            logSpan({
                                                level: 'info',
                                                messageOrigin: 'API_SERVER',
                                                messages: ['BackgroundGeolocation - Space engagement nudge sent'],
                                                traceArgs: {
                                                    brandVariation,
                                                    userId,
                                                    whiteLabelOrigin,
                                                    possibleSpaces: possibleSpacesUserIsVisiting
                                                        .map((s) => ({ id: s.id, name: s.notificationMsg })),
                                                    platformOS,
                                                    deviceModel,
                                                    isDeviceTablet,
                                                },
                                            });
                                            // Update userLocations.lastPushNotificationSent
                                            updateUserLocation(currentLocation.id, headers, {
                                                lastPushNotificationSent: new Date(),
                                            });
                                        });
                                    }
                                }
                            }
                        });
                    }

                    // When cache was invalidated (user moved >402m), check for unreviewed visited spaces
                    // and send a post-visit review reminder
                    if (isCacheInvalid && !filteredSpaces?.length) {
                        userLocationCache.getLastSpaceNotificationDate().then((lastNotificationDate) => {
                            if (hasSentNotificationRecently(lastNotificationDate, true)) {
                                return;
                            }

                            // Find spaces user visited but hasn't reviewed yet
                            const postVisitCutoff = new Date(Date.now() - Location.MIN_TIME_BEFORE_POST_VISIT_NOTIFICATION_MS);
                            internalRestRequest({
                                headers,
                            }, {
                                method: 'post',
                                // eslint-disable-next-line max-len
                                url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/space-reactions/find/dynamic`,
                                data: {
                                    userHasActivated: true,
                                    limit: 10,
                                },
                            }).then((reactionsResponse) => {
                                const reactions = reactionsResponse?.data?.reactions || [];
                                // Filter for visited but unreviewed spaces where last visit was >2 hours ago
                                const unreviewedVisits = reactions
                                    .filter(
                                        (r) => r.visitedAt && !r.rating && new Date(r.lastVisitedAt) < postVisitCutoff,
                                    )
                                    .sort((a, b) => new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime());

                                if (unreviewedVisits.length) {
                                    const mostRecentVisit = unreviewedVisits[0];
                                    predictAndSendNotification(
                                        PushNotifications.Types.postVisitReviewReminder,
                                        {
                                            area: {
                                                id: mostRecentVisit.spaceId,
                                            },
                                        },
                                        {
                                            deviceToken: headers['x-user-device-token'] || '',
                                            userId: headers['x-userid'] || '',
                                            userLocale: headers['x-localecode'] || 'en-us',
                                        },
                                        {},
                                        headers['x-brand-variation'] as any,
                                    );
                                    userLocationCache.setLastSpaceNotificationDate(); // fire and forget
                                }
                            }).catch((err) => {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['Post-visit review reminder check failed'],
                                    traceArgs: {
                                        'error.message': err?.message,
                                    },
                                });
                            });
                        });
                    }

                    return selectAreasAndActivate(
                        headers,
                        userLocationCache,
                        {
                            longitude,
                            latitude,
                        },
                        filteredMoments,
                        filteredSpaces,
                        isCheckIn,
                    );
                })
                .then(([momentsToActivate, spacesToActivate]) => {
                    logSpan({
                        level: 'info',
                        messageOrigin: 'API_SERVER',
                        messages: ['BackgroundGeolocation - Background areas activated'],
                        traceArgs: {
                            brandVariation,
                            userId,
                            whiteLabelOrigin,
                            totalMomentsActivated: momentsToActivate?.length,
                            totalSpacesActivated: spacesToActivate?.length,
                            platformOS,
                            deviceModel,
                            isDeviceTablet,
                        },
                    });

                    return res.status(200).send();
                })
                .catch((err) => {
                    handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' });

                    // Always return a 200 to BackgroundGeolocation plugin
                    return res.status(200).send();
                });
        });
    });
};

export {
    processUserLocationChange,
    processUserBackgroundLocation,
};
