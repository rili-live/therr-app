import Knex from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
// import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

export const CATEGORIES_TABLE_NAME = 'main.categories';

export interface ICreateCategoryParams {
    categoryTag: string;
    forumIds: string;
}

export default class CategoriesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: Update to actually match searchCategories (infinite scroll)
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: CATEGORIES_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchCategories(conditions: any = {}, returning) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select((returning && returning.length) ? returning : '*')
            .from(CATEGORIES_TABLE_NAME)
            .orderBy(`${CATEGORIES_TABLE_NAME}.updatedAt`);

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.where(conditions.filterBy, operator, query);
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createCategory(params: ICreateCategoryParams) {
        const queryString = knex.insert(params)
            .into(CATEGORIES_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
