import KnexBuilder, { Knex } from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { CATEGORIES_TABLE_NAME } from './CategoriesStore';
import { IConnection } from './connection';
import { FORUM_CATEGORIES_TABLE_NAME } from './ForumCategoriesStore';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const FORUMS_TABLE_NAME = 'main.forums';

export interface ICreateForumParams {
    authorId: string;
    authorLocale: string;
    administratorIds: string;
    categoryTags: string[];
    title: string[];
    subtitle: string[];
    description: string;
    hashTags?: string;
    integrationIds?: string;
    invitees?: string;
    iconGroup: string;
    iconId: string;
    iconColor: string;
    maxCommentsPerMin?: number;
    doesExpire?: boolean;
    isPublic?: boolean;
}

export interface IUpdateForumConditions {
    id: string;
    authorId?: string;
}

export interface IUpdateForumParams {
    authorId?: string;
    authorLocale?: string;
    administratorIds?: string;
    title?: string[];
    subtitle?: string[];
    description?: string;
    categoryTags?: string[];
    hashTags?: string;
    integrationIds?: string;
    invitees?: string;
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
            queryBuilder: knexBuilder,
            tableName: FORUMS_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getForum(id: string) {
        const forumQueryString = knexBuilder.select('*')
            .from(FORUMS_TABLE_NAME)
            .where({
                id,
            })
            .toString();

        return this.db.write.query(forumQueryString).then((response) => response.rows);
    }

    getForums(conditions: any, orConditions: any, isNotArchived = true) {
        let forumQueryString = knexBuilder.select('*')
            .from(FORUMS_TABLE_NAME);

        if (isNotArchived) {
            forumQueryString = forumQueryString.whereNull('archivedAt');
        }

        forumQueryString = forumQueryString.where(conditions);

        if (orConditions) {
            forumQueryString = forumQueryString.orWhere(orConditions);
        }

        return this.db.write.query(forumQueryString.toString()).then((response) => response.rows);
    }

    findForums(ids: string[]) {
        const queryString = knexBuilder.select(['id', 'title'])
            .from(FORUMS_TABLE_NAME)
            .whereIn('id', ids)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    async searchForums(conditions: any = {}, returning, options: ISearchForumOptions) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : [
                `${FORUMS_TABLE_NAME}.id`,
                `${FORUMS_TABLE_NAME}.authorId`,
                `${FORUMS_TABLE_NAME}.authorLocale`,
                `${FORUMS_TABLE_NAME}.administratorIds`,
                `${FORUMS_TABLE_NAME}.title`,
                `${FORUMS_TABLE_NAME}.subtitle`,
                `${FORUMS_TABLE_NAME}.description`,
                `${FORUMS_TABLE_NAME}.hashTags`,
                `${FORUMS_TABLE_NAME}.integrationIds`,
                `${FORUMS_TABLE_NAME}.invitees`,
                `${FORUMS_TABLE_NAME}.iconGroup`,
                `${FORUMS_TABLE_NAME}.iconId`,
                `${FORUMS_TABLE_NAME}.iconColor`,
                `${FORUMS_TABLE_NAME}.maxCommentsPerMin`,
                `${FORUMS_TABLE_NAME}.doesExpire`,
                `${FORUMS_TABLE_NAME}.isPublic`,
                `${FORUMS_TABLE_NAME}.media`,
                `${FORUMS_TABLE_NAME}.createdAt`,
                `${FORUMS_TABLE_NAME}.updatedAt`,
            ])
            .from(FORUMS_TABLE_NAME)
            .leftJoin(FORUM_CATEGORIES_TABLE_NAME, `${FORUMS_TABLE_NAME}.id`, `${FORUM_CATEGORIES_TABLE_NAME}.forumId`)
            .leftJoin(CATEGORIES_TABLE_NAME, `${FORUM_CATEGORIES_TABLE_NAME}.categoryTag`, `${CATEGORIES_TABLE_NAME}.tag`)
            .columns([
                `${CATEGORIES_TABLE_NAME}.tag as categories[].tag`,
                `${CATEGORIES_TABLE_NAME}.name as categories[].name`,
                `${CATEGORIES_TABLE_NAME}.iconGroup as categories[].iconGroup`,
                `${CATEGORIES_TABLE_NAME}.iconId as categories[].iconId`,
                `${CATEGORIES_TABLE_NAME}.iconColor as categories[].iconColor`,
            ])
            .orderBy(`${FORUMS_TABLE_NAME}.updatedAt`, conditions.order)
            .whereNull('archivedAt')
            .where('isPublic', !options.usersInvitedForumIds);

        if (options.usersInvitedForumIds) {
            queryString = queryString.whereIn('id', options.usersInvitedForumIds);
        }

        if (options.forumIds) {
            queryString = queryString.whereIn('id', options.forumIds);
        } else if (options.categoryTags && options.categoryTags.length) {
            // Use forumCategries table to filter
            // May be able to improve speed by combining queries
            // Keep in mind sharding will add further complexity
            const categoriesQueryString: any = knexBuilder
                .select('*')
                .from(FORUM_CATEGORIES_TABLE_NAME)
                .whereIn('categoryTag', options.categoryTags)
                .toString();
            const forumCategories = await this.db.read.query(categoriesQueryString).then((response) => response.rows);
            const forumIds = forumCategories.map((cat) => cat.forumId);
            queryString = queryString.whereIn('id', forumIds);
        }

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
            const configuredResponse = formatSQLJoinAsJSON(response.rows, [{ propKey: 'categories', propId: 'tag' }]);
            return configuredResponse;
        });
    }

    createForum(params: ICreateForumParams) {
        const forumParams: IUpdateForumParams = {
            ...params,
            administratorIds: params.administratorIds,
            hashTags: params.hashTags,
            integrationIds: params.integrationIds,
            invitees: params.invitees,
        };

        delete forumParams.categoryTags;

        const queryString = knexBuilder.insert(forumParams)
            .into(FORUMS_TABLE_NAME)
            .returning('*')
            .toString();

        // TODO: Make this a transaction
        return this.db.write.query(queryString).then((response) => {
            const forumCategories = params.categoryTags.map((tag) => ({
                forumId: response.rows[0].id,
                categoryTag: tag,
            }));

            return this.db.write.query(
                knexBuilder.insert(forumCategories)
                    .into(FORUM_CATEGORIES_TABLE_NAME)
                    .toString(),
            ).then(() => response.rows);
        });
    }

    updateForum(conditions: IUpdateForumConditions, params: IUpdateForumParams) {
        const forumParams = {
            ...params,
        };

        delete forumParams.categoryTags;

        // TODO: Updated categories (sql transaction)
        // params.categoryTags.forEach((tag) => [

        // ]);

        const forumQueryString = knexBuilder.update({
            ...forumParams,
            updatedAt: new Date(),
        })
            .into(FORUMS_TABLE_NAME)
            .where(conditions)
            .returning(['id'])
            .toString();

        return this.db.write.query(forumQueryString).then((response) => response.rows);
    }

    archiveForum(conditions: {
        id: string,
        authorId: string; // to prevent non-owner from archiving
    }) {
        const forumQueryString = knexBuilder.update({
            archivedAt: new Date(),
        })
            .into(FORUMS_TABLE_NAME)
            .where(conditions)
            .returning(['id'])
            .toString();

        return this.db.write.query(forumQueryString).then((response) => response.rows);
    }

    deleteForum(id: string) {
        const forumQueryString = knexBuilder.delete()
            .into(FORUMS_TABLE_NAME)
            .where({
                id,
            })
            .returning(['id'])
            .toString();

        return this.db.write.query(forumQueryString).then((response) => response.rows);
    }
}
