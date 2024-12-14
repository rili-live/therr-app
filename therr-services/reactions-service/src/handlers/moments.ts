import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { distanceTo } from 'geolocation-utils';
import { parseHeaders } from 'therr-js-utilities/http';
import { getReadableDistance } from 'therr-js-utilities/location';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

const searchActiveMoments = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        limit,
        offset,
        order,
        blockedUsers,
        shouldHideMatureContent,
        withMedia,
        withUser,
        withBookmark,
        userLatitude,
        userLongitude, // TODO: Fetch coords from user redis store instead?
        lastContentCreatedAt,
        authorId,
    } = req.body;

    const conditions: any = {
        userId,
        userHasActivated: true,
    };

    // Hide reported content
    if (shouldHideMatureContent) {
        conditions.userHasReported = false;
    }

    const customs: any = {};
    if (withBookmark) {
        customs.withBookmark = true;
    }

    // TODO: Rather than offset, this should have a last moment id and filter for results earlier than that
    return Store.momentReactions.get(conditions, undefined, {
        limit,
        offset,
        order: order || 0,
    }, customs)
        .then((reactionsResponse) => {
            const reactions = reactionsResponse;
            const momentIdToReaction = reactions?.reduce((acc, cur) => ({
                ...acc,
                [cur.momentId]: cur,
            }), {});
            const momentIds = reactions?.map((reaction) => reaction.momentId) || [];

            // TODO: Add way to search by authorId
            return internalRestRequest({
                headers: req.headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/moments/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    momentIds,
                    limit,
                    order,
                    withMedia,
                    withUser,
                    lastContentCreatedAt,
                    authorId,
                    isDraft: false,
                },
            })
                .then(async (response) => {
                    let moments = response?.data?.moments;
                    const results = await Store.momentReactions.getCounts(moments.map((m) => m.id), {}, 'userHasLiked');
                    const likeCountByMomentId = results.reduce((acc, cur) => ({
                        ...acc,
                        [cur.momentId]: cur.count,
                    }), {});
                    moments = moments.map((moment) => {
                        const alteredMoment = moment;
                        if (userLatitude && userLongitude) {
                            const distance = distanceTo({
                                lon: moment.longitude,
                                lat: moment.latitude,
                            }, {
                                lon: userLongitude,
                                lat: userLatitude,
                            }) / 1069.344; // convert meters to miles
                            alteredMoment.distance = getReadableDistance(distance);
                        }
                        return {
                            ...alteredMoment,
                            reaction: momentIdToReaction[moment.id] || {},
                            likeCount: parseInt(likeCountByMomentId[moment.id] || 0, 10),
                        };
                    }).filter((moment) => !blockedUsers.includes(moment.fromUserId));
                    return res.status(200).send({
                        moments,
                        media: response?.data?.media,
                        pagination: {
                            itemsPerPage: limit,
                            offset,
                            isLastPage: reactions.length < limit && response?.data?.moments?.length < limit,
                        },
                    });
                });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

const searchActiveMomentsByIds = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        momentIds,
        blockedUsers,
        shouldHideMatureContent,
        withMedia,
        withUser,
        withBookmark,
        userLatitude,
        userLongitude, // TODO: Fetch coords from user redis store instead?
    } = req.body;

    const conditions: any = {
        userId,
        userHasActivated: true,
    };

    // Hide reported content
    if (shouldHideMatureContent) {
        conditions.userHasReported = false;
    }

    const customs: any = {};
    if (withBookmark) {
        customs.withBookmark = true;
    }

    let reactions;

    return Store.momentReactions.get(conditions, momentIds, undefined, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const activatedMomentIds = reactions?.map((reaction) => reaction.momentId) || [];

            return internalRestRequest({
                headers: req.headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/moments/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    momentIds: activatedMomentIds,
                    limit: 100,
                    order: 'DESC',
                    withMedia,
                    withUser,
                    lastContentCreatedAt: new Date(),
                },
            });
        })
        .then((response) => {
            let moments = response?.data?.moments;
            moments = moments.map((moment) => {
                const alteredMoment = moment;
                if (userLatitude && userLongitude) {
                    const distance = distanceTo({
                        lon: moment.longitude,
                        lat: moment.latitude,
                    }, {
                        lon: userLongitude,
                        lat: userLatitude,
                    }) / 1069.344; // convert meters to miles
                    alteredMoment.distance = getReadableDistance(distance);
                }
                return {
                    ...alteredMoment,
                    reaction: reactions.find((reaction) => reaction.momentId === moment.id) || {},
                };
            }).filter((moment) => !blockedUsers.includes(moment.fromUserId));
            return res.status(200).send({
                moments,
                media: response?.data?.media,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

const searchBookmarkedMoments = async (req: any, res: any) => {
    req.body.withBookmark = true;

    return searchActiveMoments(req, res);
};

export {
    searchActiveMoments,
    searchActiveMomentsByIds,
    searchBookmarkedMoments,
};
