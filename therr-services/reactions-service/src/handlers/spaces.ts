import axios from 'axios';
import { distanceTo } from 'geolocation-utils';
import { parseHeaders } from 'therr-js-utilities/http';
import { getReadableDistance } from 'therr-js-utilities/location';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

const searchActiveSpaces = async (req: any, res: any) => {
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

    // TODO: Debug limit where public thoughts exceed reactions causing reactions to be missing during pagination
    // Get reactions should use a lastContentCreatedAt that excludes public thoughts with no reactions
    return Store.spaceReactions.get(conditions, undefined, {
        limit,
        offset,
        order: order || 0,
    }, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const spaceIdToReaction = reactions?.reduce((acc, cur) => ({
                ...acc,
                [cur.spaceId]: cur,
            }), {});
            const spaceIds = reactions?.map((reaction) => reaction.spaceId) || [];

            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/spaces/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    spaceIds,
                    limit,
                    order,
                    withMedia,
                    withUser,
                    lastContentCreatedAt,
                    isDraft: false,
                },
            })
                .then(async (response) => {
                    let spaces = response?.data?.spaces;
                    const results = await Store.spaceReactions.getCounts(spaces.map((m) => m.id), {}, 'userHasLiked');
                    const likeCountBySpaceId = results.reduce((acc, cur) => ({
                        ...acc,
                        [cur.spaceId]: cur.count,
                    }), {});
                    spaces = spaces.map((space) => {
                        const alteredSpace = space;
                        if (userLatitude && userLongitude) {
                            const distance = distanceTo({
                                lon: space.longitude,
                                lat: space.latitude,
                            }, {
                                lon: userLongitude,
                                lat: userLatitude,
                            }) / 1069.344; // convert meters to miles
                            alteredSpace.distance = getReadableDistance(distance);
                        }
                        return {
                            ...alteredSpace,
                            reaction: spaceIdToReaction[space.id] || {},
                            likeCount: parseInt(likeCountBySpaceId[space.id] || 0, 10),
                        };
                    }).filter((space) => !blockedUsers.includes(space.fromUserId));
                    return res.status(200).send({
                        spaces,
                        media: response?.data?.media,
                        pagination: {
                            itemsPerPage: limit,
                            offset,
                            isLastPage: reactions.length < limit && response?.data?.spaces?.length < limit,
                        },
                    });
                });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

const searchActiveSpacesByIds = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        spaceIds,
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

    return Store.spaceReactions.get(conditions, spaceIds, undefined, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const activatedSpaceIds = reactions?.map((reaction) => reaction.spaceId) || [];

            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/spaces/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    spaceIds: activatedSpaceIds,
                    limit: 100,
                    order: 'DESC',
                    withMedia,
                    withUser,
                    lastContentCreatedAt: new Date(),
                },
            });
        })
        .then((response) => {
            let spaces = response?.data?.spaces;
            spaces = spaces.map((space) => {
                const alteredSpace = space;
                if (userLatitude && userLongitude) {
                    const distance = distanceTo({
                        lon: space.longitude,
                        lat: space.latitude,
                    }, {
                        lon: userLongitude,
                        lat: userLatitude,
                    }) / 1069.344; // convert meters to miles
                    alteredSpace.distance = getReadableDistance(distance);
                }
                return {
                    ...alteredSpace,
                    reaction: reactions.find((reaction) => reaction.spaceId === space.id) || {},
                };
            }).filter((space) => !blockedUsers.includes(space.fromUserId));
            return res.status(200).send({
                spaces,
                media: response?.data?.media,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

const searchBookmarkedSpaces = async (req: any, res: any) => {
    req.body.withBookmark = true;

    return searchActiveSpaces(req, res);
};

export {
    searchActiveSpaces,
    searchActiveSpacesByIds,
    searchBookmarkedSpaces,
};
