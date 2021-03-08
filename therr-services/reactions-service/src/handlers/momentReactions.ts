import { RequestHandler } from 'express';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';

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
    const momentIds = req.query?.momentIds?.split(',');
    const queryParams: any = {
        userId,
    };

    if (queryParams.momentId) {
        queryParams.momentId = parseInt(queryParams.momentId, 10);
    }

    delete queryParams.momentIds;

    return Store.momentReactions.get(queryParams, momentIds, parseInt(req.query.limit, 10))
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
        if (!momentReaction?.length || !momentReaction.userHasActivated) {
            return handleHttpError({
                res,
                message: translate(locale, 'momentReactions.momentNotActivated'),
                statusCode: 403,
            });
        }

        return Store.momentReactions.getByMomentId({
            momentId,
        }, parseInt(req.query.limit, 10))
            .then(([moments]) => res.status(200).send(moments))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
    });
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
    getReactionsByMomentId,
    updateMomentReaction,
};
