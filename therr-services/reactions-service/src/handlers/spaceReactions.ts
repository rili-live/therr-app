import { RequestHandler } from 'express';
// import axios from 'axios';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateSpaceReaction = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate spaces on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.spaceReactions.get({
        userId,
        spaceId: req.params.spaceId,
    }).then((existing) => {
        if (existing?.length) {
            return Store.spaceReactions.update({
                userId,
                spaceId: req.params.spaceId,
            }, {
                ...req.body,
                userLocale: locale,
                userViewCount: existing[0].userViewCount + (req.body.userViewCount || 0),
            })
                .then(([spaceReaction]) => res.status(200).send(spaceReaction));
        }

        return Store.spaceReactions.create({
            userId,
            spaceId: req.params.spaceId,
            ...req.body,
            userLocale: locale,
        }).then(([reaction]) => res.status(200).send(reaction));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

// CREATE/UPDATE
const createOrUpdateMultiSpaceReactions = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate spaces on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { spaceIds } = req.body;
    const params = { ...req.body };
    delete params.spaceIds;

    return Store.spaceReactions.get({
        userId,
    }, spaceIds).then((existing) => {
        const existingMapped = {};
        const existingReactions: string[][] = existing.map((reaction) => {
            existingMapped[reaction.spaceId] = reaction;
            return [userId, reaction.spaceId];
        });
        let updatedReactions;
        if (existing?.length) {
            Store.spaceReactions.update({}, {
                ...params,
                userLocale: locale,
            }, {
                columns: ['userId', 'spaceId'],
                whereInArray: existingReactions,
            })
                .then((spaceReactions) => { updatedReactions = spaceReactions; });
        }

        const createArray = spaceIds
            .filter((id) => !existingMapped[id])
            .map((spaceId) => ({
                userId,
                spaceId,
                ...params,
                userLocale: locale,
            }));

        return Store.spaceReactions.create(createArray).then((createdReactions) => res.status(200).send({
            created: createdReactions,
            updated: updatedReactions,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

// READ
const getSpaceReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const spaceIds = req.query?.spaceIds?.split(',');
    const queryParams: any = {
        userId,
    };

    if (queryParams.spaceId) {
        queryParams.spaceId = parseInt(queryParams.spaceId, 10);
    }

    delete queryParams.spaceIds;

    return Store.spaceReactions.get(queryParams, spaceIds, {
        limit: parseInt(req.query.limit, 10),
        offset: 0,
        order: req.query.order || 'DESC',
    })
        .then(([spaces]) => res.status(200).send(spaces))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

const getSpaceRatings: RequestHandler = (req: any, res: any) => {
    const spaceId = req.params.spaceId;
    return Store.spaceReactions.getBySpaceId({ spaceId }, parseInt(req.query.limit || 100, 10))
        .then((reactions) => {
            const ratings = reactions
                .filter((reaction) => reaction.rating !== null && reaction.rating !== undefined)
                .map((reaction) => reaction.rating);

            const totalRatings = ratings.length;
            const sum = ratings.reduce((acc, curr) => acc + curr, 0);
            const avgRating = totalRatings > 0 ? sum / totalRatings : null;

            res.status(200).send({ avgRating, totalRatings });
        })
        .catch((err) => {
            handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' });
        });
};

const getReactionsBySpaceId: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { spaceId } = req.params;

    return Store.spaceReactions.get({
        userId,
        spaceId,
    }).then((spaceReaction: any) => {
        if (!spaceReaction?.length || !spaceReaction[0].userHasActivated) {
            return handleHttpError({
                res,
                message: translate(locale, 'spaceReactions.spaceNotActivated'),
                statusCode: 403,
            });
        }

        return Store.spaceReactions.getBySpaceId({
            spaceId,
        }, parseInt(req.query.limit || 100, 10))
            .then(([reaction]) => res.status(200).send(reaction))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
    });
};

const findSpaceReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    // const locale = req.headers['x-localecode'] || 'en-us';
    const {
        spaceIds,
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

    return Store.spaceReactions.get(conditions, spaceIds, {
        limit,
        offset,
        order,
    })
        .then((reactions) => res.status(200).send({
            reactions,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

export {
    getSpaceReactions,
    getSpaceRatings,
    getReactionsBySpaceId,
    createOrUpdateSpaceReaction,
    createOrUpdateMultiSpaceReactions,
    findSpaceReactions,
};
