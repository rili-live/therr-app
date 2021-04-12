import axios from 'axios';
import { Location } from 'therr-js-utilities/constants';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { RequestHandler } from 'express';
import handleHttpError from '../utilities/handleHttpError';
import { predictAndSendNotification, PushNotificationTypes } from '../api/firebaseAdmin';
// import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const processUserLocationChange: RequestHandler = (req, res) => {
    const userId = req.headers['x-userid'];
    const userDeviceToken = req.headers['x-user-device-token'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const {
        latitude,
        longitude,
        // lastLocationSendForProcessing,
    } = req.body;

    // TODO: RMOBILE-24 - Calculate distanceFromOrigin and use for caching determinations

    const query = {
        query: 'connections',
        itemsPerPage: 100,
        pageNumber: 1,
        order: 'desc',
        filterBy: 'fromUserIds',
        latitude,
        longitude,
    };

    const queryString = getSearchQueryString(query);

    // Fetches x nearest moments within y meters of the user's current location (from the users's connections)
    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/moments/search${queryString}`,
        headers: {
            authorization: req.headers.authorization,
            'x-localecode': locale,
            'x-userid': userId,
        },
        data: {
            distanceOverride: Location.MOMENT_PROXIMITY_EXPANDED_METERS,
        },
    })
        .then((momentsResponse) => {
            const moments = momentsResponse?.data?.results || [];

            if (!moments.length) {
                return [];
            }

            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/find/dynamic`,
                headers: {
                    authorization: req.headers.authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                },
                data: {
                    limit: 100,
                    momentIds: moments.map((moment: any) => moment.id) || [],
                },
            }).then((reactionsResponse) => {
                const reactions = reactionsResponse?.data || [];
                let greatestProximityDistanceRequired = Location.MOMENT_PROXIMITY_EXPANDED_METERS; // TODO: Cache in association with userId
                let hasSentNotification = false;

                // Only interested in reactions that have not been activated
                // TODO: Verify proximity is met
                const filteredMoments = moments.filter((moment) => {
                    const momentRequiredProximity = moment.radius + moment.maxProximity;
                    if (momentRequiredProximity > 0) {
                        if (greatestProximityDistanceRequired === Location.MOMENT_PROXIMITY_EXPANDED_METERS) {
                            greatestProximityDistanceRequired = momentRequiredProximity;
                        } else {
                            greatestProximityDistanceRequired = Math.max(greatestProximityDistanceRequired, momentRequiredProximity);
                        }
                    }

                    // Unique moments
                    if (moment.doesRequiredProximityView) {
                        if (!hasSentNotification) {
                            predictAndSendNotification(
                                PushNotificationTypes.proximityRequiredMoment,
                                {
                                    moment,
                                },
                                {
                                    deviceToken: userDeviceToken,
                                    userId,
                                },
                            );

                            hasSentNotification = true;
                        }

                        return false; // Filter out these moments
                    }

                    return !reactions.find((reaction) => reaction.momentId === moment.id && reaction.userHasActivated);
                });

                return filteredMoments;
            });
        })
        // TODO: Update moments to "soft" activated, ignore doesRequireProximityView
        .then((filteredMoments) => {
            const promises: Promise<any>[] = [];
            let totalMomentsActivated = 0;
            // NOTE: only active 5 moments max to limit high density locations
            for (let i = 0; i < 5 && i < filteredMoments.length - 1; i += 1) {
                totalMomentsActivated += 1;
                const promise: any = axios({
                    method: 'post',
                    url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/moment-reactions/${filteredMoments[i].id}`,
                    headers: {
                        authorization: req.headers.authorization,
                        'x-localecode': locale,
                        'x-userid': userId,
                    },
                    data: {
                        userHasActivated: true,
                    },
                });

                promises.push(promise);
            }

            // Fire and forget
            Promise.all(promises)
                .then(() => {
                    // TODO: Only send if hasn't recently send notification
                    predictAndSendNotification(
                        PushNotificationTypes.newMomentsActivated,
                        {
                            momentsActivated: filteredMoments.slice(0, totalMomentsActivated),
                        },
                        {
                            deviceToken: userDeviceToken,
                            userId,
                            totalMomentsActivated,
                        },
                    );
                })
                .catch((err) => {
                    console.log('WARNING WARNING WARNING: Moment activation is failing!', err);
                });

            return filteredMoments;
        })
        .then((filteredMoments) => res.status(200).send({
            activatedMoments: filteredMoments,
        }))
        .catch((err) => {
            console.log(err.response);
            return handleHttpError({ err, res, message: 'SQL:MOMENT_PUSH_NOTIFICATIONS_ROUTES:ERROR' });
        });
};

export {
    processUserLocationChange,
};
