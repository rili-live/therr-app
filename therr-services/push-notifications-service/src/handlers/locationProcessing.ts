import { Location, PushNotifications } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import { distanceTo } from 'geolocation-utils';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import UserLocationCache from '../store/UserLocationCache';
import {
    createAppAndPushNotification,
    getAllNearbyAreas,
    selectAreasAndActivate,
} from './helpers/areaLocationHelpers';
import { createUserLocation, getUserLocation, updateUserLocation } from './helpers/userLocations';
// import translate from '../utilities/translator';

// CREATE/UPDATE
const processUserLocationChange: RequestHandler = (req, res) => {
    const {
        authorization,
        brandVariation,
        locale,
        userId,
        userDeviceToken,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const headers = {
        authorization,
        brandVariation,
        locale,
        userId,
        userDeviceToken,
        whiteLabelOrigin,
    };

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
            headers,
            userLocation: {
                longitude,
                latitude,
            },
            limit: 100,
        })
            .then(([filteredMoments, filteredSpaces]) => selectAreasAndActivate(
                headers,
                userLocationCache,
                {
                    longitude,
                    latitude,
                },
                filteredMoments,
                filteredSpaces,
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

    const headers = {
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

    const userLocationPromise = createUserLocation(userId, headers, {
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

        // Fetches x nearest areas within y meters of the user's current location (from the users's connections)
        // AREA_PROXIMITY_METERS - More sensitive invalidation for background location when use is stationary
        return getAllNearbyAreas(userLocationCache, isCacheInvalid, {
            headers,
            userLocation: {
                longitude,
                latitude,
            },
            limit: 100,
        }, Location.AREA_PROXIMITY_METERS)
            .then(([filteredMoments, filteredSpaces]) => {
                if (filteredSpaces?.length) {
                    Promise.all([
                        userLocationPromise,
                        getUserLocation(userId, headers),
                    ]).then(([userLocationResponse, allLocationsResponse]) => {
                        const locations = allLocationsResponse?.data?.userLocations || [];
                        const currentLocation = userLocationResponse?.data?.userLocations?.[0];
                        // Assume top 3 are probably home
                        const nonHomeLocations = locations
                            .filter((loc) => !loc.isDeclaredHome)
                            .sort((a, b) => b.visitCount - a.visitCount)
                            .slice(0);
                        if (nonHomeLocations?.length) {
                            const possibleSpacesUserIsVisiting: any[] = [];
                            const spacesOrderedByDistance = filteredSpaces
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
                                possibleSpacesUserIsVisiting.push(space);
                                // stop when user is out of range of remaining spaces
                                return space.distanceFromUserMeters > Location.MAX_DISTANCE_TO_CHECK_IN_METERS;
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
                                // Use possibleSpacesUserIsVisiting
                                // TODO: Filter out spaces that do not offer rewards and user has already received notification
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
                                            area: spaceWithRewards,
                                            possibleSpacesUserIsVisiting: possibleSpacesUserIsVisiting?.slice(0, 3),
                                        },
                                        false, // TODO: Support checking in and/or posting after leaving a spaces
                                        PushNotifications.Types.nudgeSpaceEngagement, // TODO: Create a new push notification type
                                    ).then(() => {
                                        logSpan({
                                            level: 'info',
                                            messageOrigin: 'API_SERVER',
                                            messages: ['BackgroundGeolocation - Space engagement nudge sent'],
                                            traceArgs: {
                                                brandVariation,
                                                userId,
                                                whiteLabelOrigin,
                                                possibleSpaces: possibleSpacesUserIsVisiting.map((s) => ({ id: s.id, name: s.notificationMsg })),
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

                return selectAreasAndActivate(
                    headers,
                    userLocationCache,
                    {
                        longitude,
                        latitude,
                    },
                    filteredMoments,
                    filteredSpaces,
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
};

export {
    processUserLocationChange,
    processUserBackgroundLocation,
};
