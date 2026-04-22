import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { API_KEYS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateApiKeyParams {
    userId: string;
    hashedKey: string;
    keyPrefix: string;
    name?: string;
    accessLevels: string[];
}

// Columns safe to return in API responses (never expose hashedKey)
const SAFE_RETURNING = [
    'id',
    'userId',
    'keyPrefix',
    'name',
    'accessLevels',
    'isValid',
    'createdAt',
    'lastAccessed',
];

export default class ApiKeysStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    create(params: ICreateApiKeyParams) {
        const queryString = knexBuilder.insert({
            userId: params.userId,
            hashedKey: params.hashedKey,
            keyPrefix: params.keyPrefix,
            name: params.name || null,
            accessLevels: JSON.stringify(params.accessLevels),
        })
            .into(API_KEYS_TABLE_NAME)
            .returning(SAFE_RETURNING)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    getByKeyPrefix(keyPrefix: string) {
        const queryString = knexBuilder.select('*')
            .from(API_KEYS_TABLE_NAME)
            .where({ keyPrefix, isValid: true })
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getByUserId(userId: string) {
        const queryString = knexBuilder.select(SAFE_RETURNING)
            .from(API_KEYS_TABLE_NAME)
            .where({ userId })
            .orderBy('createdAt', 'desc')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    countByUserId(userId: string) {
        const queryString = knexBuilder.count('* as count')
            .from(API_KEYS_TABLE_NAME)
            .where({ userId, isValid: true })
            .toString();

        return this.db.read.query(queryString).then((response) => parseInt(response.rows[0]?.count || '0', 10));
    }

    updateLastAccessed(id: string) {
        const queryString = knexBuilder.where({ id })
            .update({ lastAccessed: new Date() })
            .into(API_KEYS_TABLE_NAME)
            .toString();

        return this.db.write.query(queryString);
    }

    invalidate(id: string, userId: string) {
        const queryString = knexBuilder.where({ id, userId })
            .update({ isValid: false })
            .into(API_KEYS_TABLE_NAME)
            .returning(SAFE_RETURNING)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    invalidateAllForUser(userId: string) {
        const queryString = knexBuilder.where({ userId, isValid: true })
            .update({ isValid: false })
            .into(API_KEYS_TABLE_NAME)
            .returning(SAFE_RETURNING)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
