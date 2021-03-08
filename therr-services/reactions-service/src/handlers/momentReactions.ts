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

    return Store.momentReactions.get({
        ...req.body,
        userId,
    }, req.params.limit)
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
    updateMomentReaction,
};
