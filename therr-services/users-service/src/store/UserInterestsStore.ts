import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { INTERESTS_TABLE_NAME, USER_INTERESTS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateUserInterestParams {
    userId: string;
    interestId: string;
    isEnabled?: boolean;
    score?: number;
    engagementCount?: number;
}

export default class UserInterestsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string) {
        let queryString = knexBuilder
            .from(USER_INTERESTS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getByInterestId(interestId: string) {
        return this.get({ interestId });
    }

    getByUserId(userId: string) {
        return this.get({ userId }, 'score');
    }

    getById(id: string) {
        return this.get({ id });
    }

    getByUserIds(userIds: string[], conditions: any, orderBy?: string, returning?: string[]) {
        let queryString = knexBuilder
            .select(`${USER_INTERESTS_TABLE_NAME}.*`)
            .from(USER_INTERESTS_TABLE_NAME)
            .innerJoin(INTERESTS_TABLE_NAME, `${INTERESTS_TABLE_NAME}.id`, `${USER_INTERESTS_TABLE_NAME}.interestId`)
            .columns([
                `${INTERESTS_TABLE_NAME}.emoji`,
                `${INTERESTS_TABLE_NAME}.displayNameKey`,
            ])
            .where(conditions)
            .whereIn('userId', userIds);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        return this.db.read.query(queryString.toString())
            .then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'interests', propId: 'id' }]));
    }

    create(params: ICreateUserInterestParams[]) {
        const modifiedParams = params.map((param) => ({
            ...param,
            score: Math.min(param.score || 5, 5), // Ensure no greater than 5
        }));
        const queryString = knexBuilder.insert(modifiedParams)
            .into(USER_INTERESTS_TABLE_NAME)
            .onConflict(['userId', 'interestId'])
            .merge()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(USER_INTERESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }

    /**
     * Applies a different increment per interest key in one statement.
     *
     * Engagement used to arrive one content view at a time, each becoming its own
     * cross-service request and its own multi-row UPDATE. Callers now coalesce a user's
     * views in-process and flush them as a single map, so the write volume tracks flush
     * intervals instead of impressions.
     *
     * Like `incrementUserInterests`, this only touches rows that already exist — behavior
     * cannot yet discover an interest the user never declared. That is a known gap
     * (docs/ALGORITHM_AUDIT.md E2) and is deliberately not addressed here.
     */
    incrementUserInterestsByKey(userId: string, incrementsByKey: { [displayNameKey: string]: number }) {
        const entries = Object.entries(incrementsByKey || {})
            .map(([key, incrBy]) => [key, Math.floor(Number(incrBy))] as [string, number])
            .filter(([key, incrBy]) => !!key && Number.isFinite(incrBy) && incrBy > 0);

        if (!userId || !entries.length) {
            return Promise.resolve([]);
        }

        const bindings: any[] = [];
        entries.forEach(([key, incrBy]) => {
            bindings.push(key, incrBy);
        });
        bindings.push(userId);

        // Table names are written out rather than interpolated from the tableNames
        // constants: knex quotes identifiers for builder calls, but raw SQL does not, and
        // unquoted main.userInterests would fold to "userinterests" and fail.
        const valuesPlaceholders = entries.map(() => '(?, ?::integer)').join(', ');
        const queryString = knexBuilder.raw(
            `UPDATE main."userInterests" AS ui
                SET "engagementCount" = ui."engagementCount" + v.incr, "updatedAt" = NOW()
                FROM (VALUES ${valuesPlaceholders}) AS v(key, incr)
                JOIN main."interests" AS i ON i."displayNameKey" = v.key
                WHERE ui."userId" = ?::uuid AND ui."interestId" = i.id
                RETURNING ui.*`,
            bindings,
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    incrementUserInterests(userId, interestDisplayNameKeys: string[], incrBy = 1) {
        const queryString = knexBuilder
            .into(USER_INTERESTS_TABLE_NAME)
            .increment('engagementCount', incrBy)
            .update({
                updatedAt: new Date(),
            })
            .where({
                userId,
            })
            .whereIn('interestId', (builder) => {
                builder.select('id').from(INTERESTS_TABLE_NAME).whereIn('displayNameKey', interestDisplayNameKeys);
            })
            .returning('*');

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    delete(id: string, userId: string) {
        const queryString = knexBuilder.where({ id, userId })
            .delete()
            .into(USER_INTERESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
