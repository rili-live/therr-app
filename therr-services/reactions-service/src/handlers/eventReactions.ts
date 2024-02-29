import { RequestHandler } from 'express';
// import axios from 'axios';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateEventReaction = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate events on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.eventReactions.get({
        userId,
        eventId: req.params.eventId,
    }).then((existing) => {
        if (existing?.length) {
            return Store.eventReactions.update({
                userId,
                eventId: req.params.eventId,
            }, {
                ...req.body,
                userLocale: locale,
                userViewCount: existing[0].userViewCount + (req.body.userViewCount || 0),
            })
                .then(([eventReaction]) => res.status(200).send(eventReaction));
        }

        return Store.eventReactions.create({
            userId,
            eventId: req.params.eventId,
            ...req.body,
            userLocale: locale,
        }).then(([reaction]) => res.status(200).send(reaction));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
};

// CREATE/UPDATE
const createOrUpdateMultiEventReactions = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate events on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { eventIds } = req.body;
    const params = { ...req.body };
    delete params.eventIds;

    return Store.eventReactions.get({
        userId,
    }, eventIds).then((existing) => {
        const existingMapped = {};
        const existingReactions: string[][] = existing.map((reaction) => {
            existingMapped[reaction.eventId] = reaction;
            return [userId, reaction.eventId];
        });
        let updatedReactions;
        if (existing?.length) {
            Store.eventReactions.update({}, {
                ...params,
                userLocale: locale,
            }, {
                columns: ['userId', 'eventId'],
                whereInArray: existingReactions,
            })
                .then((eventReactions) => { updatedReactions = eventReactions; });
        }

        const createArray = eventIds
            .filter((id) => !existingMapped[id])
            .map((eventId) => ({
                userId,
                eventId,
                ...params,
                userLocale: locale,
            }));

        return Store.eventReactions.create(createArray).then((createdReactions) => res.status(200).send({
            created: createdReactions,
            updated: updatedReactions,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
};

const createOrUpdateMultiUserReactions = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate events on demand
    const locale = req.headers['x-localecode'] || 'en-us';

    const { eventId, userIds } = req.body;
    const params = { ...req.body };
    delete params.userIds;

    return Store.eventReactions.get({
        eventId,
    }, undefined, userIds).then((existing) => {
        const existingMapped = {};
        const existingReactions: string[][] = existing.map((reaction) => {
            existingMapped[reaction.userId] = reaction;
            return [reaction.userId, reaction.eventId];
        });
        let updatedReactions;
        if (existing?.length) {
            Store.eventReactions.update({}, {
                userLocale: locale,
            }, {
                columns: ['userId', 'eventId'],
                whereInArray: existingReactions,
            })
                .then((eventReactions) => { updatedReactions = eventReactions; });
        }

        const createArray = userIds
            .filter((id) => !existingMapped[id])
            .map((uId) => ({
                userId: uId,
                eventId,
                ...params,
                userLocale: locale,
            }));

        return Store.eventReactions.create(createArray).then((createdReactions) => res.status(200).send({
            created: createdReactions,
            updated: updatedReactions,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
};

// READ
const getEventReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const eventIds = req.query?.eventIds?.split(',');
    const queryParams: any = {
        userId,
    };

    if (queryParams.eventId) {
        queryParams.eventId = parseInt(queryParams.eventId, 10);
    }

    delete queryParams.eventIds;

    return Store.eventReactions.get(queryParams, eventIds, undefined, {
        limit: parseInt(req.query.limit, 10),
        offset: 0,
        order: req.query.order || 'DESC',
    })
        .then(([events]) => res.status(200).send(events))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
};

const getEventRatings: RequestHandler = (req: any, res: any) => {
    const eventId = req.params.eventId;
    return Store.eventReactions.getRatingsByEventId({ eventId }, parseInt(req.query.limit || 100, 10))
        .then((reactions) => {
            const ratings = reactions
                .map((reaction) => reaction.rating);

            const totalRatings = ratings.length;
            const sum = ratings.reduce((acc, curr) => acc + curr, 0);
            const avgRating = totalRatings > 0 ? Math.round((sum / totalRatings) * 10) / 10 : null;

            res.status(200).send({ avgRating, totalRatings });
        })
        .catch((err) => {
            handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' });
        });
};

const getReactionsByEventId: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { eventId } = req.params;

    return Store.eventReactions.get({
        userId,
        eventId,
    }).then((eventReaction: any) => {
        if (!eventReaction?.length || !eventReaction[0].userHasActivated) {
            return handleHttpError({
                res,
                message: translate(locale, 'eventReactions.eventNotActivated'),
                statusCode: 403,
            });
        }

        return Store.eventReactions.getByEventId({
            eventId,
        }, parseInt(req.query.limit || 100, 10))
            .then(([reaction]) => res.status(200).send(reaction))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
    });
};

const findEventReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    // const locale = req.headers['x-localecode'] || 'en-us';
    const {
        eventIds,
        userHasActivated,
        limit,
        offset,
        order,
    } = req.body;

    const conditions: any = {
        userId,
    };

    if (userHasActivated != null) {
        conditions.userHasActivated = userHasActivated;
    }

    return Store.eventReactions.get(conditions, eventIds, undefined, {
        limit,
        offset,
        order,
    })
        .then((reactions) => res.status(200).send({
            reactions,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:EVENT_REACTIONS_ROUTES:ERROR' }));
};

export {
    getEventReactions,
    getEventRatings,
    getReactionsByEventId,
    createOrUpdateEventReaction,
    createOrUpdateMultiEventReactions,
    createOrUpdateMultiUserReactions,
    findEventReactions,
};
