import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { HABIT_GOALS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateHabitGoalParams {
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
    createdByUserId: string;
    isTemplate?: boolean;
    isPublic?: boolean;
}

export interface IUpdateHabitGoalParams {
    name?: string;
    description?: string;
    category?: string;
    emoji?: string;
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
    isPublic?: boolean;
    usageCount?: number;
}

export default class HabitGoalsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(HABIT_GOALS_TABLE_NAME)
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

    getByUserId(userId: string, limit?: number, offset?: number) {
        return this.get({ createdByUserId: userId }, 'createdAt', limit, offset);
    }

    getTemplates(category?: string, limit?: number, offset?: number) {
        const conditions: any = { isTemplate: true };
        if (category) {
            conditions.category = category;
        }
        return this.get(conditions, 'usageCount', limit, offset);
    }

    getPublicGoals(category?: string, limit?: number, offset?: number) {
        const conditions: any = { isPublic: true };
        if (category) {
            conditions.category = category;
        }
        return this.get(conditions, 'usageCount', limit, offset);
    }

    searchByName(searchTerm: string, limit = 20) {
        const queryString = knexBuilder
            .from(HABIT_GOALS_TABLE_NAME)
            .where('name', 'ilike', `%${searchTerm}%`)
            .andWhere((builder) => {
                builder.where('isTemplate', true).orWhere('isPublic', true);
            })
            .orderBy('usageCount', 'desc')
            .limit(limit);

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    create(params: ICreateHabitGoalParams) {
        const queryString = knexBuilder
            .insert({
                ...params,
                frequencyType: params.frequencyType || 'daily',
                frequencyCount: params.frequencyCount || 1,
            })
            .into(HABIT_GOALS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    update(id: string, params: IUpdateHabitGoalParams) {
        const queryString = knexBuilder
            .where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(HABIT_GOALS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    incrementUsageCount(id: string, incrementBy = 1) {
        const queryString = knexBuilder
            .into(HABIT_GOALS_TABLE_NAME)
            .where({ id })
            .increment('usageCount', incrementBy)
            .update({ updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    delete(id: string, userId: string) {
        // Only allow deletion by creator and if not a system template
        const queryString = knexBuilder
            .where({ id, createdByUserId: userId, isTemplate: false })
            .delete()
            .into(HABIT_GOALS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }
}
