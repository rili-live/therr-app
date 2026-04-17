import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { USER_LISTS_TABLE_NAME } from './UserListsStore';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_LIST_ITEMS_TABLE_NAME = 'main.userListItems';

export type UserListContentType = 'space' | 'moment' | 'event' | 'thought';

export interface IUserListItemKey {
    listId: string;
    contentId: string;
    contentType: UserListContentType;
}

export default class UserListItemsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    add({
        listId,
        contentId,
        contentType = 'space',
        position = 0,
    }: IUserListItemKey & { position?: number }) {
        // ON CONFLICT DO NOTHING — safe upsert on the unique index
        const queryString = knexBuilder(USER_LIST_ITEMS_TABLE_NAME)
            .insert({
                listId,
                contentId,
                contentType,
                position,
            })
            .onConflict(['listId', 'contentId', 'contentType'])
            .ignore()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    remove({ listId, contentId, contentType = 'space' }: IUserListItemKey) {
        const queryString = knexBuilder(USER_LIST_ITEMS_TABLE_NAME)
            .where({ listId, contentId, contentType })
            .delete()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    removeAllForContent(userId: string, contentId: string, contentType: UserListContentType = 'space') {
        // Remove across all of the user's lists for the given content
        const subQuery = knexBuilder.select('id')
            .from(USER_LISTS_TABLE_NAME)
            .where({ userId });

        const queryString = knexBuilder(USER_LIST_ITEMS_TABLE_NAME)
            .whereIn('listId', subQuery)
            .andWhere({ contentId, contentType })
            .delete()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    getByList(listId: string, filters = { limit: 100, offset: 0 }) {
        const restrictedLimit = Math.min(filters.limit || 100, 1000);

        const queryString = knexBuilder.select('*')
            .from(USER_LIST_ITEMS_TABLE_NAME)
            .where({ listId })
            .orderBy('addedAt', 'DESC')
            .limit(restrictedLimit)
            .offset(filters.offset || 0);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getListsForContent(userId: string, contentId: string, contentType: UserListContentType = 'space') {
        // Returns userLists rows that contain the given content, scoped to a user.
        // Ordered so that consumers (e.g. the fallback after deleting a list)
        // get a deterministic "remaining list" — default first, then most-recent.
        const queryString = knexBuilder
            .select('ul.*')
            .from({ ul: USER_LISTS_TABLE_NAME })
            .innerJoin({ uli: USER_LIST_ITEMS_TABLE_NAME }, 'ul.id', 'uli.listId')
            .where({ 'ul.userId': userId, 'uli.contentId': contentId, 'uli.contentType': contentType })
            .orderBy([
                { column: 'ul.isDefault', order: 'desc' },
                { column: 'uli.addedAt', order: 'desc' },
            ]);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    countByLists(listIds: string[]) {
        if (!listIds?.length) {
            return Promise.resolve([]);
        }
        const queryString = knexBuilder
            .select('listId')
            .count('* as count')
            .from(USER_LIST_ITEMS_TABLE_NAME)
            .whereIn('listId', listIds)
            .groupBy('listId');

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getPreviewItems(listIds: string[], perListLimit = 3) {
        if (!listIds?.length) {
            return Promise.resolve([]);
        }
        // Fetch the most recently added N items per list via a lateral join.
        // Use pg positional bindings ($1..$N) so listIds can never be SQL-injected.
        const limit = Math.max(1, Math.min(perListLimit, 10));
        // $1 = limit, $2..$N = listIds
        const placeholders = listIds.map((_, i) => `$${i + 2}`).join(',');
        // t.* already includes uli."listId" (t = uli), so no need to re-select ul.id.
        const sql = `
            SELECT t.*
            FROM main."userLists" ul
            JOIN LATERAL (
                SELECT uli.*
                FROM main."userListItems" uli
                WHERE uli."listId" = ul.id
                ORDER BY uli."addedAt" DESC
                LIMIT $1
            ) t ON TRUE
            WHERE ul.id IN (${placeholders})
        `;
        const bindings: any[] = [limit, ...listIds];

        return this.db.read.query(sql, bindings).then((response) => response.rows);
    }
}
