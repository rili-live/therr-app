import KnexBuilder, { Knex } from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const FORUM_CATEGORIES_TABLE_NAME = 'main.forumCategories';

export interface ICreateForumCategoryParams {
    categoryTag: string;
    forumIds: string;
}

export default class ForumCategoriesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: Update to actually match searchForumCategories (infinite scroll)
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knexBuilder,
            tableName: FORUM_CATEGORIES_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchForumCategories(conditions: any = {}, returning) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(FORUM_CATEGORIES_TABLE_NAME)
            .orderBy(`${FORUM_CATEGORIES_TABLE_NAME}.updatedAt`);

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.where(conditions.filterBy, operator, query);
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

    createForumCategory(params: ICreateForumCategoryParams) {
        const queryString = knexBuilder.insert(params)
            .into(FORUM_CATEGORIES_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
