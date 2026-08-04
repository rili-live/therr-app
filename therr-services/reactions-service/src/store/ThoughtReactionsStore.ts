import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const THOUGHT_REACTIONS_TABLE_NAME = 'main.thoughtReactions';

export interface ICreateThoughtReactionParams {
    thoughtId: string;
    userId: string;
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
    relevanceScore?: number | null;
    scoredAt?: Date | null;
}

export interface IUpdateThoughtReactionConditions {
    thoughtId?: string;
    userId?: string;
}

export interface IUpdateThoughtReactionParams {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
}

interface IUpdateWhereInConfig {
    columns: string[];
    whereInArray: any[][];
}

export interface IGetThoughtReactionFilters {
    limit?: number;
    offset?: number;
    order?: string;
    // 'relevance' orders by the distributor-assigned score (see updateRelevanceScores).
    // Defaults to 'createdAt' so non-feed callers keep their existing ordering.
    orderBy?: 'createdAt' | 'relevance';
}

export interface IRelevanceScoresByThoughtId {
    [thoughtId: string]: number;
}

export default class ThoughtReactionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getCounts(thoughtIds: string[], conditions: any, countBy = 'userHasLiked') {
        if (!thoughtIds?.length) {
            return Promise.resolve([]);
        }
        let queryString = knexBuilder.count('*', { as: 'count' })
            .select(['thoughtId'])
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where({
                ...conditions,
                [countBy]: true,
            })
            .groupBy('thoughtId');

        if (thoughtIds && thoughtIds.length) {
            queryString = queryString.whereIn('thoughtId', thoughtIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    get(conditions: any, thoughtIds?, filters: IGetThoughtReactionFilters = { limit: 100, offset: 0, order: 'DESC' }, customs: any = {}) {
        const restrictedLimit = Math.min(filters.limit || 100, 1000);
        // `order` reaches this method straight from a request body, and the relevance branch
        // below interpolates it into raw SQL — whitelist rather than pass it through.
        const direction = String(filters.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let queryString = knexBuilder.select('*')
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit)
            .offset(filters.offset || 0);

        if (filters.orderBy === 'relevance') {
            // Relevance always leads regardless of `direction` — `direction` only decides how
            // ties (and unscored, pre-rollout rows) fall back to recency. `thoughtId` is the
            // final tiebreak so offset pagination can't repeat or skip rows when two reactions
            // share a score and a timestamp, which is the common case inside one activation batch.
            queryString = queryString
                .orderByRaw(`"relevanceScore" DESC NULLS LAST, "createdAt" ${direction}, "thoughtId" ${direction}`);
        } else {
            queryString = queryString.orderBy('createdAt', direction);
        }

        if (customs.withBookmark) {
            queryString = queryString.whereNotNull('userBookmarkCategory');
        }

        if (thoughtIds && thoughtIds.length) {
            queryString = queryString.whereIn('thoughtId', thoughtIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getByThoughtId(conditions: any, limit = 100) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = Math.min(limit || 100, 1000);

        const queryString = knexBuilder.select('*')
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    create(params: ICreateThoughtReactionParams | ICreateThoughtReactionParams[]) {
        // knex renders `.insert([])` as an empty string, which would reach pg as an empty
        // query and return no `rows`. The multi-create path hits this whenever every
        // requested thought already has a reaction row, which is common for a re-run of the
        // distributor over the same hot thoughts.
        if (Array.isArray(params) && !params.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder(THOUGHT_REACTIONS_TABLE_NAME)
            .insert(params)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /**
     * Applies a per-thought relevance score to one user's existing reaction rows.
     *
     * The bulk `update` below sets one identical param set across every matched row via
     * `whereIn`, which can't express "a different score per thought". A single
     * `UPDATE ... FROM (VALUES ...)` handles the whole batch in one statement instead of one
     * UPDATE per thought — the distributor re-scores 7-20 thoughts on every run.
     *
     * Rows that don't exist yet are not created here; the caller inserts those with their
     * score already set.
     */
    updateRelevanceScores(userId: string, scoresByThoughtId: IRelevanceScoresByThoughtId) {
        const entries = Object.entries(scoresByThoughtId || {})
            .filter(([thoughtId, score]) => !!thoughtId && Number.isFinite(Number(score)));

        if (!userId || !entries.length) {
            return Promise.resolve([]);
        }

        const bindings: any[] = [];
        entries.forEach(([thoughtId, score]) => {
            bindings.push(thoughtId, Number(score));
        });
        bindings.push(userId);

        const valuesPlaceholders = entries.map(() => '(?::uuid, ?::double precision)').join(', ');
        const queryString = knexBuilder.raw(
            `UPDATE main."thoughtReactions" AS tr
                SET "relevanceScore" = v.score, "scoredAt" = NOW(), "updatedAt" = NOW()
                FROM (VALUES ${valuesPlaceholders}) AS v("thoughtId", score)
                WHERE tr."thoughtId" = v."thoughtId" AND tr."userId" = ?::uuid
                RETURNING tr.*`,
            bindings,
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /**
     * Clears every relevance score in one user's activated stream.
     *
     * Called when a user switches content algorithms. Scores from two profiles cannot be
     * meaningfully interleaved — PULSE weights the hot term at 1.0, FOCUS at 0.3 plus an
     * interest term — so the old ones are discarded rather than mixed with the new. Cleared
     * rows become NULL, which the read path already sorts last via `NULLS LAST`, so they fall
     * beneath freshly-scored activations and the stream rebuilds under the new profile.
     *
     * Scoped to `userHasActivated` because those are the only rows the feed reads; a
     * deactivated row's stale score is unreachable and not worth the write amplification.
     */
    resetRelevanceScores(userId: string) {
        if (!userId) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder.raw(
            `UPDATE main."thoughtReactions"
                SET "relevanceScore" = NULL, "scoredAt" = NULL, "algorithmKey" = NULL, "updatedAt" = NOW()
                WHERE "userId" = ?::uuid
                  AND "userHasActivated" = true
                  AND "relevanceScore" IS NOT NULL
                RETURNING "thoughtId"`,
            [userId],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(conditions: IUpdateThoughtReactionConditions, params: IUpdateThoughtReactionParams, whereIn?: IUpdateWhereInConfig) {
        let queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(THOUGHT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .returning('*');

        if (whereIn && whereIn.whereInArray?.length) {
            queryString = queryString.whereIn(whereIn.columns, whereIn.whereInArray);
        }

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    delete(userId: string) {
        const queryString = knexBuilder.delete()
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where('userId', userId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
