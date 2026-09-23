import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { HABIT_CHECKINS_TABLE_NAME, HABIT_GOALS_TABLE_NAME, PACT_MEMBERS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateHabitCheckinParams {
    userId: string;
    pactId?: string;
    habitGoalId: string;
    scheduledDate: string; // YYYY-MM-DD format
    // The user's own calendar day (their timezone) at write time — what the app-level daily
    // streak reads. `scheduledDate` stays the UTC habit day. See utilities/dailyStreak.ts.
    localDate?: string;
    status?: string;
    completedAt?: Date;
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
    hasProof?: boolean;
    /**
     * Money put away by this check-in, in major units of the goal's currency. Only
     * written on `savings_goal` habits — see migration
     * 20260920000002_habits.habit_checkins.savedAmount.js.
     *
     * `undefined` and `null` are different instructions to the upsert: knex drops an
     * undefined key from the merge, so an edit that only adds a note leaves an existing
     * amount alone, while an explicit `null` clears it. The handler is what turns "the
     * client sent no field" into undefined and "the client sent an empty field" into
     * null.
     */
    savedAmount?: number | null;
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
    // Set when the check-in is shared publicly — points at the main.thoughts row that
    // carries the public copy of the proof. Nullable/absent otherwise. See migration
    // 20260906000001_habits.habit_checkins.sharedThoughtId.js.
    sharedThoughtId?: string;
    /** See `ICreateHabitCheckinParams.savedAmount`. Pass null to clear a recorded amount. */
    savedAmount?: number | null;
}

/** The per-member savings rollup behind a savings goal's progress. */
export interface ISavingsTotalByUser {
    userId: string;
    totalSaved: number;
    contributionCount: number;
}

/**
 * node-postgres hands back every `numeric` as a string rather than narrowing it to a
 * double on your behalf. `savedAmount` is one, so without this a check-in's amount
 * arrives at the client as `"12.50"` and any arithmetic on it in between is string
 * concatenation — `total + row.savedAmount` becomes `"012.50"`. Coerced at the store so
 * no read path can miss it. See the longer note in HabitGoalsStore.
 */
const normalizeCheckinRow = (row: any) => {
    if (!row || row.savedAmount === null || row.savedAmount === undefined) {
        return row;
    }

    return { ...row, savedAmount: Number(row.savedAmount) };
};

const normalizeCheckinRows = (rows: any[]) => rows.map(normalizeCheckinRow);

/**
 * Drop the keys whose value is `undefined` before handing an object to `knex.insert()`.
 *
 * Knex does not omit an undefined value from an insert — it emits the column with
 * `DEFAULT`. So `{ savedAmount: undefined }` still names `"savedAmount"` in the INSERT,
 * which makes every *optional* column a hard schema dependency of the write path: a
 * check-in carrying no amount at all fails with
 * `column "savedAmount" of relation "habit_checkins" does not exist` until the migration
 * that adds it has run. (`.merge()` drops undefined keys already, so only the insert half
 * needs this.)
 *
 * That window is not hypothetical. `_bin/cicd/run-migrations.sh` deliberately runs after
 * the new image is rolled out — "migrations MUST be additive / expand-contract … so the
 * new code tolerates the pre-migration schema" — and on 2026-09-20 the deploy aborted in
 * `deploy_waves` on an unrelated ImagePullBackOff before reaching the migration step, so
 * users-service served the savings build against a schema without `savedAmount` and every
 * check-in 500'd. Stripping undefined keys is what makes an additive column additive on
 * the write path too: the request that does not use it does not mention it.
 */
const withDefinedColumns = <T extends object>(params: T): Partial<T> => Object.entries(params)
    .reduce((acc: any, [column, value]) => {
        if (value !== undefined) {
            acc[column] = value;
        }
        return acc;
    }, {});

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
            .then((response) => normalizeCheckinRows(response.rows));
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
            .then((response) => normalizeCheckinRows(response.rows));
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
            .then((response) => normalizeCheckinRows(response.rows));
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
            .then((response) => normalizeCheckinRows(response.rows));
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
     * A habit day is the *checked-in user's own* calendar day — that is what the
     * write path stores in `scheduledDate` (see `resolveCheckinHabitDate`). So
     * `date` is a per-user question, not one date for the whole batch: a pact's
     * members can be in different zones, and at 02:00 UTC two of them are on
     * different calendar days. Each pair may therefore carry its own `date`;
     * `defaultDate` covers the pairs that do not (a single user's own habits, or
     * a caller that has already resolved one zone for everyone).
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
        pairs: { userId: string; habitGoalId: string; date?: string }[],
        defaultDate: string,
    ): Promise<Set<string>> {
        if (!pairs.length) {
            return Promise.resolve(new Set<string>());
        }

        const values = pairs.map(() => '(?::uuid, ?::uuid, ?::date)').join(', ');
        const bindings = pairs.reduce(
            (acc: string[], pair) => acc.concat([pair.userId, pair.habitGoalId, pair.date || defaultDate]),
            [],
        );

        const queryString = knexBuilder.raw(
            `WITH pairs("userId", "habitGoalId", "onDate") AS (VALUES ${values})
            SELECT DISTINCT p."userId" AS "userId", p."habitGoalId" AS "habitGoalId"
            FROM pairs p
            JOIN ${HABIT_CHECKINS_TABLE_NAME} c
                ON c."userId" = p."userId"
                AND c."habitGoalId" = p."habitGoalId"
                AND c.status = 'completed'
                AND c."scheduledDate" = p."onDate"`,
            bindings,
        ).toString();

        return this.db.read.query(queryString).then((response) => new Set<string>(
            response.rows.map((row: any) => `${row.userId}:${row.habitGoalId}`),
        ));
    }

    /**
     * How many of a pact's *active* members have a completed check-in for the pact's habit
     * goal on `date` — the numerator of the pact's majority test.
     *
     * Counts distinct members joined through `pact_members`, not check-in rows tagged with the
     * pactId: a check-in stamps a single `pactId` even when its habit goal backs several pacts,
     * so counting by that column would undercount a member who belongs to more than one pact on
     * the goal. Membership + (userId, habitGoalId, scheduledDate) is the reliable pairing, and
     * it rides the check-ins UNIQUE constraint's key columns.
     *
     * `date` is a habit day as the service counts them (UTC, via getTodayDateString), matching
     * what the write path stores in `scheduledDate`.
     */
    countCompletedActiveMembersForPact(pactId: string, habitGoalId: string, date: string): Promise<number> {
        const queryString = knexBuilder.raw(
            `SELECT COUNT(DISTINCT pm."userId")::int AS count
            FROM ${PACT_MEMBERS_TABLE_NAME} pm
            JOIN ${HABIT_CHECKINS_TABLE_NAME} c
                ON c."userId" = pm."userId"
                AND c."habitGoalId" = ?::uuid
                AND c.status = 'completed'
                AND c."scheduledDate" = ?::date
            WHERE pm."pactId" = ?::uuid
                AND pm.status = 'active'`,
            [habitGoalId, date, pactId],
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    /**
     * Distinct local days in [startDate, endDate] on which the user has at least one completed
     * check-in on any habit — the daily streak's "was day D upheld" input, in one query.
     * Returned as a Set of YYYY-MM-DD strings.
     */
    getCompletedLocalDates(userId: string, startDate: string, endDate: string): Promise<Set<string>> {
        const queryString = knexBuilder.raw(
            `SELECT DISTINCT "localDate"::text AS "localDate"
            FROM ${HABIT_CHECKINS_TABLE_NAME}
            WHERE "userId" = ?::uuid
                AND "status" = 'completed'
                AND "localDate" >= ?::date
                AND "localDate" <= ?::date`,
            [userId, startDate, endDate],
        ).toString();

        return this.db.read.query(queryString).then((response) => new Set<string>(
            response.rows.map((row: any) => String(row.localDate).slice(0, 10)),
        ));
    }

    /**
     * Which habit was completed on which local day in [startDate, endDate].
     *
     * `getCompletedLocalDates` above answers the daily streak's "was *anything* done on day D";
     * this answers "was *this habit* done on day D", which is what a cadence needs — a weekly
     * quota is per habit, so a day that carried habit A says nothing about habit B's quota. Both
     * exist because the boolean form is the hot path and stays one cheap DISTINCT.
     */
    getCompletedHabitLocalDates(
        userId: string,
        startDate: string,
        endDate: string,
    ): Promise<{ habitGoalId: string; localDate: string }[]> {
        const queryString = knexBuilder.raw(
            `SELECT DISTINCT "habitGoalId", "localDate"::text AS "localDate"
            FROM ${HABIT_CHECKINS_TABLE_NAME}
            WHERE "userId" = ?::uuid
                AND "status" = 'completed'
                AND "localDate" >= ?::date
                AND "localDate" <= ?::date`,
            [userId, startDate, endDate],
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            habitGoalId: String(row.habitGoalId),
            localDate: String(row.localDate).slice(0, 10),
        })));
    }

    /**
     * Completed check-ins per local day in [startDate, endDate] — the weekly recap's per-day
     * bar, in one query.
     *
     * Distinct from `getCompletedLocalDates`, which answers the daily streak's yes/no question
     * ("was any habit completed on day D"). The recap needs the count, because a user who moved
     * from one habit a day to three had a better week and a boolean cannot say so.
     */
    getCompletedCountsByLocalDate(userId: string, startDate: string, endDate: string): Promise<Map<string, number>> {
        const queryString = knexBuilder.raw(
            `SELECT "localDate"::text AS "localDate", COUNT(*)::int AS "completedCount"
            FROM ${HABIT_CHECKINS_TABLE_NAME}
            WHERE "userId" = ?::uuid
                AND "status" = 'completed'
                AND "localDate" >= ?::date
                AND "localDate" <= ?::date
            GROUP BY "localDate"`,
            [userId, startDate, endDate],
        ).toString();

        return this.db.read.query(queryString).then((response) => new Map<string, number>(
            response.rows.map((row: any) => [
                String(row.localDate).slice(0, 10),
                Number(row.completedCount) || 0,
            ]),
        ));
    }

    /**
     * Completed check-ins per habit in [startDate, endDate], newest habits included only if they
     * were actually completed — the recap's "which habit carried the week" list.
     *
     * Joined to habit_goals for the name and emoji the copy uses. A check-in whose goal row was
     * deleted keeps its count under a null name and is dropped by `rankRecapHabits` only if the
     * count is zero, so the name is coalesced here rather than left for the caller.
     */
    getCompletedCountsByHabitForLocalRange(
        userId: string,
        startDate: string,
        endDate: string,
    ): Promise<{ habitGoalId: string; name: string; emoji: string | null; completedCount: number }[]> {
        const queryString = knexBuilder.raw(
            `SELECT c."habitGoalId" AS "habitGoalId",
                COALESCE(g."name", '') AS "name",
                g."emoji" AS "emoji",
                COUNT(*)::int AS "completedCount"
            FROM ${HABIT_CHECKINS_TABLE_NAME} c
            LEFT JOIN ${HABIT_GOALS_TABLE_NAME} g ON g."id" = c."habitGoalId"
            WHERE c."userId" = ?::uuid
                AND c."status" = 'completed'
                AND c."localDate" >= ?::date
                AND c."localDate" <= ?::date
            GROUP BY c."habitGoalId", g."name", g."emoji"`,
            [userId, startDate, endDate],
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            habitGoalId: String(row.habitGoalId),
            name: String(row.name || ''),
            emoji: row.emoji || null,
            completedCount: Number(row.completedCount) || 0,
        })));
    }

    /** Earliest completed local day for a user, or undefined if they have never completed one. */
    getEarliestCompletedLocalDate(userId: string): Promise<string | undefined> {
        const queryString = knexBuilder.raw(
            `SELECT MIN("localDate")::text AS "localDate"
            FROM ${HABIT_CHECKINS_TABLE_NAME}
            WHERE "userId" = ?::uuid AND "status" = 'completed' AND "localDate" IS NOT NULL`,
            [userId],
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => (response.rows[0]?.localDate ? String(response.rows[0].localDate).slice(0, 10) : undefined));
    }

    /** How many completed check-ins (any habit) the user has on one local day. */
    countCompletedOnLocalDate(userId: string, localDate: string): Promise<number> {
        const queryString = knexBuilder
            .from(HABIT_CHECKINS_TABLE_NAME)
            .count('* as count')
            .where({ userId, localDate, status: 'completed' })
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    /**
     * How much each of a pact's members has saved toward its habit goal, in one query.
     *
     * Driven from `pact_members` rather than from check-ins, and LEFT JOINed, so a
     * member who has contributed nothing still comes back with a zero row. That is the
     * point: a savings pact's detail view has to be able to say "Sam: $0" — omitting
     * them would read as "Sam has no data" and is the difference between an
     * accountability feature and a leaderboard with survivorship bias.
     *
     * Every status is included, not just `active`. Someone who left a trip fund after
     * putting in $300 still put in $300, and dropping them would make the group total
     * disagree with the money. Callers that only want current participants filter on
     * the membership list they already hold.
     *
     * Matched on (userId, habitGoalId) rather than on `habit_checkins.pactId` for the
     * same reason `countCompletedActiveMembersForPact` is: a check-in stamps a single
     * pactId even when its goal backs several pacts, so the column undercounts a member
     * who holds the habit through more than one. The goal is the thing money is saved
     * toward.
     *
     * `status` is not filtered either. An amount is recorded by the act of entering it,
     * and a `partial` or `skipped` check-in that still moved money is still money — the
     * NULL/NOT NULL distinction on `savedAmount` already separates "no amount" from
     * "zero", which is the only distinction that matters here.
     */
    getSavingsTotalsByPactMember(pactId: string, habitGoalId: string): Promise<ISavingsTotalByUser[]> {
        const queryString = knexBuilder.raw(
            `SELECT pm."userId" AS "userId",
                COALESCE(SUM(c."savedAmount"), 0)::text AS "totalSaved",
                COUNT(c."savedAmount")::int AS "contributionCount"
            FROM ${PACT_MEMBERS_TABLE_NAME} pm
            LEFT JOIN ${HABIT_CHECKINS_TABLE_NAME} c
                ON c."userId" = pm."userId"
                AND c."habitGoalId" = ?::uuid
                AND c."savedAmount" IS NOT NULL
            WHERE pm."pactId" = ?::uuid
            GROUP BY pm."userId"`,
            [habitGoalId, pactId],
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            userId: String(row.userId),
            // SUM(numeric) is numeric, cast to text above and parsed here so the value
            // crosses the driver boundary exactly once and in one place.
            totalSaved: Number(row.totalSaved) || 0,
            contributionCount: Number(row.contributionCount) || 0,
        })));
    }

    /**
     * One user's savings total per habit goal, across every check-in they have made on
     * it — in one query for a whole list of goals.
     *
     * Intentionally not scoped to a pact or a date window. Money saved toward "trip
     * fund" does not stop existing when the pact cycle it was saved under ends, and a
     * renewal is a *new* pact row on the same goal (see `renewedFromPactId`), so
     * scoping to the current cycle would reset a saver's total to zero every time the
     * group re-committed — which is the one number they most expect to be cumulative.
     *
     * Goals with no recorded amounts are absent from the map rather than zero-valued;
     * callers reading a habit list should treat a miss as "nothing saved yet".
     */
    getSavingsTotalsByGoalForUser(
        userId: string,
        habitGoalIds: string[],
    ): Promise<Record<string, { totalSaved: number; contributionCount: number }>> {
        if (!habitGoalIds.length) {
            return Promise.resolve({});
        }

        // Built with the query builder rather than a raw `= ANY(?::uuid[])` so that
        // every id is escaped on its own. A hand-assembled `{a,b,c}` array literal
        // leaves a `,` or `}` inside one value free to split or terminate the list.
        const queryString = knexBuilder
            .from(HABIT_CHECKINS_TABLE_NAME)
            .select('habitGoalId')
            .select(knexBuilder.raw('SUM("savedAmount")::text AS "totalSaved"'))
            .select(knexBuilder.raw('COUNT(*)::int AS "contributionCount"'))
            .where({ userId })
            .whereNotNull('savedAmount')
            .whereIn('habitGoalId', habitGoalIds)
            .groupBy('habitGoalId')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce(
            (acc: Record<string, { totalSaved: number; contributionCount: number }>, row: any) => {
                acc[String(row.habitGoalId)] = {
                    totalSaved: Number(row.totalSaved) || 0,
                    contributionCount: Number(row.contributionCount) || 0,
                };
                return acc;
            },
            {},
        ));
    }

    create(params: ICreateHabitCheckinParams) {
        const queryString = knexBuilder
            .insert(withDefinedColumns({
                ...params,
                status: params.status || 'pending',
            }))
            .into(HABIT_CHECKINS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => normalizeCheckinRow(response.rows[0]));
    }

    createOrUpdate(params: ICreateHabitCheckinParams) {
        // Upsert based on unique constraint (userId, habitGoalId, scheduledDate)
        const insertParams = withDefinedColumns({
            ...params,
            status: params.status || 'pending',
        });

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
                // The first write's local day stands: a re-submission the next local day
                // (adding a note after midnight) must not move the check-in onto that day.
                localDate: knexBuilder.raw('COALESCE("habit_checkins"."localDate", excluded."localDate")'),
                completedAt: params.completedAt,
                notes: params.notes,
                selfRating: params.selfRating,
                difficultyRating: params.difficultyRating,
                hasProof: params.hasProof,
                // Last write wins, deliberately — unlike `localDate` above, which keeps
                // the first. A user correcting "I saved 20" to "I saved 30" for the same
                // day means the second number, and the alternative (summing repeat
                // submissions) would double-count every edit of a note or photo on a
                // check-in that already carried an amount.
                savedAmount: params.savedAmount,
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => normalizeCheckinRow(response.rows[0]));
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

        return this.db.write.query(queryString).then((response) => normalizeCheckinRow(response.rows[0]));
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

        return this.db.write.query(queryString).then((response) => normalizeCheckinRow(response.rows[0]));
    }
}
