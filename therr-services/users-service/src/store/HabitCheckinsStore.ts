import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { HABIT_CHECKINS_TABLE_NAME, HABIT_GOALS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateHabitCheckinParams {
    userId: string;
    pactId?: string;
    habitGoalId: string;
    scheduledDate: string; // YYYY-MM-DD format
    status?: string;
    completedAt?: Date;
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
    hasProof?: boolean;
}

export interface ICheckinCountTarget {
    key: string; // caller-supplied identifier echoed back in the result map
    userId: string;
    habitGoalId: string;
    startDate: string; // YYYY-MM-DD, inclusive
    endDate: string; // YYYY-MM-DD, inclusive
}

export interface IUpdateHabitCheckinParams {
    status?: string;
    completedAt?: Date;
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
    hasProof?: boolean;
    proofVerified?: boolean;
    contributedToStreak?: boolean;
}

export default class HabitCheckinsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(HABIT_CHECKINS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        return this.get({ id }).then((results) => results[0]);
    }

    getByUserAndDate(userId: string, scheduledDate: string, habitGoalId?: string) {
        const conditions: any = { userId, scheduledDate };
        if (habitGoalId) {
            conditions.habitGoalId = habitGoalId;
        }
        return this.get(conditions);
    }

    getByUserAndDateRange(userId: string, startDate: string, endDate: string, habitGoalId?: string) {
        let queryString = knexBuilder
            .select([
                `${HABIT_CHECKINS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
            ])
            .from(HABIT_CHECKINS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${HABIT_CHECKINS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .where(`${HABIT_CHECKINS_TABLE_NAME}.userId`, userId)
            .andWhere(`${HABIT_CHECKINS_TABLE_NAME}.scheduledDate`, '>=', startDate)
            .andWhere(`${HABIT_CHECKINS_TABLE_NAME}.scheduledDate`, '<=', endDate)
            .orderBy(`${HABIT_CHECKINS_TABLE_NAME}.scheduledDate`, 'desc');

        if (habitGoalId) {
            queryString = queryString.andWhere(`${HABIT_CHECKINS_TABLE_NAME}.habitGoalId`, habitGoalId);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getByPactId(pactId: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .select([
                `${HABIT_CHECKINS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
            ])
            .from(HABIT_CHECKINS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${HABIT_CHECKINS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .where(`${HABIT_CHECKINS_TABLE_NAME}.pactId`, pactId)
            .orderBy(`${HABIT_CHECKINS_TABLE_NAME}.scheduledDate`, 'desc');

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getByHabitGoalId(habitGoalId: string, userId: string, limit?: number) {
        let queryString = knexBuilder
            .from(HABIT_CHECKINS_TABLE_NAME)
            .where({ habitGoalId, userId })
            .orderBy('scheduledDate', 'desc');

        if (limit) {
            queryString = queryString.limit(limit);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getTodayCheckin(userId: string, habitGoalId: string) {
        const today = new Date().toISOString().split('T')[0];
        return this.get({ userId, habitGoalId, scheduledDate: today })
            .then((results) => results[0]);
    }

    getPendingCheckinsForDate(userId: string, date: string) {
        return this.get({ userId, scheduledDate: date, status: 'pending' });
    }

    getCompletedCountForPeriod(userId: string, habitGoalId: string, startDate: string, endDate: string) {
        const queryString = knexBuilder
            .from(HABIT_CHECKINS_TABLE_NAME)
            .count('* as count')
            .where({ userId, habitGoalId, status: 'completed' })
            .andWhere('scheduledDate', '>=', startDate)
            .andWhere('scheduledDate', '<=', endDate);

        return this.db.read.query(queryString.toString())
            .then((response) => parseInt(response.rows[0]?.count || '0', 10));
    }

    /**
     * Completed check-in counts for many (user, habit goal, date window)
     * targets in a single query. Each target carries its own window — two
     * pacts on the same habit can cover different date ranges — so the counts
     * are grouped by the caller's opaque `key` rather than by user+goal, which
     * would conflate them.
     */
    getCompletedCountsForWindows(targets: ICheckinCountTarget[]): Promise<Record<string, number>> {
        if (!targets.length) {
            return Promise.resolve({});
        }

        const values = targets.map(() => '(?, ?::uuid, ?::uuid, ?::date, ?::date)').join(', ');
        const bindings = targets.reduce(
            (acc: string[], target) => acc.concat([
                target.key,
                target.userId,
                target.habitGoalId,
                target.startDate,
                target.endDate,
            ]),
            [],
        );

        const queryString = knexBuilder.raw(
            `WITH targets("key", "userId", "habitGoalId", "startDate", "endDate") AS (VALUES ${values})
            SELECT t."key" AS key, COUNT(c.id)::int AS count
            FROM targets t
            LEFT JOIN ${HABIT_CHECKINS_TABLE_NAME} c
                ON c."userId" = t."userId"
                AND c."habitGoalId" = t."habitGoalId"
                AND c.status = 'completed'
                AND c."scheduledDate" >= t."startDate"
                AND c."scheduledDate" <= t."endDate"
            GROUP BY t."key"`,
            bindings,
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce(
            (acc: Record<string, number>, row: any) => {
                acc[row.key] = Number(row.count) || 0;
                return acc;
            },
            {},
        ));
    }

    /**
     * Earliest completed check-in date per (user, habit goal), in one query.
     *
     * This is how the lifecycle engine knows a habit's age, and it is
     * deliberately the *first completion* rather than the pact join date or the
     * goal's creation date. A user can join a pact and not start for a week, and
     * can hold one goal across several pacts; dating the habit from anything
     * other than the day they actually first did it would let someone reach the
     * 21-day establish floor without 21 days of habit behind them.
     *
     * Returns a map keyed `${userId}:${habitGoalId}`. A pair with no completed
     * check-ins is absent rather than zero-valued — it has no age yet.
     */
    getFirstCompletedDates(pairs: { userId: string; habitGoalId: string }[]): Promise<Record<string, string>> {
        if (!pairs.length) {
            return Promise.resolve({});
        }

        const values = pairs.map(() => '(?::uuid, ?::uuid)').join(', ');
        const bindings = pairs.reduce(
            (acc: string[], pair) => acc.concat([pair.userId, pair.habitGoalId]),
            [],
        );

        const queryString = knexBuilder.raw(
            `WITH pairs("userId", "habitGoalId") AS (VALUES ${values})
            SELECT p."userId" AS "userId",
                   p."habitGoalId" AS "habitGoalId",
                   MIN(c."scheduledDate")::text AS "firstDate"
            FROM pairs p
            JOIN ${HABIT_CHECKINS_TABLE_NAME} c
                ON c."userId" = p."userId"
                AND c."habitGoalId" = p."habitGoalId"
                AND c.status = 'completed'
            GROUP BY p."userId", p."habitGoalId"`,
            bindings,
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce(
            (acc: Record<string, string>, row: any) => {
                if (row.firstDate) {
                    acc[`${row.userId}:${row.habitGoalId}`] = String(row.firstDate).slice(0, 10);
                }
                return acc;
            },
            {},
        ));
    }

    /**
     * Which of these (user, habit goal) pairs have a completed check-in on
     * `date`, in one query.
     *
     * This is what lets a pact card say who has and has not shown up today —
     * the whole mechanism behind Duolingo's Friend Streak result (+22% daily
     * completion from adding nothing but a second reader). A per-member query
     * would make the pacts list O(members) round trips on a hot read path.
     *
     * `date` is a habit day as the service counts them (UTC, via
     * `getTodayDateString`), matching what the check-in write path stores in
     * `scheduledDate` — not the viewer's local calendar day.
     *
     * Returns a Set of `${userId}:${habitGoalId}`. Absence means "no completed
     * check-in", which is the same thing the caller wants to render.
     *
     * No index was added for this. The three equality predicates are exactly the
     * key of the existing UNIQUE constraint on
     * (userId, habitGoalId, scheduledDate), so a per-pair lookup is already a
     * single index hit; a partial index on the same columns would only add write
     * cost. What is worth knowing is which plan runs: with a small table the
     * planner drives from `habit_checkins_scheduleddate_index`, reading every
     * check-in scheduled that day and join-filtering against the pairs. That is
     * free at current volume and gets worse as the daily active population
     * grows, while the pair-driven nested loop stays at roughly one row per
     * pair — so the planner should flip to it on its own once the day partition
     * is large enough. If this read ever shows up slow, check that it has:
     * an EXPLAIN driving from `*VALUES*` is the healthy shape.
     */
    getCompletedOnDateForPairs(
        pairs: { userId: string; habitGoalId: string }[],
        date: string,
    ): Promise<Set<string>> {
        if (!pairs.length) {
            return Promise.resolve(new Set<string>());
        }

        const values = pairs.map(() => '(?::uuid, ?::uuid)').join(', ');
        const bindings = pairs.reduce(
            (acc: string[], pair) => acc.concat([pair.userId, pair.habitGoalId]),
            [],
        ).concat([date]);

        const queryString = knexBuilder.raw(
            `WITH pairs("userId", "habitGoalId") AS (VALUES ${values})
            SELECT DISTINCT p."userId" AS "userId", p."habitGoalId" AS "habitGoalId"
            FROM pairs p
            JOIN ${HABIT_CHECKINS_TABLE_NAME} c
                ON c."userId" = p."userId"
                AND c."habitGoalId" = p."habitGoalId"
                AND c.status = 'completed'
                AND c."scheduledDate" = ?::date`,
            bindings,
        ).toString();

        return this.db.read.query(queryString).then((response) => new Set<string>(
            response.rows.map((row: any) => `${row.userId}:${row.habitGoalId}`),
        ));
    }

    create(params: ICreateHabitCheckinParams) {
        const queryString = knexBuilder
            .insert({
                ...params,
                status: params.status || 'pending',
            })
            .into(HABIT_CHECKINS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    createOrUpdate(params: ICreateHabitCheckinParams) {
        // Upsert based on unique constraint (userId, habitGoalId, scheduledDate)
        const insertParams = {
            ...params,
            status: params.status || 'pending',
        };

        const queryString = knexBuilder
            .insert(insertParams)
            .into(HABIT_CHECKINS_TABLE_NAME)
            .onConflict(['userId', 'habitGoalId', 'scheduledDate'])
            .merge({
                status: params.status,
                // Backfills rows written before the check-in flow resolved a
                // pact from the habit goal. Knex drops undefined keys from the
                // merge, so a genuinely pact-less check-in stays pact-less.
                pactId: params.pactId,
                completedAt: params.completedAt,
                notes: params.notes,
                selfRating: params.selfRating,
                difficultyRating: params.difficultyRating,
                hasProof: params.hasProof,
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    update(id: string, params: IUpdateHabitCheckinParams) {
        const queryString = knexBuilder
            .where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(HABIT_CHECKINS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    complete(id: string, notes?: string, selfRating?: number, difficultyRating?: number) {
        return this.update(id, {
            status: 'completed',
            completedAt: new Date(),
            notes,
            selfRating,
            difficultyRating,
            contributedToStreak: true,
        });
    }

    skip(id: string, notes?: string) {
        return this.update(id, {
            status: 'skipped',
            notes,
            contributedToStreak: false,
        });
    }

    markMissed(id: string) {
        return this.update(id, {
            status: 'missed',
            contributedToStreak: false,
        });
    }

    delete(id: string, userId: string) {
        const queryString = knexBuilder
            .where({ id, userId })
            .delete()
            .into(HABIT_CHECKINS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }
}
