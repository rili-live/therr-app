import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { DAILY_STREAK_DAYS_TABLE_NAME } from './tableNames';
import UserDailyStreaksStore from './UserDailyStreaksStore';
import { DailyStreakDayStatus } from '../utilities/dailyStreak';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * Re-exported rather than redeclared. This type had a second, independent definition here, and
 * adding 'rest' to the rules module left the two disagreeing — the column's CHECK constraint
 * accepted a value the store's type said could not exist. One definition, in the module that
 * owns the rules.
 */
export type { DailyStreakDayStatus };

export interface IDailyStreakDay {
    userId: string;
    localDate: string; // YYYY-MM-DD
    status: DailyStreakDayStatus;
    freezeHabitGoalId: string | null;
    streakAfter: number;
}

/**
 * The per-day ledger (`habits.daily_streak_days`) behind the app-level daily streak. See the
 * table migration for row semantics. Dates are returned as YYYY-MM-DD strings (see the note on
 * UserDailyStreaksStore).
 */
export default class DailyStreakDaysStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    private static normalize(row: any): IDailyStreakDay {
        return {
            userId: row.userId,
            localDate: UserDailyStreaksStore.dateToString(row.localDate),
            status: row.status,
            freezeHabitGoalId: row.freezeHabitGoalId || null,
            streakAfter: Number(row.streakAfter) || 0,
        };
    }

    getRange(userId: string, startDate: string, endDate: string): Promise<IDailyStreakDay[]> {
        const queryString = knexBuilder
            .from(DAILY_STREAK_DAYS_TABLE_NAME)
            .where({ userId })
            .andWhere('localDate', '>=', startDate)
            .andWhere('localDate', '<=', endDate)
            .orderBy('localDate', 'asc')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map(DailyStreakDaysStore.normalize));
    }

    getOnOrAfter(userId: string, startDate: string): Promise<IDailyStreakDay[]> {
        const queryString = knexBuilder
            .from(DAILY_STREAK_DAYS_TABLE_NAME)
            .where({ userId })
            .andWhere('localDate', '>=', startDate)
            .orderBy('localDate', 'asc')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map(DailyStreakDaysStore.normalize));
    }

    /** The most recent ledger row strictly before `date` — the state a rewind restores to. */
    getLatestBefore(userId: string, date: string): Promise<IDailyStreakDay | undefined> {
        const queryString = knexBuilder
            .from(DAILY_STREAK_DAYS_TABLE_NAME)
            .where({ userId })
            .andWhere('localDate', '<', date)
            .orderBy('localDate', 'desc')
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => (response.rows[0] ? DailyStreakDaysStore.normalize(response.rows[0]) : undefined));
    }

    /** The most recent *upheld* day strictly before `date` — what `lastUpheldDate` rewinds to. */
    getLatestUpheldBefore(userId: string, date: string): Promise<IDailyStreakDay | undefined> {
        const queryString = knexBuilder
            .from(DAILY_STREAK_DAYS_TABLE_NAME)
            .where({ userId, status: 'upheld' })
            .andWhere('localDate', '<', date)
            .orderBy('localDate', 'desc')
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => (response.rows[0] ? DailyStreakDaysStore.normalize(response.rows[0]) : undefined));
    }

    /**
     * Upsert a batch of days. The PK (userId, localDate) makes a re-run of the same walk
     * converge on the same rows rather than duplicating them.
     */
    upsertMany(days: Omit<IDailyStreakDay, 'userId'>[], userId: string): Promise<void> {
        if (!days.length) {
            return Promise.resolve();
        }

        const queryString = knexBuilder
            .insert(days.map((day) => ({
                userId,
                localDate: day.localDate,
                status: day.status,
                freezeHabitGoalId: day.freezeHabitGoalId || null,
                streakAfter: day.streakAfter,
            })))
            .into(DAILY_STREAK_DAYS_TABLE_NAME)
            .onConflict(['userId', 'localDate'])
            .merge({
                status: knexBuilder.raw('excluded."status"'),
                freezeHabitGoalId: knexBuilder.raw('excluded."freezeHabitGoalId"'),
                streakAfter: knexBuilder.raw('excluded."streakAfter"'),
            })
            .toString();

        return this.db.write.query(queryString).then(() => undefined);
    }

    /** Delete every row on or after `date`; returns the deleted rows so freezes can be refunded. */
    deleteOnOrAfter(userId: string, date: string): Promise<IDailyStreakDay[]> {
        const queryString = knexBuilder
            .from(DAILY_STREAK_DAYS_TABLE_NAME)
            .where({ userId })
            .andWhere('localDate', '>=', date)
            .delete()
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows.map(DailyStreakDaysStore.normalize));
    }
}
