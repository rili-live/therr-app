import { Location } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import { distanceTo } from 'geolocation-utils';
import handleHttpError from '../utilities/handleHttpError';
import UserLocationCache from '../store/UserLocationCache';
import { activateMoments, getNearbyMoments } from './helpers/locationHelpers';
// import translate from '../utilities/translator';

// CREATE/UPDATE
const processUserLocationChange: RequestHandler = (req, res) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const userDeviceToken = req.headers['x-user-device-token'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const headers = {
        authorization,
        locale,
        userId,
        userDeviceToken: (userDeviceToken as string),
    };

    const {
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

            isCacheInvalid = distanceFromOriginMeters > Location.MOMENT_PROXIMITY_EXPANDED_METERS - 1;
        }

        // Fetches x nearest moments within y meters of the user's current location (from the users's connections)
        return getNearbyMoments(userLocationCache, isCacheInvalid, {
            headers,
            userLocation: {
                longitude,
                latitude,
            },
            limit: 100,
        })
            .then((filteredMoments) => {
                const momentIdsToActivate: number[] = [];
                // NOTE: only activate 'x' moments max to limit high density locations
                for (let i = 0; i <= Location.MAX_MOMENT_ACTIVATE_COUNT && i <= filteredMoments.length - 1; i += 1) {
                    momentIdsToActivate.push(filteredMoments[i].id);
                }

                // Fire and forget (create or update)
                if (filteredMoments.length) {
                    activateMoments(headers, filteredMoments, momentIdsToActivate, userLocationCache);
                }
                userLocationCache.removeMoments(momentIdsToActivate, {
                    locale,
                    userId,
                    userDeviceToken,
                });

                return filteredMoments;
            })
            .then((filteredMoments) => res.status(200).send({
                activatedMoments: filteredMoments,
            }))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
    });
};

export {
    processUserLocationChange,
};
