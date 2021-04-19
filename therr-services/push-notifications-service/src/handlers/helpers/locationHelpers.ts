import axios from 'axios';
import { distanceTo } from 'geolocation-utils';
import { Location } from 'therr-js-utilities/constants';
import { getSearchQueryString } from 'therr-js-utilities/http';
import beeline from '../../beeline';
import UserLocationCache from '../../store/UserLocationCache';
import { predictAndSendNotification, PushNotificationTypes } from '../../api/firebaseAdmin';
import * as globalConfig from '../../../../../global-config';

interface IHeaders {
    authorization: any;
    locale: any;
    userId: any;
    userDeviceToken: string;
}

export interface IUserlocation {
    longitude: number;
    latitude: number;
}

interface IMomentGetSettings {
    headers: IHeaders;
    userLocation: IUserlocation;
    limit: number;
}

const canActivateMoment = (moment, userLocation: IUserlocation) => {
    const momentRequiredProximityMeters = moment.radius + moment.maxProximity;

    const distToCenter = distanceTo({
        lon: moment.longitude,
        lat: moment.latitude,
    }, {
        lon: userLocation.longitude,
        lat: userLocation.latitude,
    });

    return distToCenter - momentRequiredProximityMeters <= 0;
};

const hasSentNotificationRecently = (lastNotificationDate) => lastNotificationDate
    && (Date.now() - lastNotificationDate < Location.MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS);

const filterNearbyMoments = (moments, userLocationCache: UserLocationCache, headers: IHeaders, userLocation: IUserlocation) => {
    if (!moments.length) {
        return Promise.resolve([]);
    }

    // Find associated reactions for/to the nearby moments
    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/find/dynamic`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data: {
            limit: moments.length,
            momentIds: moments.map((moment: any) => moment.id) || [],
        },
    })
        .then((reactionsResponse) => {
            beeline.addContext({
                message: 'Start date cache lookup for last sent push notification',
                context: 'redis',
                significance: 'helps prevent excessive push notifications for location moment activations',
            });

            return userLocationCache.getLastNotificationDate()
                .then((lastNotificationDate) => [reactionsResponse, lastNotificationDate]);
        })
        .then(([reactionsResponse, lastNotificationDate]: any[]) => {
            const reactions = reactionsResponse?.data?.reactions || [];
            // TODO: RDATA-3 - Determine smart rules around sending push notifications
            let shouldSkipNotification = hasSentNotificationRecently(lastNotificationDate);
            const cacheableMoments: any[] = [];
            let maxActivationDistance = Location.MOMENT_PROXIMITY_METERS;

            // Only interested in reactions that have not been activated
            const filteredMoments = moments.filter((moment) => {
                maxActivationDistance = Math.max(maxActivationDistance, (moment.radius + moment.maxProximity));
                const userIsCloseEnough = canActivateMoment(moment, userLocation);

                // Unique moments
                if (moment.doesRequireProximityView) { // Requires manual interaction (by clicking)
                    if (!shouldSkipNotification) {
                        userLocationCache.setLastNotificationDate(); // fire and forget
                        predictAndSendNotification(
                            PushNotificationTypes.proximityRequiredMoment,
                            {
                                moment,
                            },
                            {
                                deviceToken: headers.userDeviceToken,
                                userId: headers.userId,
                                userLocale: headers.locale,
                            },
                            {
                                lastNotificationDate,
                            },
                        );

                        shouldSkipNotification = true;
                    }

                    return false; // Filter out these moments from being automatically-activated
                }

                const hasAlreadyActivated = reactions.find((reaction) => reaction.momentId === moment.id && reaction.userHasActivated);

                if (hasAlreadyActivated) {
                    return false;
                }

                // Only cache moments that have not already been viewed and do not require manual activation
                cacheableMoments.push(moment);

                return userIsCloseEnough;
            });

            // fire and forget
            userLocationCache.setMaxActivationDistance(maxActivationDistance);

            // fire and forget
            userLocationCache.addMoments(cacheableMoments, {
                locale: headers.locale,
                userDeviceToken: headers.userDeviceToken,
                userId: headers.userId,
            });

            return filteredMoments;
        });
};

const fetchNearbyMoments = (userLocationCache: UserLocationCache, {
    headers,
    userLocation,
    limit,
}: IMomentGetSettings) => {
    // Creates/Resets the origin each time we re-fetch moments
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
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/moments/search${getSearchQueryString(query)}`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data: {
            distanceOverride: Location.MOMENT_PROXIMITY_EXPANDED_METERS,
        },
    })
        .then((momentsResponse) => (momentsResponse?.data?.results || [])) // relevant moments within x meters
        .then((moments) => filterNearbyMoments(moments, userLocationCache, headers, userLocation));
};

const getCachedNearbyMoments = (userLocationCache: UserLocationCache, {
    headers,
    userLocation,
    limit,
}: IMomentGetSettings) => userLocationCache.getMaxActivationDistance()
    .then((maxDistance) => {
        // NOTE: User cached max to only search moments that a user could possibly be close enough to activate
        const radius = maxDistance ? Number(maxDistance) : Location.FALLBACK_CACHE_SEARCH_RADIUS_METERS;

        return userLocationCache.getMomentsWithinDistance(userLocation, radius, {
            locale: headers.locale,
            userDeviceToken: headers.userDeviceToken,
            userId: headers.userId,
            limit,
        });
    });

const getNearbyMoments = (userLocationCache: UserLocationCache, shouldInvalidateCache: boolean, {
    headers,
    userLocation,
    limit,
}: IMomentGetSettings) => {
    if (shouldInvalidateCache) {
        userLocationCache.invalidateCache();

        return fetchNearbyMoments(userLocationCache, {
            headers,
            userLocation,
            limit,
        });
    }

    return getCachedNearbyMoments(userLocationCache, {
        headers,
        userLocation,
        limit,
    });
};

const activateMoments = (
    headers: IHeaders,
    moments: any[],
    activatedMomentIds: number[],
    userLocationCache: UserLocationCache,
) => axios({
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
})
    .then(() => userLocationCache.getLastNotificationDate())
    .then((lastNotificationDate: any) => {
        if (!hasSentNotificationRecently(lastNotificationDate)) {
            return predictAndSendNotification(
                PushNotificationTypes.newMomentsActivated,
                {
                    momentsActivated: moments.slice(0, activatedMomentIds.length),
                },
                {
                    deviceToken: headers.userDeviceToken,
                    userId: headers.userId,
                    userLocale: headers.locale,
                    totalMomentsActivated: activatedMomentIds.length,
                },
                {
                    lastNotificationDate,
                },
            );
        }
    })
    .catch((err) => {
        console.log('WARNING WARNING WARNING: Moment activation is failing!', err);
    });

export {
    activateMoments,
    getNearbyMoments,
};
