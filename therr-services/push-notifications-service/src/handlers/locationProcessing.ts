import { Location } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import { distanceTo } from 'geolocation-utils';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import UserLocationCache from '../store/UserLocationCache';
import {
    getAllNearbyAreas,
    selectAreasAndActivate,
} from './helpers/areaLocationHelpers';
import { createUserLocation } from './helpers/userLocations';
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
    const formattedDetails = {
        event: location?.event,
        isMoving: location?.is_moving,
        isBatteryCharging: location?.battery.is_charging,
        coords: {
            latitude: location?.coords.latitude,
            longitude: location?.coords.longitude,
        },
        timestamp: location?.timestamp,
    };

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['BackgroundGeolocation - DEBUG'],
        traceArgs: {
            'background.body': JSON.stringify(formattedDetails),
            brandVariation,
            userId,
            whiteLabelOrigin,
            deviceModel,
            isDeviceTablet,
            platformOS,
        },
    });

    const latitude = location?.coords.latitude;
    const longitude = location?.coords.longitude;

    if (location?.is_moving || !latitude || !longitude) {
        return res.status(200).send();
    }

    // TODO: send check-in push notification if isMoving is false and location is not user's top 5 or already visited
    // See BackgroundGeolocation.stopTimeout which is set to 5 minutes
    // This means the user has stopped at a location for at least 5 minutes

    createUserLocation(userId, headers, {
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
