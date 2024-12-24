import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { distanceTo } from 'geolocation-utils';
import { parseHeaders } from 'therr-js-utilities/http';
import { getReadableDistance } from 'therr-js-utilities/location';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

const searchActiveEvents = async (req: any, res: any) => {
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

    let reactions;

    // TODO: Rather than offset, this should have a last event id and filter for results earlier than that
    return Store.eventReactions.get(conditions, undefined, undefined, {
        limit,
        offset,
        order: order || 0,
    }, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const eventIdToReaction = reactions?.reduce((acc, cur) => ({
                ...acc,
                [cur.eventId]: cur,
            }), {});
            const eventIds = reactions?.map((reaction) => reaction.eventId) || [];

            // TODO: Add way to search by authorId
            return internalRestRequest({
                headers: req.headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/events/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    eventIds,
                    limit,
                    order,
                    withMedia,
                    withUser,
                    lastContentCreatedAt,
                    authorId,
                    isDraft: false,
                },
            }).then(async (response) => {
                let events = response?.data?.events;
                const results = await Store.eventReactions.getCounts(events.map((m) => m.id), {}, 'userHasLiked');
                const likeCountByEventId = results.reduce((acc, cur) => ({
                    ...acc,
                    [cur.eventId]: cur.count,
                }), {});
                events = events.map((event) => {
                    const alteredEvent = event;
                    if (userLatitude && userLongitude) {
                        const distance = distanceTo({
                            lon: event.longitude,
                            lat: event.latitude,
                        }, {
                            lon: userLongitude,
                            lat: userLatitude,
                        }) / 1069.344; // convert meters to miles
                        alteredEvent.distance = getReadableDistance(distance);
                    }
                    return {
                        ...alteredEvent,
                        reaction: eventIdToReaction[event.id] || {},
                        likeCount: parseInt(likeCountByEventId[event.id] || 0, 10),
                    };
                }).filter((event) => !blockedUsers.includes(event.fromUserId));
                return res.status(200).send({
                    events,
                    media: response?.data?.media,
                    pagination: {
                        itemsPerPage: limit,
                        offset,
                        isLastPage: reactions.length < limit && response?.data?.events?.length < limit,
                    },
                });
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENTMOMENT_REACTIONS_ROUTES:ERROR' }));
};

const searchActiveEventsByIds = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        eventIds,
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

    return Store.eventReactions.get(conditions, eventIds, undefined, undefined, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const activatedEventIds = reactions?.map((reaction) => reaction.eventId) || [];

            return internalRestRequest({
                headers: req.headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/events/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    eventIds: activatedEventIds,
                    limit: 100,
                    order: 'DESC',
                    withMedia,
                    withUser,
                    lastContentCreatedAt: new Date(),
                },
            });
        })
        .then((response) => {
            let events = response?.data?.events;
            events = events.map((event) => {
                const alteredEvent = event;
                if (userLatitude && userLongitude) {
                    const distance = distanceTo({
                        lon: event.longitude,
                        lat: event.latitude,
                    }, {
                        lon: userLongitude,
                        lat: userLatitude,
                    }) / 1069.344; // convert meters to miles
                    alteredEvent.distance = getReadableDistance(distance);
                }
                return {
                    ...alteredEvent,
                    reaction: reactions.find((reaction) => reaction.eventId === event.id) || {},
                };
            }).filter((event) => !blockedUsers.includes(event.fromUserId));
            return res.status(200).send({
                events,
                media: response?.data?.media,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
};

const searchBookmarkedEvents = async (req: any, res: any) => {
    req.body.withBookmark = true;

    return searchActiveEvents(req, res);
};

export {
    searchActiveEvents,
    searchActiveEventsByIds,
    searchBookmarkedEvents,
};
