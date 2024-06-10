import axios from 'axios';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import * as globalConfig from '../../../../global-config';
import Store from '../store';

// READ
const getNearbyConnections = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        distanceMeters,
    } = req.params;
    const distanceOrDefault = distanceMeters || '96560.6'; // ~60 miles converted to meters

    return axios({
        method: 'get',
        // eslint-disable-next-line max-len
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections/ranked?distanceMeters=${distanceOrDefault}`,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
    }).then((response) => res.status(201).send(response.data))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:ACTITIES_ROUTES:ERROR' }));
};

// WRITE
const generateActivity = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        distanceMeters,
        groupSize,
        interestsCount,
        latitude,
        longitude,
    } = req.body;
    const groupSizeOrDefault = groupSize || 3;
    const distanceOrDefault = distanceMeters || 96560.6; // ~60 miles converted to meters
    const MAX_INTERESTS_COUNT = interestsCount || 10; // Helps focus on top interests only
    // eslint-disable-next-line max-len
    let url = `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections/ranked?groupSize=${groupSizeOrDefault}&distanceMeters=${distanceOrDefault}`;

    if (latitude && longitude) {
        url = `${url}&latitude=${latitude}&longitude=${longitude}`;
    }

    const getRankedConnectionsPromise = axios({
        method: 'get',
        url,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
    });
    // TODO: Fetch potential connections (for results with no existing connections nearby)
    const getSuggestedConnectionsPromise = Promise.resolve({});

    return Promise.all([
        getRankedConnectionsPromise,
        getSuggestedConnectionsPromise,
    ]).then(([rankedResponse, suggestedResponse]) => {
        // Filter for the top connections to satisfy group size
        // TODO: Continue pagination if group size is not satisfied
        const ownUserDetails = rankedResponse?.data?.requestingUserDetails;
        if (!ownUserDetails) {
            // This should never happen
            return handleHttpError({
                res,
                message: 'No requesting user details',
                statusCode: 400,
            });
        }
        const connectionRecommendations = [];
        const topConnections = rankedResponse.data?.results?.map((result) => ({
            interactionCount: result.interactionCount,
            requestStatus: result.requestStatus,
            isConnectionBroken: result.isConnectionBroken,
            updatedAt: result.updatedAt,
            user: result?.users?.find((u) => u.id !== userId) || {},
        })).slice(0, groupSizeOrDefault);
        const topConnectionIds = topConnections.map((con) => con.user.id);

        // Filter interests to apply only to the context of the relevant, top connections
        const sharedInterestsById = {};
        Object.keys(rankedResponse.data?.sharedInterests || {}).forEach((id, index) => {
            const interest = rankedResponse.data?.sharedInterests[id];
            interest?.users?.forEach((u) => {
                if (!topConnectionIds?.length || topConnectionIds?.includes(u.id)) {
                    sharedInterestsById[id] = {
                        displayNameKey: interest.displayNameKey,
                        emoji: interest.emoji,
                        ranking: (sharedInterestsById[id]?.ranking || 0) + u.ranking,
                    };
                }
            });
        });

        // Sort interests by ranking (highest to lowest)
        const sortedInterestsNameKeys: string[] = [];
        const topSharedInterests = {};
        Object.keys(sharedInterestsById).map((id) => ({
            id,
            ...sharedInterestsById[id],
        })).sort((a, b) => b.ranking - a.ranking).some((interest, index) => {
            topSharedInterests[interest.id] = interest;
            sortedInterestsNameKeys.push(interest.displayNameKey);

            return (index + 1) >= MAX_INTERESTS_COUNT;
        });
        const topConnectionsAndYou: any = [
            ...topConnections,
            {
                user: {
                    lastKnownLatitude: ownUserDetails.lastKnownLatitude,
                    lastKnownLongitude: ownUserDetails.lastKnownLongitude,
                },
            },
        ];
        const userCoordinates = topConnectionsAndYou
            .map((con) => ([con.user.lastKnownLatitude, con.user.lastKnownLongitude]))
            .filter((coords) => coords[0] && coords[1]); // only use for users where coords are set/defined

        if (!userCoordinates?.length) {
            return handleHttpError({
                res,
                message: 'No users with valid coordinates',
                statusCode: 400,
            });
        }

        // Use sorted interests and top users to find spaces nearby that would be most interesting for a meetup/hangout/event
        return Store.spaces.searchRelatedSpaces(userCoordinates, sortedInterestsNameKeys, {
            distanceOverride: distanceOrDefault,
            requestorLatitude: ownUserDetails.lastKnownLatitude,
            requestorLongitude: ownUserDetails.lastKnownLongitude,
        })
            .then((spaceResults) => {
                const sanitizedSpaceResults = spaceResults.map((r) => {
                    // eslint-disable-next-line no-param-reassign
                    delete r.geom;
                    return r;
                });
                return res.status(201).send({
                    connectionRecommendations,
                    topConnections,
                    topSharedInterests,
                    topSpaces: sanitizedSpaceResults,
                });
            });
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:ACTITIES_ROUTES:ERROR' }));
};

export {
    generateActivity,
    getNearbyConnections,
};
