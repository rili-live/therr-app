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
