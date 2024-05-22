import { RequestHandler } from 'express';
// import axios from 'axios';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
import updateAchievements from '../utilities/updateAchievements';
// import sendUserCoinUpdateRequest from '../utilities/sendUserCoinUpdateRequest';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateThoughtReaction = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate thoughts on demand
    const {
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    return Store.thoughtReactions.get({
        userId,
        thoughtId: req.params.thoughtId,
    }).then((reactionsResponse) => {
        // TODO: Use INSERT...ON CONFLICT...MERGE
        // Use the resulting created at vs. updated at to determine if this was an INSERT or an UPDATE
        if (reactionsResponse?.length) {
            updateAchievements({
                authorization: req.headers.authorization,
                locale,
                userId,
                whiteLabelOrigin,
            }, req.body, reactionsResponse[0]);

            return Store.thoughtReactions.update({
                userId,
                thoughtId: req.params.thoughtId,
            }, {
                ...req.body,
                userLocale: locale,
                userViewCount: reactionsResponse[0].userViewCount + (req.body.userViewCount || 0),
                userHasActivated: true,
            })
                .then(([thoughtReaction]) => {
                    // TODO: Should this be a blocking request to ensure update?
                    // NOTE: Temporarily disable for thoughts
                    // sendUserCoinUpdateRequest(req, reactionsResponse[0]);

                    res.status(200).send(thoughtReaction);
                });
        }

        // TODO: Should this be a blocking request to ensure update?
        // NOTE: Temporarily disable for thoughts
        // sendUserCoinUpdateRequest(req, {});

        return Store.thoughtReactions.create({
            userId,
            thoughtId: req.params.thoughtId,
            ...req.body,
            userLocale: locale,
            userHasActivated: true,
        }).then(([reaction]) => res.status(200).send(reaction));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

// CREATE/UPDATE
const createOrUpdateMultiThoughtReactions = (req, res) => {
    // TODO: This endpoint should be secure/non-public so user's cannot activate thoughts on demand
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { thoughtIds } = req.body;
    const params = { ...req.body };
    delete params.thoughtIds;

    // TODO: Use INSERT...ON CONFLICT...MERGE
    // Use the resulting created at vs. updated at to determine if this was an INSERT or an UPDATE
    return Store.thoughtReactions.get({
        userId,
    }, thoughtIds).then(async (existing) => {
        const existingMapped = {};
        const existingReactions = existing.map((reaction) => {
            existingMapped[reaction.thoughtId] = reaction;
            return [userId, reaction.thoughtId];
        });
        let updatedReactions: any[] = [];
        if (existing?.length) {
            await Store.thoughtReactions.update({}, {
                ...params,
                userLocale: locale,
            }, {
                columns: ['userId', 'thoughtId'],
                whereInArray: existingReactions,
            })
                .then((thoughtReactions) => { updatedReactions = thoughtReactions; });
        }

        const createArray = thoughtIds
            .filter((id) => !existingMapped[id])
            .map((thoughtId) => ({
                userId,
                thoughtId,
                ...params,
                userLocale: locale,
            }));

        return Store.thoughtReactions.create(createArray).then((createdReactions) => res.status(200).send({
            created: createdReactions,
            updated: updatedReactions,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

// READ
const getThoughtReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const thoughtIds = req.query?.thoughtIds?.split(',');
    const queryParams: any = {
        userId,
    };

    if (queryParams.thoughtId) {
        queryParams.thoughtId = parseInt(queryParams.thoughtId, 10);
    }

    delete queryParams.thoughtIds;

    return Store.thoughtReactions.get(queryParams, thoughtIds, {
        limit: parseInt(req.query.limit, 10),
        offset: 0,
        order: req.query.order || 'DESC',
    })
        .then(([thoughts]) => res.status(200).send(thoughts))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

const getReactionsByThoughtId: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const { thoughtId } = req.params;

    Store.thoughtReactions.get({
        userId,
        thoughtId,
    }).then((thoughtReaction: any) => {
        if (!thoughtReaction?.length || !thoughtReaction[0].userHasActivated) {
            return handleHttpError({
                res,
                message: translate(locale, 'thoughtReactions.thoughtNotActivated'),
                statusCode: 403,
            });
        }

        return Store.thoughtReactions.getByThoughtId({
            thoughtId,
        }, parseInt(req.query.limit || 100, 10))
            .then(([reaction]) => res.status(200).send(reaction))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
    });
};

const findThoughtReactions: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    // const locale = req.headers['x-localecode'] || 'en-us';
    const {
        thoughtIds,
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

    return Store.thoughtReactions.get(conditions, thoughtIds, {
        limit,
        offset,
        order,
    })
        .then((reactions) => res.status(200).send({
            reactions,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

const countThoughtReactions: RequestHandler = async (req: any, res: any) => {
    // const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const {
        thoughtId,
    } = req.params;

    return Store.thoughtReactions.getCounts([thoughtId], {})
        .then(([thought]) => res.status(200).send({
            thoughtId: thought?.thoughtId,
            count: thought?.count || 0,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

export {
    getThoughtReactions,
    getReactionsByThoughtId,
    createOrUpdateThoughtReaction,
    createOrUpdateMultiThoughtReactions,
    findThoughtReactions,
    countThoughtReactions,
};
