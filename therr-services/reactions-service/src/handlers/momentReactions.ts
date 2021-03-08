import { RequestHandler } from 'express';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// CREATE
const createMomentReaction = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    return Store.momentReactions.create({
        ...req.body,
        userId,
        userLocale: locale,
    })
        .then(([moments]) => res.status(201).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

// READ
const getMomentReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const momentIds = req.body.momentIds;
    const params = {
        ...req.body,
        userId,
    };

    delete params.momentIds;

    return Store.momentReactions.get(params, momentIds, req.params.limit)
        .then(([moments]) => res.status(200).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

const getMomentReactionsByMomentId: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];

    const params = {
        ...req.body,
        momentIds: req.params.momentId,
    };

    return Store.momentReactions.getByMomentId(params, userId, req.params.limit)
        .then(([moments]) => res.status(200).send(moments))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

// UPDATE
const updateMomentReaction = (req, res) => {
    const userId = req.headers['x-userid'];

    return Store.momentReactions.update({
        userId,
        momentId: req.params.momentId,
    }, req.body)
        .then(([momentReaction]) => res.status(200).send(momentReaction))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

export {
    createMomentReaction,
    getMomentReactions,
    getMomentReactionsByMomentId,
    updateMomentReaction,
};
