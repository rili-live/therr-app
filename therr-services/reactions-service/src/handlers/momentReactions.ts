import { RequestHandler } from 'express';
// import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
import updateAchievements from '../utilities/updateAchievements';
import sendUserCoinUpdateRequest from '../utilities/sendUserCoinUpdateRequest';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateMomentReaction = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate moments on demand
    const {
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    return Store.momentReactions.get({
        userId,
        momentId: req.params.momentId,
    }).then((reactionsResponse) => {
        if (reactionsResponse?.length) {
            updateAchievements({
                authorization: req.headers.authorization,
                locale,
                userId,
                whiteLabelOrigin,
            }, req.body);

            return Store.momentReactions.update({
                userId,
                momentId: req.params.momentId,
            }, {
                ...req.body,
                userLocale: locale,
                userViewCount: reactionsResponse[0].userViewCount + (req.body.userViewCount || 0),
            })
                .then(([momentReaction]) => {
                    // TODO: Should this be a blocking request to ensure update?
                    sendUserCoinUpdateRequest(req, reactionsResponse[0]).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Failed to request coin update'],
                            traceArgs: {
                                'error.message': err?.message,
                                'error.origin': 'createOrUpdateMomentReaction-update',
                            },
                        });
                    });

                    return res.status(200).send(momentReaction);
                });
        }

        // TODO: Should this be a blocking request to ensure update?
        sendUserCoinUpdateRequest(req, {}).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to request coin update'],
                traceArgs: {
                    'error.message': err?.message,
                    'error.origin': 'createOrUpdateMomentReaction-create',
                },
            });
        });

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

    return Store.momentReactions.get({
        userId,
    }, momentIds).then((existing) => {
        const existingMapped = {};
        const existingReactions = existing.map((reaction) => {
            existingMapped[reaction.momentId] = reaction;
            return [userId, reaction.momentId];
        });
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
            .filter((id) => !existingMapped[id])
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
        order: req.query.order || 'DESC',
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
        }, parseInt(req.query.limit || 100, 10))
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
        order,
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
        order,
    })
        .then((reactions) => res.status(200).send({
            reactions,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

const countMomentReactions: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        momentId,
    } = req.params;

    return Store.momentReactions.getCounts([momentId], {})
        .then(([moment]) => res.status(200).send({
            momentId: moment?.momentId,
            count: moment?.count || 0,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENT_REACTIONS_ROUTES:ERROR' }));
};

export {
    getMomentReactions,
    getReactionsByMomentId,
    createOrUpdateMomentReaction,
    createOrUpdateMultiMomentReactions,
    findMomentReactions,
    countMomentReactions,
};
