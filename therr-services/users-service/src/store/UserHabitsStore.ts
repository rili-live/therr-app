import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    HABIT_CHECKINS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    PACTS_TABLE_NAME,
    PACT_MEMBERS_TABLE_NAME,
    STREAKS_TABLE_NAME,
    USER_HABITS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * The registry of "habits this user is tracking" — see
 * `20260815000001_habits.user_habits.js` for why it exists.
 *
 * Not brand-scoped, and deliberately so: `habits.*` is a niche schema owned
 * entirely by Friends with Habits, so — like `habits.streaks` next door — there
 * is no cross-brand read for a `brandVariation` predicate to protect. The
 * brand-scoping rule applies to `main.*` tables that several apps share.
 */
export type UserHabitStatus = 'active' | 'archived';

export interface IUserHabitRow {
    id: string;
    userId: string;
    habitGoalId: string;
    status: UserHabitStatus;
    startedAt: Date;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * A tracked habit joined to the goal it points at, plus the two facts the
 * dashboard needs and cannot cheaply derive client-side: whether a pact is
 * currently backing it, and where the streak stands.
 *
 * `isSolo` is computed here rather than stored — see the migration header. It
 * is `true` exactly when no *active* pact covers this (userId, habitGoalId),
 * which means a habit whose pact was abandoned quietly becomes personal instead
 * of disappearing from the dashboard.
 */
export interface IUserHabitDetail extends IUserHabitRow {
    goalName: string;
    goalEmoji: string | null;
    goalCategory: string | null;
    goalType: string;
    frequencyType: string;
    frequencyCount: number | null;
    targetDaysOfWeek: number[] | null;
    cadenceEffectiveFrom: string | null;
    /**
     * Completed days for this habit earlier in the user's current week, excluding today.
     * NULL when the caller did not supply week bounds — see `getDetailByUser`.
     */
    completionsEarlierThisWeek: number | null;
    isSolo: boolean;
    activePactCount: number;
    currentStreak: number;
    longestStreak: number;
    /**
     * A pact this user created for this habit that is still `pending` — i.e. no
     * invitee has accepted yet. Null once a partner joins (the pact activates) or
     * when the habit was started solo in the first place.
     *
     * This is what lets a client tell "waiting on a friend" apart from a genuine
     * solo habit: both read `isSolo = true` (no *active* pact backs them), but
     * only the former has an outstanding invite. It is the signal behind the
     * "continue solo or archive?" prompt — a habit whose reminders are firing
     * while the user waits on someone who may never accept.
     */
    pendingPactId: string | null;
}

/**
 * One row of the daily-reminder universe: everything the digest needs to decide
 * whether to nudge this (user, habit) today, gathered in a single query.
 *
 * Deliberately flatter than `IUserHabitDetail` — the digest does not want the
 * dashboard's shape, it wants the cadence, the streak and whether today is
 * already done, for every active habit in the system at once.
 */
export interface IUserHabitReminderRow {
    userId: string;
    habitGoalId: string;
    goalName: string;
    frequencyType: string;
    frequencyCount: number | null;
    targetDaysOfWeek: number[] | null;
    cadenceEffectiveFrom: string | null;
    currentStreak: number;
    streakIsActive: boolean;
    gracePeriodDays: number;
    graceDaysUsed: number;
    lastCompletedDate: string | null;
    completedToday: boolean;
    /** Completed check-ins for this habit earlier in the current week, excluding today. */
    completionsEarlierThisWeek: number;
    activePactId: string | null;
}

/**
 * One active habit's cadence, for deciding whether a given local day was required of the user.
 * See `getActiveCadencesByUser`.
 */
export interface IUserHabitCadence {
    habitGoalId: string;
    startedAt: Date;
    frequencyType: string;
    frequencyCount: number | null;
    targetDaysOfWeek: number[] | null;
    cadenceEffectiveFrom: string | null;
}

export default class UserHabitsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, limit?: number) {
        let queryString = knexBuilder
            .from(USER_HABITS_TABLE_NAME)
            .where(conditions);

        if (limit) {
            queryString = queryString.limit(limit);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows as IUserHabitRow[]);
    }

    getById(id: string): Promise<IUserHabitRow | undefined> {
        return this.get({ id }, 1).then((rows) => rows[0]);
    }

    getByUserAndHabit(userId: string, habitGoalId: string): Promise<IUserHabitRow | undefined> {
        return this.get({ userId, habitGoalId }, 1).then((rows) => rows[0]);
    }

    /**
     * The number that the free-tier cap is measured against.
     *
     * Counts only `active` rows, which is what makes archiving a real escape
     * hatch rather than a cosmetic one: a user at the limit can archive a habit
     * they have stopped doing and immediately start another, without paying and
     * without losing the archived habit's check-ins or streak history.
     */
    countActiveByUser(userId: string): Promise<number> {
        const queryString = knexBuilder
            .from(USER_HABITS_TABLE_NAME)
            .where({ userId, status: 'active' })
            .count('id as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    /**
     * Just enough of each active habit to decide, for any given local day, whether that day was
     * *required* of the user — the input the app-level daily streak needs to tell a rest day
     * from a missed one.
     *
     * Deliberately lean and deliberately keyed on `habits.user_habits` rather than on
     * `habits.streaks`, which the freeze pool is read from. A streak row is only created on the
     * first check-in, so a habit the user started but has not yet logged has no streak row — and
     * that habit is exactly the one whose cadence can make today required. Reading the tracking
     * registry instead is what keeps a brand-new habit from being invisible to the walk.
     *
     * `startedAt` comes back so the caller can leave days before the habit existed alone: a habit
     * started on Thursday cannot have required Monday.
     */
    getActiveCadencesByUser(userId: string): Promise<IUserHabitCadence[]> {
        const queryString = knexBuilder.raw(
            `SELECT uh."habitGoalId" AS "habitGoalId",
                uh."startedAt" AS "startedAt",
                g."frequencyType" AS "frequencyType",
                g."frequencyCount" AS "frequencyCount",
                g."targetDaysOfWeek" AS "targetDaysOfWeek",
                g."cadenceEffectiveFrom"::text AS "cadenceEffectiveFrom"
            FROM ${USER_HABITS_TABLE_NAME} uh
            INNER JOIN ${HABIT_GOALS_TABLE_NAME} g ON g."id" = uh."habitGoalId"
            WHERE uh."userId" = ?::uuid
                AND uh."status" = 'active'`,
            [userId],
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows as IUserHabitCadence[]);
    }

    /**
     * Full detail for the dashboard and the `user-habits` list endpoint.
     *
     * The pact join is an aggregate rather than a row join because a habit can
     * legitimately be backed by more than one active pact — the same goal with
     * two different partners is a supported shape, and joining rows would
     * duplicate the habit once per pact.
     *
     * `weekBounds` is the user's own Monday and their own today. Supplying it adds this
     * week's completed-day tally per habit, which is what the caller turns into
     * `weekProgress` ("2 of 4 this week"). It is optional because the tally is only
     * meaningful against a resolved timezone: without one the column comes back NULL and the
     * caller omits `weekProgress` entirely rather than reporting a confident zero — a client
     * that renders "0 of 4" for someone who trained four times is worse than one that renders
     * nothing.
     */
    getDetailByUser(
        userId: string,
        status?: UserHabitStatus,
        weekBounds?: { weekStart: string; today: string },
    ): Promise<IUserHabitDetail[]> {
        // Bindings are positional, so they must be pushed in the order their `?` appears in
        // the SQL below — the week tally sits in the SELECT list and therefore binds BEFORE
        // the WHERE clause's userId and status.
        const bindings: any[] = [];

        // Days strictly BEFORE today, matching what `isRequiredOn` and `describeWeekProgress`
        // expect for `completionsEarlierThisWeek` — the same convention as the identical
        // subquery in `getActiveForReminders`.
        let weekTallyColumn = 'NULL::int';
        if (weekBounds) {
            bindings.push(weekBounds.weekStart, weekBounds.today);
            weekTallyColumn = `(
                    SELECT COUNT(DISTINCT c."scheduledDate")::int
                    FROM ${HABIT_CHECKINS_TABLE_NAME} c
                    WHERE c."userId" = uh."userId"
                        AND c."habitGoalId" = uh."habitGoalId"
                        AND c."scheduledDate" >= ?::date
                        AND c."scheduledDate" < ?::date
                        AND c."status" = 'completed'
                )`;
        }

        bindings.push(userId);
        let statusPredicate = '';
        if (status) {
            bindings.push(status);
            statusPredicate = 'AND uh."status" = ?';
        }

        const queryString = knexBuilder.raw(
            `SELECT
                uh.*,
                g."name" AS "goalName",
                g."emoji" AS "goalEmoji",
                g."category" AS "goalCategory",
                g."goalType" AS "goalType",
                g."frequencyType" AS "frequencyType",
                g."frequencyCount" AS "frequencyCount",
                g."targetDaysOfWeek" AS "targetDaysOfWeek",
                g."cadenceEffectiveFrom"::text AS "cadenceEffectiveFrom",
                ${weekTallyColumn} AS "completionsEarlierThisWeek",
                COALESCE(s."currentStreak", 0) AS "currentStreak",
                COALESCE(s."longestStreak", 0) AS "longestStreak",
                COALESCE(pact_counts."activePactCount", 0) AS "activePactCount",
                COALESCE(pact_counts."activePactCount", 0) = 0 AS "isSolo",
                (
                    SELECT p."id"
                    FROM ${PACTS_TABLE_NAME} p
                    WHERE p."creatorUserId" = uh."userId"
                        AND p."habitGoalId" = uh."habitGoalId"
                        AND p."status" = 'pending'
                    ORDER BY p."createdAt" ASC
                    LIMIT 1
                ) AS "pendingPactId"
            FROM ${USER_HABITS_TABLE_NAME} uh
            INNER JOIN ${HABIT_GOALS_TABLE_NAME} g ON g."id" = uh."habitGoalId"
            LEFT JOIN ${STREAKS_TABLE_NAME} s
                ON s."userId" = uh."userId" AND s."habitGoalId" = uh."habitGoalId"
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS "activePactCount"
                FROM ${PACT_MEMBERS_TABLE_NAME} pm
                INNER JOIN ${PACTS_TABLE_NAME} p ON p."id" = pm."pactId"
                WHERE pm."userId" = uh."userId"
                    AND pm."status" = 'active'
                    AND p."habitGoalId" = uh."habitGoalId"
                    AND p."status" = 'active'
            ) pact_counts ON true
            WHERE uh."userId" = ?::uuid ${statusPredicate}
            ORDER BY uh."status" ASC, uh."startedAt" DESC`,
            bindings,
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows as IUserHabitDetail[]);
    }

    /**
     * Every actively-tracked habit in the system, for the daily reminder pass.
     *
     * WHY THIS EXISTS AND NOT A LOOP OVER PACTS
     *
     * The digest used to reach users only through `habits.pacts`, so a user
     * with a solo habit — or a user whose pact ended — generated zero sends,
     * forever. `habits.user_habits` is the registry of what people are actually
     * trying to do, solo and pact-backed alike, so it is the correct spine for
     * "remind me to do my habit today".
     *
     * One query for the whole run, in the same spirit as
     * `buildHabitLifecycleContext`: the alternative is a per-habit check-in
     * lookup and a per-habit streak lookup, which turns a background job into
     * thousands of round trips against the read pool.
     *
     * `activePactId` is a sample, not a count — it exists so reminder copy can
     * deep-link into a pact when one happens to back the habit, and is null for
     * a solo habit. Pact-scoped notifications still come from the pact loop.
     */
    getActiveForReminders(today: string, weekStart: string, limit: number): Promise<IUserHabitReminderRow[]> {
        const queryString = knexBuilder.raw(
            `SELECT
                uh."userId",
                uh."habitGoalId",
                g."name" AS "goalName",
                g."frequencyType" AS "frequencyType",
                g."frequencyCount" AS "frequencyCount",
                g."targetDaysOfWeek" AS "targetDaysOfWeek",
                g."cadenceEffectiveFrom"::text AS "cadenceEffectiveFrom",
                COALESCE(s."currentStreak", 0) AS "currentStreak",
                COALESCE(s."isActive", false) AS "streakIsActive",
                COALESCE(s."gracePeriodDays", 0) AS "gracePeriodDays",
                COALESCE(s."graceDaysUsed", 0) AS "graceDaysUsed",
                s."lastCompletedDate" AS "lastCompletedDate",
                EXISTS (
                    SELECT 1
                    FROM ${HABIT_CHECKINS_TABLE_NAME} c
                    WHERE c."userId" = uh."userId"
                        AND c."habitGoalId" = uh."habitGoalId"
                        AND c."scheduledDate" = ?::date
                        AND c."status" = 'completed'
                ) AS "completedToday",
                (
                    -- How much of this week's quota is already discharged, counting days
                    -- strictly BEFORE today so it lines up with what \`isRequiredOn\` and
                    -- \`describeWeekProgress\` expect. Without it a weekly cadence has no way to
                    -- know whether it still owes the user a nudge, and the old code fell back to
                    -- a spacing heuristic that nudged a 4x/week habit all seven days.
                    SELECT COUNT(DISTINCT c2."scheduledDate")::int
                    FROM ${HABIT_CHECKINS_TABLE_NAME} c2
                    WHERE c2."userId" = uh."userId"
                        AND c2."habitGoalId" = uh."habitGoalId"
                        AND c2."scheduledDate" >= ?::date
                        AND c2."scheduledDate" < ?::date
                        AND c2."status" = 'completed'
                ) AS "completionsEarlierThisWeek",
                (
                    SELECT p."id"
                    FROM ${PACT_MEMBERS_TABLE_NAME} pm
                    INNER JOIN ${PACTS_TABLE_NAME} p ON p."id" = pm."pactId"
                    WHERE pm."userId" = uh."userId"
                        AND pm."status" = 'active'
                        AND p."habitGoalId" = uh."habitGoalId"
                        AND p."status" = 'active'
                    ORDER BY p."createdAt" ASC
                    LIMIT 1
                ) AS "activePactId"
            FROM ${USER_HABITS_TABLE_NAME} uh
            INNER JOIN ${HABIT_GOALS_TABLE_NAME} g ON g."id" = uh."habitGoalId"
            LEFT JOIN ${STREAKS_TABLE_NAME} s
                ON s."userId" = uh."userId" AND s."habitGoalId" = uh."habitGoalId"
            WHERE uh."status" = 'active'
            ORDER BY uh."startedAt" ASC, uh."id" ASC
            LIMIT ?`,
            [today, weekStart, today, limit],
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows as IUserHabitReminderRow[]);
    }

    /**
     * Insert-or-return.
     *
     * ON CONFLICT DO NOTHING + a follow-up read rather than DO UPDATE: this is
     * called from several places that all mean "make sure this habit is
     * tracked" (pact create, pact accept, first check-in, explicit solo start),
     * and none of them should overwrite state another one just wrote. In
     * particular an `archived` row must stay archived — a stray check-in on an
     * archived habit should not silently un-archive it and put the user back
     * over the cap.
     */
    async getOrCreate(userId: string, habitGoalId: string): Promise<IUserHabitRow> {
        const insertQuery = knexBuilder.raw(
            `INSERT INTO ${USER_HABITS_TABLE_NAME} ("userId", "habitGoalId")
             VALUES (?::uuid, ?::uuid)
             ON CONFLICT ("userId", "habitGoalId") DO NOTHING
             RETURNING *`,
            [userId, habitGoalId],
        ).toString();

        const inserted = await this.db.write.query(insertQuery).then((response) => response.rows[0]);
        if (inserted) {
            return inserted as IUserHabitRow;
        }

        return this.getByUserAndHabit(userId, habitGoalId) as Promise<IUserHabitRow>;
    }

    /**
     * Flip status, guarded in SQL on the *current* status.
     *
     * The guard matters because both directions are cap-relevant: a double
     * archive request would otherwise stamp a second `archivedAt`, and a double
     * restore would pass the capacity check twice for one slot. `rowCount` of 0
     * means "already in that state", which callers treat as a no-op rather than
     * an error.
     */
    setStatus(id: string, userId: string, nextStatus: UserHabitStatus) {
        const queryString = knexBuilder.raw(
            `UPDATE ${USER_HABITS_TABLE_NAME}
             SET "status" = ?,
                 "archivedAt" = CASE WHEN ? = 'archived' THEN now() ELSE NULL END,
                 "updatedAt" = now()
             WHERE "id" = ?::uuid AND "userId" = ?::uuid AND "status" <> ?
             RETURNING *`,
            [nextStatus, nextStatus, id, userId, nextStatus],
        ).toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as IUserHabitRow | undefined);
    }

    /**
     * Bring an archived habit back to `active`, addressed by (userId, habitGoalId)
     * rather than by row id.
     *
     * The one caller is pact acceptance: a user who archived a habit while its
     * invite sat unanswered — to stop the reminders for something they were
     * waiting on — should have it come back the moment a partner actually joins.
     * `getOrCreate` deliberately will *not* do this (an archived row must survive
     * a stray check-in), so reviving is a separate, explicit verb used only where
     * the resurrection is the intended effect.
     *
     * Keyed on the habit rather than the row id because the caller (acceptPact)
     * holds the pact's habitGoalId, not the creator's tracking-row id, and looking
     * the id up first would be a redundant round trip. The `status = 'archived'`
     * guard makes it a no-op (rowCount 0) for a habit that is already active,
     * which every acceptance after the first will be.
     */
    reviveArchivedByHabit(userId: string, habitGoalId: string) {
        const queryString = knexBuilder.raw(
            `UPDATE ${USER_HABITS_TABLE_NAME}
             SET "status" = 'active',
                 "archivedAt" = NULL,
                 "updatedAt" = now()
             WHERE "userId" = ?::uuid AND "habitGoalId" = ?::uuid AND "status" = 'archived'
             RETURNING *`,
            [userId, habitGoalId],
        ).toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as IUserHabitRow | undefined);
    }

    delete(id: string, userId: string) {
        const queryString = knexBuilder
            .from(USER_HABITS_TABLE_NAME)
            .where({ id, userId })
            .delete()
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
