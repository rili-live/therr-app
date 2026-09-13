import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { STREAKS_TABLE_NAME, USERS_TABLE_NAME, USER_DAILY_STREAKS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface IDBUserDailyStreak {
    userId: string;
    currentStreak: number;
    longestStreak: number;
    lastUpheldDate: string | null;
    lastEvaluatedDate: string | null;
    lastCelebratedDate: string | null;
    consecutivePerfectWeeks: number;
    lastResetFromStreak: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUpdateUserDailyStreakParams {
    currentStreak?: number;
    longestStreak?: number;
    lastUpheldDate?: string | null;
    lastEvaluatedDate?: string | null;
    lastCelebratedDate?: string | null;
    consecutivePerfectWeeks?: number;
    lastResetFromStreak?: number;
}

/** A user the nightly pass should evaluate, with the timezone their local day is computed in. */
export interface IDailyStreakEvaluationTarget {
    userId: string;
    settingsTimezone: string | null;
}

/**
 * One row per user: the app-level daily streak (`habits.user_daily_streaks`). See the table
 * migration for column semantics and utilities/dailyStreak.ts for the rules.
 *
 * Every date column is returned as a YYYY-MM-DD string rather than the Date object `pg`
 * deserialises `date` columns to. The evaluator compares dates as strings, and a Date here is
 * the classic off-by-one trap (a `date` parsed at UTC midnight then formatted locally).
 */
export default class UserDailyStreaksStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    private static normalize(row: any): IDBUserDailyStreak | undefined {
        if (!row) {
            return undefined;
        }
        const toDateString = (value: any) => (value ? UserDailyStreaksStore.dateToString(value) : null);
        return {
            ...row,
            currentStreak: Number(row.currentStreak) || 0,
            longestStreak: Number(row.longestStreak) || 0,
            consecutivePerfectWeeks: Number(row.consecutivePerfectWeeks) || 0,
            lastResetFromStreak: Number(row.lastResetFromStreak) || 0,
            lastUpheldDate: toDateString(row.lastUpheldDate),
            lastEvaluatedDate: toDateString(row.lastEvaluatedDate),
            lastCelebratedDate: toDateString(row.lastCelebratedDate),
        };
    }

    static dateToString(value: string | Date): string {
        if (value instanceof Date) {
            // `pg` parses a `date` column as local midnight; format in local time to get the
            // same calendar day back rather than toISOString's UTC shift.
            const month = `${value.getMonth() + 1}`.padStart(2, '0');
            const day = `${value.getDate()}`.padStart(2, '0');
            return `${value.getFullYear()}-${month}-${day}`;
        }
        return String(value).slice(0, 10);
    }

    getByUserId(userId: string): Promise<IDBUserDailyStreak | undefined> {
        const queryString = knexBuilder
            .from(USER_DAILY_STREAKS_TABLE_NAME)
            .where({ userId })
            .toString();

        return this.db.read.query(queryString)
            .then((response) => UserDailyStreaksStore.normalize(response.rows[0]));
    }

    /**
     * Current streak per user for a set of user ids, in one query — the leaderboard chip.
     * Users with no row are absent from the map (the caller renders nothing for them).
     */
    getCurrentStreaksForUsers(userIds: string[]): Promise<Record<string, number>> {
        if (!userIds.length) {
            return Promise.resolve({});
        }

        const queryString = knexBuilder
            .select(['userId', 'currentStreak'])
            .from(USER_DAILY_STREAKS_TABLE_NAME)
            .whereIn('userId', userIds)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce(
            (acc: Record<string, number>, row: any) => {
                acc[row.userId] = Number(row.currentStreak) || 0;
                return acc;
            },
            {},
        ));
    }

    /**
     * Idempotent create: a second call for the same user inserts nothing and returns the
     * existing row. The evaluator calls this before its first read so a user with check-ins
     * but no state row gets one on first contact.
     */
    getOrCreate(userId: string): Promise<IDBUserDailyStreak> {
        const insertString = knexBuilder
            .insert({ userId })
            .into(USER_DAILY_STREAKS_TABLE_NAME)
            .onConflict(['userId'])
            .ignore()
            .returning('*')
            .toString();

        return this.db.write.query(insertString)
            .then((response) => (response.rows[0]
                ? UserDailyStreaksStore.normalize(response.rows[0]) as IDBUserDailyStreak
                : this.getByUserId(userId).then((row) => row as IDBUserDailyStreak)));
    }

    update(userId: string, params: IUpdateUserDailyStreakParams): Promise<IDBUserDailyStreak | undefined> {
        const queryString = knexBuilder
            .from(USER_DAILY_STREAKS_TABLE_NAME)
            .where({ userId })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => UserDailyStreaksStore.normalize(response.rows[0]));
    }

    /**
     * Every user with at least one habit streak row, with their timezone — the population the
     * scheduled evaluate-all pass walks. Paged by (userId) so a large population is processed
     * in bounded batches; the caller passes the last userId seen as `afterUserId`.
     */
    getEvaluationTargets(limit: number, afterUserId?: string): Promise<IDailyStreakEvaluationTarget[]> {
        let queryBuilder = knexBuilder
            .distinct([`${STREAKS_TABLE_NAME}.userId`, `${USERS_TABLE_NAME}.settingsTimezone`])
            .from(STREAKS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, `${USERS_TABLE_NAME}.id`, `${STREAKS_TABLE_NAME}.userId`)
            .where((builder) => {
                builder.where(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`, false)
                    .orWhereNull(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`);
            })
            .orderBy(`${STREAKS_TABLE_NAME}.userId`, 'asc')
            .limit(Math.max(1, limit));

        if (afterUserId) {
            queryBuilder = queryBuilder.andWhere(`${STREAKS_TABLE_NAME}.userId`, '>', afterUserId);
        }

        return this.db.read.query(queryBuilder.toString()).then((response) => response.rows);
    }
}
