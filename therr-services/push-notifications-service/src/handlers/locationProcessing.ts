import { Location } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import { distanceTo } from 'geolocation-utils';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import UserLocationCache from '../store/UserLocationCache';
import {
    getAllNearbyAreas,
    selectAreasToActivate,
} from './helpers/areaLocationHelpers';
// import translate from '../utilities/translator';

// CREATE/UPDATE
const processUserLocationChange: RequestHandler = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        userDeviceToken,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const headers = {
        authorization,
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
            .then(([filteredMoments, filteredSpaces]) => selectAreasToActivate(
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
        brandVariation,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        location,
    } = req.body;
    const formattedDetails = {
        event: location?.event,
        isMoving: location?.is_moving,
        isBatteryCharging: location?.battery.is_charging,
        coords: {
            latitude: location?.coords.latitude,
            longitude: location?.coords.longitude,
        },
        timestamp: location.timestamp,
    };
    // TODO: send push notification is isMoving is false and location is not user's top 5 or already visited
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['BackgroundGeolocation - DEBUG'],
        traceArgs: {
            'background.body': JSON.stringify(formattedDetails),
            brandVariation,
            userId,
            whiteLabelOrigin,
        },
    });

    return res.status(200).send();
};

export {
    processUserLocationChange,
    processUserBackgroundLocation,
};
