import KnexBuilder, { Knex } from 'knex';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { getDbCountQueryString } from 'therr-js-utilities/db';
// eslint-disable-next-line import/extensions, import/no-unresolved
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line no-restricted-syntax -- this is the sanctioned canonical reference
export const FORUM_MESSAGES_TABLE_NAME = 'main.forumMessages';

export interface ICreateForumMessageParams {
    forumId: number;
    message: string;
    fromUserId: string;
    fromUserLocale: number;
    isAnnouncement?: boolean;
}

export interface IUpdateForumMessageConditions {
    id: number;
}

export interface IUpdateForumMessageParams {
    message: string;
}

export default class ForumMessagesStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // Brand-scoped per docs/NICHE_APP_DATABASE_GUIDELINES.md.
        super(dbConnection, FORUM_MESSAGES_TABLE_NAME, 'shadow');
    }

    countRecords(brand: BrandValue, params) {
        this.assertBrand(brand);
        const queryString = getDbCountQueryString({
            queryBuilder: knexBuilder,
            tableName: FORUM_MESSAGES_TABLE_NAME,
            params,
            defaultConditions: { [`${FORUM_MESSAGES_TABLE_NAME}.brandVariation`]: brand },
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    searchForumMessages(brand: BrandValue, forumId, conditions: any = {}, returning) {
        this.assertBrand(brand);
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(FORUM_MESSAGES_TABLE_NAME)
            .where({
                forumId,
                isAnnouncement: false,
            })
            .andWhere(`${FORUM_MESSAGES_TABLE_NAME}.brandVariation`, '=', brand)
            .orderBy(`${FORUM_MESSAGES_TABLE_NAME}.createdAt`, 'desc');

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
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

    createForumMessage(brand: BrandValue, params: ICreateForumMessageParams) {
        const queryString = this.scopedInsert(brand, { ...params })
            .returning(['id', 'updatedAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
