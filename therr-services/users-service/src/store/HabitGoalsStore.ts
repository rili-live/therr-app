import KnexBuilder, { Knex } from 'knex';
import { HabitGoalType, SavingsTargetScope } from 'therr-js-utilities/constants';
import { IConnection } from './connection';
import {
    HABIT_GOALS_TABLE_NAME, PACTS_TABLE_NAME, PACT_MEMBERS_TABLE_NAME, USER_HABITS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * The savings target columns, shared by create and update.
 *
 * `null` is meaningful on all three and distinct from `undefined`: clearing a target
 * ("actually this is open-ended now") has to be expressible, and knex drops `undefined`
 * keys from both an insert and an update, which is what makes the distinction work
 * without a separate "fieldsToClear" argument.
 */
export interface ISavingsTargetParams {
    targetAmount?: number | null;
    currencyCode?: string | null;
    savingsTargetScope?: SavingsTargetScope | null;
}

export interface ICreateHabitGoalParams extends ISavingsTargetParams {
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

export interface IUpdateHabitGoalParams extends ISavingsTargetParams {
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

/**
 * `targetAmount` is a Postgres `numeric`, and node-postgres returns every numeric as a
 * *string* — it will not silently narrow a value that may not survive an IEEE double.
 * That is the right default for the driver and the wrong shape for everyone above it:
 * `"2000.00" >= 2000` is true by coercion but `"900.00" >= 1000` is false and
 * `"900.00" > "1000.00"` is *true* (string compare), so a target read straight off the
 * row makes goal-reached checks wrong in a way that looks like it works.
 *
 * Coercing here rather than at each caller means every read path — getById, the user's
 * list, templates, search, and the rows returned by create/update — is covered by
 * construction. 12,2 fits an IEEE double exactly to the cent, so nothing is lost.
 */
const normalizeGoalRow = (row: any) => {
    if (!row || row.targetAmount === null || row.targetAmount === undefined) {
        return row;
    }

    return { ...row, targetAmount: Number(row.targetAmount) };
};

const normalizeGoalRows = (rows: any[]) => rows.map(normalizeGoalRow);

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
            .then((response) => normalizeGoalRows(response.rows));
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
     *
     * A goal the user created counts only once something was started on it: a
     * tracking row (any status — the client hides archived ones itself) or a
     * pact they created. The pact wizard writes the goal before the pact, so a
     * pact refused at the free-tier cap leaves a goal nobody is tracking. Listed,
     * the dashboard rendered it as a live habit, and a check-in on it became a
     * habit the cap never saw.
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

        const trackedGoalIds = knexBuilder
            .select(`${USER_HABITS_TABLE_NAME}.habitGoalId`)
            .from(USER_HABITS_TABLE_NAME)
            .where(`${USER_HABITS_TABLE_NAME}.userId`, userId);

        const createdPactGoalIds = knexBuilder
            .select(`${PACTS_TABLE_NAME}.habitGoalId`)
            .from(PACTS_TABLE_NAME)
            .where(`${PACTS_TABLE_NAME}.creatorUserId`, userId)
            .whereNotNull(`${PACTS_TABLE_NAME}.habitGoalId`)
            // A declined invite and a walked-away pact both land on `abandoned`;
            // neither started anything, so neither keeps the goal listed.
            // `completed` and `expired` did run, and still count.
            .whereNot(`${PACTS_TABLE_NAME}.status`, 'abandoned');

        let queryString = knexBuilder
            .from(HABIT_GOALS_TABLE_NAME)
            .where((builder) => {
                builder.where((own) => {
                    own.where(`${HABIT_GOALS_TABLE_NAME}.createdByUserId`, userId)
                        .andWhere((started) => {
                            started.whereIn(`${HABIT_GOALS_TABLE_NAME}.id`, trackedGoalIds)
                                .orWhereIn(`${HABIT_GOALS_TABLE_NAME}.id`, createdPactGoalIds);
                        });
                })
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
            .then((response) => normalizeGoalRows(response.rows));
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

        return this.db.read.query(queryString).then((response) => normalizeGoalRows(response.rows));
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
            .then((response) => normalizeGoalRows(response.rows));
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

        return this.db.write.query(queryString).then((response) => normalizeGoalRow(response.rows[0]));
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

        return this.db.write.query(queryString).then((response) => normalizeGoalRow(response.rows[0]));
    }

    incrementUsageCount(id: string, incrementBy = 1) {
        const queryString = knexBuilder
            .into(HABIT_GOALS_TABLE_NAME)
            .where({ id })
            .increment('usageCount', incrementBy)
            .update({ updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => normalizeGoalRow(response.rows[0]));
    }

    delete(id: string, userId: string) {
        // Only allow deletion by creator and if not a system template
        const queryString = knexBuilder
            .where({ id, createdByUserId: userId, isTemplate: false })
            .delete()
            .into(HABIT_GOALS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => normalizeGoalRow(response.rows[0]));
    }
}
