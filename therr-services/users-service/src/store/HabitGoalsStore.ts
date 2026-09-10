import KnexBuilder, { Knex } from 'knex';
import { HabitGoalType } from 'therr-js-utilities/constants';
import { IConnection } from './connection';
import { HABIT_GOALS_TABLE_NAME, PACTS_TABLE_NAME, PACT_MEMBERS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateHabitGoalParams {
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    goalType?: HabitGoalType;
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
    goalType?: HabitGoalType;
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

    /**
     * A user's habit list is everything they created, plus every goal they
     * joined by accepting a pact invite. Invitees never own the goal row —
     * it belongs to whoever sent the invite — so filtering on
     * `createdByUserId` alone hides the habit they actually signed up for.
     *
     * Membership is the source of truth, with a fallback to the legacy
     * `pacts.partnerUserId` column for 1:1 pacts that pre-date pact_members.
     */
    getByUserId(userId: string, limit?: number, offset?: number) {
        const joinedGoalIds = knexBuilder
            .distinct(`${PACTS_TABLE_NAME}.habitGoalId`)
            .from(PACTS_TABLE_NAME)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .whereNotNull(`${PACTS_TABLE_NAME}.habitGoalId`)
            .andWhere((builder) => {
                builder.where((b1) => {
                    b1.where(`${PACT_MEMBERS_TABLE_NAME}.userId`, userId)
                        .andWhere(`${PACT_MEMBERS_TABLE_NAME}.status`, 'active');
                }).orWhere((b2) => {
                    b2.where(`${PACTS_TABLE_NAME}.partnerUserId`, userId)
                        .andWhere(`${PACTS_TABLE_NAME}.status`, 'active');
                });
            });

        let queryString = knexBuilder
            .from(HABIT_GOALS_TABLE_NAME)
            .where((builder) => {
                builder.where(`${HABIT_GOALS_TABLE_NAME}.createdByUserId`, userId)
                    .orWhereIn(`${HABIT_GOALS_TABLE_NAME}.id`, joinedGoalIds);
            })
            .orderBy('createdAt', 'desc');

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    /**
     * Bulk goal lookup for callers that already know the ids they need (e.g.
     * hydrating a page of pacts with their habit cadence) and would otherwise
     * fan out one getById per row.
     */
    getByIds(ids: string[]) {
        if (!ids.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder
            .from(HABIT_GOALS_TABLE_NAME)
            .whereIn('id', ids)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
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
                goalType: params.goalType || 'build_good',
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
