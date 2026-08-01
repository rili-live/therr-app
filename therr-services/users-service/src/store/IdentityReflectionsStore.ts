import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { IDENTITY_REFLECTIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateIdentityReflectionParams {
    identityProgressId: string;
    userId: string;
    habitGoalId: string;
    authorUserId: string;
    checkinId?: string;
    reflectionType: string;
    promptKey: string;
    responseScore?: number;
    responseText?: string;
}

/**
 * Append-only log of reflection answers. There is deliberately no update method:
 * a reflection is what the user believed on a given day, and the WHY answer earns
 * its keep by being re-readable during a lapse. Editing it away defeats that.
 */
export default class IdentityReflectionsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, limit?: number) {
        let queryString = knexBuilder
            .from(IDENTITY_REFLECTIONS_TABLE_NAME)
            .where(conditions)
            .orderBy('createdAt', 'desc');

        if (limit) {
            queryString = queryString.limit(limit);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getByIdentityProgressId(identityProgressId: string, limit?: number) {
        return this.get({ identityProgressId }, limit);
    }

    /**
     * Most recent answer per reflection type for a habit. Drives the prompt
     * cooldowns — `selectReflectionPrompt` needs "how long since we asked this?",
     * not the whole history.
     */
    getLatestByType(userId: string, habitGoalId: string) {
        const queryString = knexBuilder
            .select(['reflectionType'])
            .max('createdAt as latestCreatedAt')
            .from(IDENTITY_REFLECTIONS_TABLE_NAME)
            .where({ userId, habitGoalId })
            .groupBy('reflectionType')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    create(params: ICreateIdentityReflectionParams) {
        const queryString = knexBuilder
            .insert(params)
            .into(IDENTITY_REFLECTIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    countByType(userId: string, habitGoalId: string, reflectionType: string) {
        const queryString = knexBuilder
            .from(IDENTITY_REFLECTIONS_TABLE_NAME)
            .count('* as count')
            .where({ userId, habitGoalId, reflectionType })
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count || '0', 10));
    }
}
