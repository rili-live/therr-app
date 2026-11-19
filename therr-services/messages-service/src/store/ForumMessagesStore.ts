import KnexBuilder, { Knex } from 'knex';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { getDbCountQueryString } from 'therr-js-utilities/db';
// eslint-disable-next-line import/extensions, import/no-unresolved
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';
import { FORUM_READ_STATES_TABLE_NAME } from './ForumReadStatesStore';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line therr/no-direct-brand-scoped-table -- this is the sanctioned canonical reference
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

    /**
     * The newest non-announcement message in each of these forums, for the "Your Groups" inbox.
     * DISTINCT ON over (forumId, createdAt DESC) is served by
     * idx_forum_messages_forum_brand_created, so this is one index probe per forum.
     */
    getLatestByForums(brand: BrandValue, forumIds: string[]): Promise<any[]> {
        this.assertBrand(brand);
        if (!forumIds.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder
            .select([
                `${FORUM_MESSAGES_TABLE_NAME}.forumId`,
                `${FORUM_MESSAGES_TABLE_NAME}.id`,
                `${FORUM_MESSAGES_TABLE_NAME}.message`,
                `${FORUM_MESSAGES_TABLE_NAME}.fromUserId`,
                `${FORUM_MESSAGES_TABLE_NAME}.createdAt`,
            ])
            .distinctOn(`${FORUM_MESSAGES_TABLE_NAME}.forumId`)
            .from(FORUM_MESSAGES_TABLE_NAME)
            .whereIn(`${FORUM_MESSAGES_TABLE_NAME}.forumId`, forumIds)
            .andWhere(`${FORUM_MESSAGES_TABLE_NAME}.brandVariation`, '=', brand)
            .andWhere(`${FORUM_MESSAGES_TABLE_NAME}.isAnnouncement`, false)
            .orderBy([
                { column: `${FORUM_MESSAGES_TABLE_NAME}.forumId` },
                { column: `${FORUM_MESSAGES_TABLE_NAME}.createdAt`, order: 'desc' },
            ])
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Unread messages per forum for one viewer: messages by someone else, newer than the viewer's
     * watermark on that forum. A viewer with no read-state row for a forum is measured from
     * `fallbackWatermark` instead (FORUM_READ_TRACKING_STARTED_AT), so the day read tracking ships
     * does not count a group's whole history as unread. One grouped query for a page of forums.
     */
    countUnreadByForum(
        brand: BrandValue,
        forumIds: string[],
        viewerUserId: string,
        fallbackWatermark: Date,
    ): Promise<Record<string, number>> {
        this.assertBrand(brand);
        if (!forumIds.length || !viewerUserId) {
            return Promise.resolve({});
        }

        const queryString = knexBuilder
            .select(`${FORUM_MESSAGES_TABLE_NAME}.forumId`)
            .count(`${FORUM_MESSAGES_TABLE_NAME}.id as count`)
            .from(FORUM_MESSAGES_TABLE_NAME)
            .leftJoin(FORUM_READ_STATES_TABLE_NAME, function joinViewerReadState() {
                this.on(`${FORUM_READ_STATES_TABLE_NAME}.forumId`, '=', `${FORUM_MESSAGES_TABLE_NAME}.forumId`)
                    .andOn(`${FORUM_READ_STATES_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [viewerUserId]));
            })
            .whereIn(`${FORUM_MESSAGES_TABLE_NAME}.forumId`, forumIds)
            .andWhere(`${FORUM_MESSAGES_TABLE_NAME}.brandVariation`, '=', brand)
            .andWhere(`${FORUM_MESSAGES_TABLE_NAME}.isAnnouncement`, false)
            .andWhere(`${FORUM_MESSAGES_TABLE_NAME}.fromUserId`, '<>', viewerUserId)
            .andWhereRaw('?? > COALESCE(??, ?::timestamptz)', [
                `${FORUM_MESSAGES_TABLE_NAME}.createdAt`,
                `${FORUM_READ_STATES_TABLE_NAME}.lastReadAt`,
                fallbackWatermark.toISOString(),
            ])
            .groupBy(`${FORUM_MESSAGES_TABLE_NAME}.forumId`)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce((acc: Record<string, number>, row: any) => {
            acc[row.forumId] = parseInt(row.count, 10) || 0;
            return acc;
        }, {}));
    }

    createForumMessage(brand: BrandValue, params: ICreateForumMessageParams) {
        const queryString = this.scopedInsert(brand, { ...params })
            .returning(['id', 'updatedAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /**
     * Test account cleanup (DELETE /test-account-content, driven by users-service's
     * testAccountCleanupWorker). Only rows older than `createdBefore`, so a reviewer
     * mid-session keeps what they just sent. Unscoped by brand, like deleteByUserId.
     */
    deleteTestAccountContent(userId: string, createdBefore: Date): Promise<number> {
        const queryString = knexBuilder
            .from(FORUM_MESSAGES_TABLE_NAME)
            .where({ fromUserId: userId })
            .andWhere('createdAt', '<', createdBefore)
            .delete()
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }

    /**
     * Deletes every forum message authored by the user, across all brands.
     *
     * Unscoped by brand for the same reason as DirectMessagesStore.deleteByUserId —
     * see the comment there. Other members' messages in the same forums are untouched;
     * only rows this user wrote are removed.
     */
    deleteByUserId(userId: string) {
        const queryString = knexBuilder
            .from(FORUM_MESSAGES_TABLE_NAME)
            .where({ fromUserId: userId })
            .delete()
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
