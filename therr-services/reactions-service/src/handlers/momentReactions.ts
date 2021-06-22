import { RequestHandler } from 'express';
// import axios from 'axios';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateMomentReaction = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate moments on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    return Store.momentReactions.get({
        userId,
        momentId: req.params.momentId,
    }).then((existing) => {
        if (existing?.length) {
            return Store.momentReactions.update({
                userId,
                momentId: req.params.momentId,
            }, {
                ...req.body,
                userLocale: locale,
                userViewCount: existing[0].userViewCount + (req.body.userViewCount || 0),
            })
                .then(([momentReaction]) => res.status(200).send(momentReaction));
        }

        return Store.momentReactions.create({
            userId,
            momentId: req.params.momentId,
            ...req.body,
            userLocale: locale,
        }).then(([reaction]) => res.status(200).send(reaction));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

// CREATE/UPDATE
const createOrUpdateMultiMomentReactions = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate moments on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { momentIds } = req.body;
    const params = { ...req.body };
    delete params.momentIds;

    return Store.momentReactions.get({}, momentIds).then((existing) => {
        const existingReactions = existing.map((reaction) => [userId, reaction.momentId]);
        let updatedReactions;
        if (existing?.length) {
            Store.momentReactions.update({}, {
                ...params,
                userLocale: locale,
            }, {
                columns: ['userId', 'momentId'],
                whereInArray: existingReactions,
            })
                .then((momentReactions) => { updatedReactions = momentReactions; });
        }

        const createArray = momentIds
            .filter((id) => !existingReactions.find((reaction) => reaction[1] === id))
            .map((momentId) => ({
                userId,
                momentId,
                ...params,
                userLocale: locale,
            }));

        return Store.momentReactions.create(createArray).then((createdReactions) => res.status(200).send({
            created: createdReactions,
            updated: updatedReactions,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

// READ
const getMomentReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const momentIds = req.query?.momentIds?.split(',');
    const queryParams: any = {
        userId,
    };

    if (queryParams.momentId) {
        queryParams.momentId = parseInt(queryParams.momentId, 10);
    }

    delete queryParams.momentIds;

    return Store.momentReactions.get(queryParams, momentIds, {
        limit: parseInt(req.query.limit, 10),
        offset: 0,
    })
        .then(([moments]) => res.status(200).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

const getReactionsByMomentId: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { momentId } = req.params;

    Store.momentReactions.get({
        userId,
        momentId,
    }).then((momentReaction: any) => {
        if (!momentReaction?.length || !momentReaction[0].userHasActivated) {
            return handleHttpError({
                res,
                message: translate(locale, 'momentReactions.momentNotActivated'),
                statusCode: 403,
            });
        }

        return Store.momentReactions.getByMomentId({
            momentId,
        }, parseInt(req.query.limit, 10))
            .then(([reaction]) => res.status(200).send(reaction))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
    });
};

const findMomentReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    // const locale = req.headers['x-localecode'] || 'en-us';
    const {
        momentIds,
        userHasActivated,
        limit,
        offset,
    } = req.body;

    const conditions: any = {
        userId,
    };

    if (userHasActivated != null) {
        conditions.userHasActivated = userHasActivated;
    }

    return Store.momentReactions.get(conditions, momentIds, {
        limit,
        offset,
    })
        .then((reactions) => res.status(200).send({
            reactions,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

export {
    getMomentReactions,
    getReactionsByMomentId,
    createOrUpdateMomentReaction,
    createOrUpdateMultiMomentReactions,
    findMomentReactions,
};
