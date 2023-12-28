import { Location } from 'therr-js-utilities/constants';
import { RequestHandler } from 'express';
import { distanceTo } from 'geolocation-utils';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import UserLocationCache from '../store/UserLocationCache';
import { activateAreasAndNotify, getAllNearbyAreas } from './helpers/areaLocationHelpers';
import { updateAchievements } from './helpers/updateAchievements';
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
            .then(([filteredMoments, filteredSpaces]) => {
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
                            'user.id': userId,
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
                            'user.id': userId,
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
                        {
                            longitude,
                            latitude,
                        },
                    );

                    updateAchievements(headers, momentIdsToActivate, spaceIdsToActivate);

                    userLocationCache.removeMoments(momentIdsToActivate, {
                        locale,
                        userId,
                        userDeviceToken,
                    });

                    userLocationCache.removeMoments(spaceIdsToActivate, {
                        locale,
                        userId,
                        userDeviceToken,
                    });
                }

                return [momentsToActivate, filteredSpaces];
            })
            .then(([filteredMoments, spacesToActivate]) => res.status(200).send({
                activatedAreas: [spacesToActivate, ...filteredMoments],
            }))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' }));
    });
};

export {
    processUserLocationChange,
};
