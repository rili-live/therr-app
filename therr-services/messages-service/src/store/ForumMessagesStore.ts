import Knex from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

export const FORUM_MESSAGES_TABLE_NAME = 'main.forumMessages';

export interface ICreateForumMessageParams {
    forumId: number;
    message: string;
    fromUserId: number;
    fromUserLocale: number;
}

export interface IUpdateForumMessageConditions {
    id: number;
}

export interface IUpdateForumMessageParams {
    message: string;
}

export default class ForumMessagesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: Update to actually match searchForumMessages (infinite scroll)
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: FORUM_MESSAGES_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchForumMessages(forumId, conditions: any = {}, returning) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select((returning && returning.length) ? returning : '*')
            .from(FORUM_MESSAGES_TABLE_NAME)
            .orderBy(`${FORUM_MESSAGES_TABLE_NAME}.updatedAt`);

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.where('forumId', forumId).andWhere(conditions.filterBy, operator, query);
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

    createForumMessage(params: ICreateForumMessageParams) {
        const queryString = knex.insert(params)
            .into(FORUM_MESSAGES_TABLE_NAME)
            .returning(['id', 'updatedAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
