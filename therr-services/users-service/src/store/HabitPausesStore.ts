import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { HABIT_PAUSES_TABLE_NAME } from './tableNames';
import { IHabitPauseRow } from '../utilities/habitPause';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * `habits.habit_pauses` — see the migration (20261107000001) and utilities/habitPause.ts for what
 * a pause means. Not brand-scoped: `habits.*` belongs to Friends with Habits alone, like the
 * neighbouring `habits.user_habits` and `habits.streaks`.
 *
 * `pausedOn` / `resumedOn` are selected as text so a caller always gets 'YYYY-MM-DD' in the
 * user's own calendar, never a Date the driver shifted into the service's zone.
 */
const SELECT_COLUMNS = `"id", "userId", "habitGoalId",
    "pausedOn"::text AS "pausedOn", "resumedOn"::text AS "resumedOn",
    "pausedAt", "resumedAt", "streakAtPause", "createdAt", "updatedAt"`;

export default class HabitPausesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    getById(id: string): Promise<IHabitPauseRow | undefined> {
        const queryString = knexBuilder.raw(
            `SELECT ${SELECT_COLUMNS} FROM ${HABIT_PAUSES_TABLE_NAME} WHERE "id" = ?::uuid`,
            [id],
        ).toString();
        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /** The open pause on this habit, if any. At most one exists (partial unique index). */
    getOpen(userId: string, habitGoalId: string): Promise<IHabitPauseRow | undefined> {
        const queryString = knexBuilder.raw(
            `SELECT ${SELECT_COLUMNS} FROM ${HABIT_PAUSES_TABLE_NAME}
             WHERE "userId" = ?::uuid AND "habitGoalId" = ?::uuid AND "resumedOn" IS NULL
             LIMIT 1`,
            [userId, habitGoalId],
        ).toString();
        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /** The most recent pause on this habit that has ended — what the re-pause cooldown reads. */
    getLastClosed(userId: string, habitGoalId: string): Promise<IHabitPauseRow | undefined> {
        const queryString = knexBuilder.raw(
            `SELECT ${SELECT_COLUMNS} FROM ${HABIT_PAUSES_TABLE_NAME}
             WHERE "userId" = ?::uuid AND "habitGoalId" = ?::uuid AND "resumedOn" IS NOT NULL
             ORDER BY "resumedOn" DESC, "resumedAt" DESC
             LIMIT 1`,
            [userId, habitGoalId],
        ).toString();
        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Every pause of this user's that overlaps [fromDate, upTo] — on every habit, or on one when
     * `habitGoalId` is given. A pause overlaps when it began on or before `upTo` and was still open
     * on `fromDate` (it ends strictly after it, or has not ended).
     */
    getOverlapping(userId: string, fromDate: string, upTo: string, habitGoalId?: string): Promise<IHabitPauseRow[]> {
        const bindings: any[] = [userId, upTo, fromDate];
        let habitPredicate = '';
        if (habitGoalId) {
            bindings.push(habitGoalId);
            habitPredicate = 'AND "habitGoalId" = ?::uuid';
        }
        const queryString = knexBuilder.raw(
            `SELECT ${SELECT_COLUMNS} FROM ${HABIT_PAUSES_TABLE_NAME}
             WHERE "userId" = ?::uuid
                AND "pausedOn" <= ?::date
                AND ("resumedOn" IS NULL OR "resumedOn" > ?::date)
                ${habitPredicate}
             ORDER BY "pausedOn" ASC`,
            bindings,
        ).toString();
        return this.db.read.query(queryString).then((response) => response.rows as IHabitPauseRow[]);
    }

    /** Which of these habits this user has paused right now. */
    getOpenHabitGoalIds(userId: string, habitGoalIds: string[]): Promise<Set<string>> {
        if (!habitGoalIds.length) {
            return Promise.resolve(new Set());
        }
        const queryString = knexBuilder
            .from(HABIT_PAUSES_TABLE_NAME)
            .select('habitGoalId')
            .where({ userId })
            .whereNull('resumedOn')
            .whereIn('habitGoalId', habitGoalIds)
            .toString();
        return this.db.read.query(queryString)
            .then((response) => new Set<string>(response.rows.map((row: any) => row.habitGoalId)));
    }

    /**
     * `${userId}:${habitGoalId}` for every open pause these users hold — one read for a whole digest
     * run, in the same key shape as `pairKey` in utilities/habitLifecycleContext.ts.
     */
    getOpenPairKeys(userIds: string[]): Promise<Set<string>> {
        if (!userIds.length) {
            return Promise.resolve(new Set());
        }
        const queryString = knexBuilder
            .from(HABIT_PAUSES_TABLE_NAME)
            .select('userId', 'habitGoalId')
            .whereNull('resumedOn')
            .whereIn('userId', Array.from(new Set(userIds)))
            .toString();
        return this.db.read.query(queryString)
            .then((response) => new Set<string>(response.rows.map((row: any) => `${row.userId}:${row.habitGoalId}`)));
    }

    /**
     * `${userId}:${habitGoalId}` for every pair that cannot be paused right now: an open pause, or one
     * that ended after `cooldownStart` (the re-pause cooldown — see `getPauseEligibility`, which this
     * mirrors in SQL so a whole digest run is one read).
     */
    getUnpausablePairKeys(pairs: { userId: string; habitGoalId: string }[], cooldownStart: string): Promise<Set<string>> {
        if (!pairs.length) {
            return Promise.resolve(new Set());
        }
        const tuples = pairs.map(() => '(?::uuid, ?::uuid)').join(', ');
        const bindings = pairs.reduce((acc: string[], pair) => acc.concat([pair.userId, pair.habitGoalId]), []);
        const queryString = knexBuilder.raw(
            `SELECT DISTINCT "userId", "habitGoalId" FROM ${HABIT_PAUSES_TABLE_NAME}
             WHERE ("userId", "habitGoalId") IN (${tuples})
                AND ("resumedOn" IS NULL OR "resumedOn" > ?::date)`,
            [...bindings, cooldownStart],
        ).toString();
        return this.db.read.query(queryString)
            .then((response) => new Set<string>(response.rows.map((row: any) => `${row.userId}:${row.habitGoalId}`)));
    }

    /**
     * Open a pause. Returns undefined when one is already open — the partial unique index refuses
     * the second row, which is how a double-tap stays a single pause.
     */
    create(params: { userId: string; habitGoalId: string; pausedOn: string; streakAtPause: number }): Promise<IHabitPauseRow | undefined> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${HABIT_PAUSES_TABLE_NAME} ("userId", "habitGoalId", "pausedOn", "streakAtPause")
             VALUES (?::uuid, ?::uuid, ?::date, ?)
             ON CONFLICT ("userId", "habitGoalId") WHERE "resumedOn" IS NULL DO NOTHING
             RETURNING ${SELECT_COLUMNS}`,
            [params.userId, params.habitGoalId, params.pausedOn, Math.max(0, Math.floor(Number(params.streakAtPause) || 0))],
        ).toString();
        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Close the open pause on this habit as of `resumedOn`. A pause that would close on (or
     * before) the day it opened covers no days and is deleted instead — that is an undo, and it
     * must not start the re-pause cooldown. Returns what happened, or undefined when nothing was
     * open (a second resume is a no-op).
     */
    async close(userId: string, habitGoalId: string, resumedOn: string): Promise<{ action: 'closed' | 'undone'; pause: IHabitPauseRow } | undefined> {
        const undoQuery = knexBuilder.raw(
            `DELETE FROM ${HABIT_PAUSES_TABLE_NAME}
             WHERE "userId" = ?::uuid AND "habitGoalId" = ?::uuid AND "resumedOn" IS NULL
                AND "pausedOn" >= ?::date
             RETURNING ${SELECT_COLUMNS}`,
            [userId, habitGoalId, resumedOn],
        ).toString();
        const undone = await this.db.write.query(undoQuery).then((response) => response.rows[0]);
        if (undone) {
            return { action: 'undone', pause: undone };
        }

        const closeQuery = knexBuilder.raw(
            `UPDATE ${HABIT_PAUSES_TABLE_NAME}
             SET "resumedOn" = ?::date, "resumedAt" = now(), "updatedAt" = now()
             WHERE "userId" = ?::uuid AND "habitGoalId" = ?::uuid AND "resumedOn" IS NULL
             RETURNING ${SELECT_COLUMNS}`,
            [resumedOn, userId, habitGoalId],
        ).toString();
        const closed = await this.db.write.query(closeQuery).then((response) => response.rows[0]);
        return closed ? { action: 'closed', pause: closed } : undefined;
    }
}
