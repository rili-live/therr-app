import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
import updateAchievements from '../utilities/updateAchievements';
import validateReactionMetrics from '../utilities/validateReactionMetrics';
// import sendUserCoinUpdateRequest from '../utilities/sendUserCoinUpdateRequest';
// import * as globalConfig from '../../../../global-config';

// CREATE/UPDATE
const createOrUpdateThoughtReaction = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const metricsError = validateReactionMetrics(req.body);
    if (metricsError) {
        return handleHttpError({ res, message: metricsError, statusCode: 400 });
    }

    return Store.thoughtReactions.get({
        userId,
        thoughtId: req.params.thoughtId,
    }).then((reactionsResponse) => {
        // TODO: Use INSERT...ON CONFLICT...MERGE
        // Use the resulting created at vs. updated at to determine if this was an INSERT or an UPDATE
        if (reactionsResponse?.length) {
            updateAchievements(req.headers, req.body, reactionsResponse[0]);

            return Store.thoughtReactions.update({
                userId,
                thoughtId: req.params.thoughtId,
            }, {
                ...req.body,
                userLocale: locale,
                // Number() is load-bearing: a JSON body may carry "1" as a string, and
                // `9 + '1'` concatenates to '91' rather than adding to 10 — inflating the
                // very total the bounds above exist to cap.
                userViewCount: reactionsResponse[0].userViewCount + Number(req.body.userViewCount || 0),
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
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const metricsError = validateReactionMetrics(req.body);
    if (metricsError) {
        return handleHttpError({ res, message: metricsError, statusCode: 400 });
    }

    const { thoughtIds } = req.body;

    if (!thoughtIds?.length) {
        return handleHttpError({ res, message: 'thoughtIds is required', statusCode: 400 });
    }

    const validThoughtIds = thoughtIds.filter((id) => !!id);

    const params = { ...req.body };
    delete params.thoughtIds;
    // Per-thought, so it can't ride along in the shared param set that gets spread into
    // every inserted/updated row — it is applied separately below.
    delete params.relevanceScores;

    const relevanceScores = req.body.relevanceScores || {};
    const scoreFor = (thoughtId: string) => {
        const score = Number(relevanceScores[thoughtId]);
        return Number.isFinite(score) ? score : null;
    };

    // TODO: Use INSERT...ON CONFLICT...MERGE
    // Use the resulting created at vs. updated at to determine if this was an INSERT or an UPDATE
    return Store.thoughtReactions.get({
        userId,
    }, validThoughtIds).then(async (existing) => {
        const existingMapped = {};
        const existingReactions = existing.map((reaction) => {
            existingMapped[reaction.thoughtId] = reaction;
            return [userId, reaction.thoughtId];
        });
        let updatedReactions: any[] = [];
        if (existing?.length) {
            // Scores first, so the bulk update's RETURNING * below reports the fresh values.
            const scoresForExisting = existing.reduce((acc, reaction) => {
                const score = scoreFor(reaction.thoughtId);
                return score == null ? acc : { ...acc, [reaction.thoughtId]: score };
            }, {});
            await Store.thoughtReactions.updateRelevanceScores(userId, scoresForExisting);

            await Store.thoughtReactions.update({}, {
                ...params,
                userLocale: locale,
            }, {
                columns: ['userId', 'thoughtId'],
                whereInArray: existingReactions,
            })
                .then((thoughtReactions) => { updatedReactions = thoughtReactions; });
        }

        const createArray = validThoughtIds
            .filter((id) => !existingMapped[id])
            .map((thoughtId) => ({
                userId,
                thoughtId,
                ...params,
                userLocale: locale,
                // Always present (null when unscored) so every row in the multi-row insert
                // carries the same column set.
                relevanceScore: scoreFor(thoughtId),
                scoredAt: scoreFor(thoughtId) == null ? null : new Date(),
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

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

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

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

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

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

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

/**
 * Like counts for a batch of thoughts, keyed by thoughtId.
 *
 * The single-thought variant above is fine for a details view's root thought, but the same
 * view renders every reply with its own like control — fanning that out into one internal
 * request per reply is what this exists to avoid.
 */
const countMultiThoughtReactions: RequestHandler = async (req: any, res: any) => {
    const { thoughtIds } = req.body;

    if (!Array.isArray(thoughtIds)) {
        return handleHttpError({ res, message: 'thoughtIds is required', statusCode: 400 });
    }

    const validThoughtIds = thoughtIds.filter((id) => !!id);

    return Store.thoughtReactions.getCounts(validThoughtIds, {})
        .then((results) => res.status(200).send({
            // Thoughts with zero likes have no rows to group, so they are absent here rather
            // than zero — callers should default a missing key to 0.
            counts: results.reduce((acc: any, result: any) => ({
                ...acc,
                [result.thoughtId]: parseInt(result.count || 0, 10),
            }), {}),
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

/**
 * Clears the requesting user's relevance scores so their stream re-ranks under a new
 * algorithm. Called by users-service when `settingsContentAlgorithm` changes.
 *
 * The user is taken from `x-userid`, never from the body — this only ever resets the caller's
 * own stream, so it cannot be used to wipe another user's ranking. There is no route for it on
 * the public API gateway; it is reachable only service-to-service.
 */
const resetThoughtRelevanceScores = (req, res) => {
    const { userId } = parseHeaders(req.headers);

    if (!userId) {
        return handleHttpError({ res, message: 'User ID is required', statusCode: 400 });
    }

    return Store.thoughtReactions.resetRelevanceScores(userId)
        .then((rows) => res.status(200).send({ resetCount: rows?.length || 0 }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

export {
    getThoughtReactions,
    getReactionsByThoughtId,
    createOrUpdateThoughtReaction,
    createOrUpdateMultiThoughtReactions,
    findThoughtReactions,
    countThoughtReactions,
    countMultiThoughtReactions,
    resetThoughtRelevanceScores,
};
