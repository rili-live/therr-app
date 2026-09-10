import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { HABIT_PHASES_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * Lifecycle state per (user, habit goal). See docs/HABIT_LIFECYCLE_MESSAGING.md.
 *
 * Not brand-scoped, and deliberately so: `habits.*` is a niche schema owned
 * entirely by Friends with Habits, so — like `habits.streaks` next door — there
 * is no cross-brand read for a `brandVariation` predicate to protect. The
 * brand-scoping rule applies to `main.*` tables that several apps share.
 */
export type HabitPhase = 'forming' | 'established' | 'maintaining' | 'lapsed';

export interface IHabitPhaseRow {
    id: string;
    userId: string;
    habitGoalId: string;
    phase: HabitPhase;
    establishedAt: string | null;
    automaticityAt: string | null;
    maintenanceStage: number;
    lapsedAt: string | null;
    lastComebackAt: string | null;
    // Email watermarks, written by therr-messaging-automator's
    // `habits-milestone-emails` task — deliberately NOT the same columns as the
    // push side, so neither channel suppresses the other. Nothing in this
    // service writes them; they are declared here so the shape of a row read
    // back from this table is complete and honest.
    maintenanceEmailedStage: number;
    lastComebackEmailedAt: string | null;
    // Written by this service on every evaluated run; read by the automator so
    // both channels quote the same number.
    lastConsistencyPercent: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUpdateHabitPhaseParams {
    phase?: HabitPhase;
    establishedAt?: string | null;
    automaticityAt?: string | null;
    maintenanceStage?: number;
    lapsedAt?: string | null;
    lastComebackAt?: string | null;
    lastConsistencyPercent?: number;
}

export default class HabitPhasesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, limit?: number) {
        let queryString = knexBuilder
            .from(HABIT_PHASES_TABLE_NAME)
            .where(conditions);

        if (limit) {
            queryString = queryString.limit(limit);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows as IHabitPhaseRow[]);
    }

    getByUserAndHabit(userId: string, habitGoalId: string): Promise<IHabitPhaseRow | undefined> {
        return this.get({ userId, habitGoalId }).then((rows) => rows[0]);
    }

    /**
     * Batch lookup for the digest, which evaluates every member of every active
     * pact on one run. The per-pact loop would otherwise issue a query per
     * member per pact — the read-pool spike the digest's sequential structure
     * exists to avoid in the first place.
     *
     * Returns a map keyed `${userId}:${habitGoalId}`; a missing key means the
     * habit has no phase row yet, which the engine reads as 'forming'.
     */
    getByUserHabitPairs(pairs: { userId: string; habitGoalId: string }[]): Promise<Record<string, IHabitPhaseRow>> {
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
            SELECT p.* FROM ${HABIT_PHASES_TABLE_NAME} p
            JOIN pairs ON pairs."userId" = p."userId" AND pairs."habitGoalId" = p."habitGoalId"`,
            bindings,
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce(
            (acc: Record<string, IHabitPhaseRow>, row: IHabitPhaseRow) => {
                acc[`${row.userId}:${row.habitGoalId}`] = row;
                return acc;
            },
            {},
        ));
    }

    /**
     * Insert-or-return for the phase row.
     *
     * ON CONFLICT DO NOTHING + a follow-up read rather than DO UPDATE: two
     * digest runs racing (a retry overlapping the scheduled firing) must not
     * have the second one clobber phase state the first just advanced. The
     * conflict path means "someone else created it, use theirs".
     */
    async getOrCreate(userId: string, habitGoalId: string): Promise<IHabitPhaseRow> {
        const insertQuery = knexBuilder.raw(
            `INSERT INTO ${HABIT_PHASES_TABLE_NAME} ("userId", "habitGoalId")
             VALUES (?::uuid, ?::uuid)
             ON CONFLICT ("userId", "habitGoalId") DO NOTHING
             RETURNING *`,
            [userId, habitGoalId],
        ).toString();

        const inserted = await this.db.write.query(insertQuery).then((response) => response.rows[0]);
        if (inserted) {
            return inserted as IHabitPhaseRow;
        }

        return this.getByUserAndHabit(userId, habitGoalId) as Promise<IHabitPhaseRow>;
    }

    update(id: string, params: IUpdateHabitPhaseParams) {
        const queryString = knexBuilder
            .from(HABIT_PHASES_TABLE_NAME)
            .where({ id })
            .update({ ...params, updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as IHabitPhaseRow);
    }

    /**
     * Advance the recorded maintenance stage, but never backwards.
     *
     * The guard is in SQL rather than in the caller because this is the
     * monotonicity invariant the 30/60/90 sweep depends on: a run that
     * re-evaluates an older stage (clock skew, a replayed digest, a threshold
     * retune that shifts an anchor) must not be able to reopen a check-in the
     * user already received. `rowCount` of 0 means "already past this stage".
     */
    advanceMaintenanceStage(id: string, stage: number) {
        const queryString = knexBuilder.raw(
            `UPDATE ${HABIT_PHASES_TABLE_NAME}
             SET "maintenanceStage" = ?, "updatedAt" = now()
             WHERE "id" = ?::uuid AND "maintenanceStage" < ?`,
            [stage, id, stage],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }
}
