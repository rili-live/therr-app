import Knex from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { FORUM_CATEGORIES_TABLE_NAME } from './ForumCategoriesStore';

const knex: Knex = Knex({ client: 'pg' });

export const FORUMS_TABLE_NAME = 'main.forums';

export interface ICreateForumParams {
    authorId: number;
    authorLocale: string;
    administratorIds: number[];
    categoryTags: string[];
    title: string[];
    subtitle: string[];
    description: string;
    hashtags?: string;
    integrationIds: number[];
    invitees: number[];
    iconGroup: string;
    iconId: string;
    iconColor: string;
    maxCommentsPerMin?: number;
    doesExpire?: boolean;
    isPublic?: boolean;
}

export interface IUpdateForumConditions {
    id: number;
}

export interface IUpdateForumParams {
    authorId?: number;
    authorLocale?: number;
    administratorIds?: number[];
    title?: string[];
    subtitle?: string[];
    description?: string;
    categoryIds?: number[];
    hashtags?: string;
    integrationIds?: number[];
    invitees?: number[];
    iconGroup?: string;
    iconId?: string;
    iconColor?: string;
    maxCommentsPerMin?: number;
    doesExpire?: boolean;
    isPublic?: boolean;
}

export interface ISearchForumOptions {
    usersInvitedForumIds?: number[];
    categoryTags?: string[];
    forumIds?: number[];
}

export default class ForumsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: Update to actually match searchForums (infinite scroll)
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: FORUMS_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    async searchForums(conditions: any = {}, returning, options: ISearchForumOptions) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select((returning && returning.length) ? returning : '*')
            .from(FORUMS_TABLE_NAME)
            .orderBy(`${FORUMS_TABLE_NAME}.updatedAt`);

        if (options.usersInvitedForumIds) {
            queryString = queryString.whereIn('id', options.usersInvitedForumIds);
        }

        if (options.forumIds) {
            queryString = queryString.whereIn('id', options.forumIds);
        } else if (options.categoryTags) {
            // Use forumCategries table to filter
            // May be able to improve speed by combining queries
            // Keep in mind sharding will add further complexity
            const categoriesQueryString: any = knex
                .select('*')
                .from(FORUM_CATEGORIES_TABLE_NAME)
                .whereIn('categoryTag', options.categoryTags);
            const forumCategories = await this.db.read.query(categoriesQueryString).then((response) => response.rows);
            const forumIds = forumCategories.map((cat) => cat.forumId);
            queryString = queryString.whereIn('id', forumIds);
        }

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
            const isPublic = !options.usersInvitedForumIds;
            queryString = queryString.where('isPublic', isPublic).andWhere(conditions.filterBy, operator, query);
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

    createForum(params: ICreateForumParams) {
        const forumParams = {
            ...params,
            administratorIds: params.administratorIds.join(','),
            categoryTags: params.categoryTags.join(','),
            integrationIds: params.integrationIds.join(','),
            invitees: params.invitees.join(','),
        };

        // TODO: Create categories (sql transaction)

        const queryString = knex.insert(forumParams)
            .into(FORUMS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateForum(conditions: IUpdateForumConditions, params: IUpdateForumParams) {
        const forumParams = {
            ...params,
            administratorIds: params.administratorIds && params.administratorIds.join(','),
            categoryIds: params.categoryIds && params.categoryIds.join(','),
            integrationIds: params.integrationIds && params.integrationIds.join(','),
            invitees: params.invitees && params.invitees.join(','),
        };

        const forumQueryString = knex.update(forumParams)
            .into(FORUMS_TABLE_NAME)
            .where(conditions)
            .returning(['id'])
            .toString();

        return this.db.write.query(forumQueryString).then((response) => response.rows);
    }
}
