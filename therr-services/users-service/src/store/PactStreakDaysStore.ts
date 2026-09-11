import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACT_STREAK_DAYS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreatePactStreakDayParams {
    pactId: string;
    streakDate: string; // YYYY-MM-DD
    activeMemberCount: number;
    completedCount: number;
}

/**
 * The per-day majority ledger (`habits.pact_streak_days`) — one row per pact per day the
 * pact's active members hit their majority threshold. See the table migration for why this
 * ledger backs both the shared pact streak and individual streak protection.
 */
export default class PactStreakDaysStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Credit a day for a pact. Idempotent: the UNIQUE (pactId, streakDate) means a repeat
     * credit — a second check-in the same day, a retry — inserts nothing and returns
     * undefined, which is exactly the signal the caller needs to decide whether *this* was
     * the check-in that first won the day (and so should advance the shared streak).
     */
    create(params: ICreatePactStreakDayParams) {
        const queryString = knexBuilder
            .insert(params)
            .into(PACT_STREAK_DAYS_TABLE_NAME)
            .onConflict(['pactId', 'streakDate'])
            .ignore()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    getByPactAndDate(pactId: string, streakDate: string) {
        const queryString = knexBuilder
            .from(PACT_STREAK_DAYS_TABLE_NAME)
            .where({ pactId, streakDate })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Distinct credited days for a set of pacts strictly *between* two dates (exclusive of
     * both ends) — the days a member's gap can be forgiven for, since the endpoints are the
     * member's own last completion and current check-in. Returns 0 for an empty pact list.
     *
     * DISTINCT on streakDate so a member in two pacts on the same habit that both won the
     * same day counts that day once, not twice.
     */
    countCoveredDatesForPacts(pactIds: string[], afterDate: string, beforeDate: string): Promise<number> {
        if (!pactIds.length) {
            return Promise.resolve(0);
        }

        const queryString = knexBuilder
            .countDistinct('streakDate as count')
            .from(PACT_STREAK_DAYS_TABLE_NAME)
            .whereIn('pactId', pactIds)
            .andWhere('streakDate', '>', afterDate)
            .andWhere('streakDate', '<', beforeDate)
            .toString();

        return this.db.read.query(queryString).then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }
}
