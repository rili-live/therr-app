import Knex from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import connection, { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

const DIRECT_MESSAGES_TABLE_NAME = 'main.directMessages';

export interface ICreateDirectMessageParams {
    message: string;
    toUserId: number;
    fromUserId: number;
    isUnread: boolean;
    locale: string;
}

export interface IUpdateDirectMessageConditions {
    id: number;
}

export interface IUpdateDirectMessageParams {
    message: string;
    isUnread?: boolean;
}

class Store {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: DIRECT_MESSAGES_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // TODO
    searchDirectMessages(conditions: any = {}) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select('*')
            .from(DIRECT_MESSAGES_TABLE_NAME)
            .orderBy(`${DIRECT_MESSAGES_TABLE_NAME}.updatedAt`);

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.andWhere(conditions.filterBy, operator, query);
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            return configuredResponse;
        });
    }

    createDirectMessage(params: ICreateDirectMessageParams) {
        const queryString = knex.insert(params)
            .into(DIRECT_MESSAGES_TABLE_NAME)
            .returning(['id', 'updatedAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}

export default new Store(connection);
