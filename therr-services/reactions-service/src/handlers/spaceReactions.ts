import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
import incrementInterestEngagement from '../utilities/incrementInterestEngagement';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateSpaceReaction = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate spaces on demand
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    // TODO: Use INSERT...ON CONFLICT...MERGE
    // Use the resulting created at vs. updated at to determine if this was an INSERT or an UPDATE
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
                .then(([spaceReaction]) => {
                    const space = existing[0];
                    if (userId !== space.fromUserId && spaceReaction.rating > 3) {
                        incrementInterestEngagement(space.interestsKeys, 3, req.headers);
                    }
                    return res.status(200).send(spaceReaction);
                });
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

    // TODO: Use INSERT...ON CONFLICT...MERGE
    // Use the resulting created at vs. updated at to determine if this was an INSERT or an UPDATE
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
    return Store.spaceReactions.getRatingsBySpaceId({ spaceId }, parseInt(req.query.limit || 100, 10))
        .then((reactions) => {
            const ratings = reactions
                .map((reaction) => reaction.rating);

            const totalRatings = ratings.length;
            const sum = ratings.reduce((acc, curr) => acc + curr, 0);
            const avgRating = totalRatings > 0 ? Math.round((sum / totalRatings) * 10) / 10 : null;

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

const countSpaceReactions: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        spaceId,
    } = req.params;

    return Store.spaceReactions.getCounts([spaceId], {})
        .then(([space]) => res.status(200).send({
            spaceId: space?.spaceId,
            count: space?.count || 0,
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
    countSpaceReactions,
};
