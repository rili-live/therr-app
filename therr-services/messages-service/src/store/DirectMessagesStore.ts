import KnexBuilder, { Knex } from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const DIRECT_MESSAGES_TABLE_NAME = 'main.directMessages';

export interface ICreateDirectMessageParams {
    message: string;
    toUserId: string;
    fromUserId: string;
    isUnread: boolean;
    locale: string;
}

export interface IUpdateDirectMessageConditions {
    id: string;
}

export interface IUpdateDirectMessageParams {
    message: string;
    isUnread?: boolean;
}

export default class DirectMessagesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knexBuilder,
            tableName: DIRECT_MESSAGES_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchDirectMessages(userId, conditions: any = {}, returning, shouldCheckReverse?: string) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(DIRECT_MESSAGES_TABLE_NAME)
            .orderBy(`${DIRECT_MESSAGES_TABLE_NAME}.updatedAt`, 'desc');

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.where('toUserId', userId).andWhere(conditions.filterBy, operator, query);
            if (shouldCheckReverse === 'true' && conditions.filterBy === 'fromUserId') {
                queryString = queryString.orWhere('fromUserId', userId)
                    .andWhere('toUserId', operator, query);
            }
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
        const queryString = knexBuilder.insert(params)
            .into(DIRECT_MESSAGES_TABLE_NAME)
            .returning(['id', 'updatedAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
