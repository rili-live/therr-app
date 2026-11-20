import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const FORUM_READ_STATES_TABLE_NAME = 'main.forumReadStates';

/**
 * The watermark used for a member who has no read-state row for a group yet.
 *
 * Read tracking started with this table. Without a fixed floor, every existing member would see a
 * group's entire history counted as unread the day it ships. Messages after this instant are new
 * to a member who has not opened the group since; anything older is treated as already seen.
 */
export const FORUM_READ_TRACKING_STARTED_AT = new Date('2026-11-19T00:00:00.000Z');

/**
 * One row per (user, forum): how far that user has read the group's chat.
 *
 * Not a BrandScopedStore: rows are always reached through a forumId, and the forum carries the
 * brand (see the migration, 20261119000001_main.forumReadStates_forumReports.js).
 */
export default class ForumReadStatesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Moves the user's watermark forward to `readAt`. Never backwards: an upsert that keeps the
     * later of the stored and the new value, so a stale device or a delayed request cannot
     * un-read messages that a newer one already marked read.
     */
    markRead(forumId: string, userId: string, readAt: Date = new Date()): Promise<Date | undefined> {
        const queryString = knexBuilder
            .insert({
                forumId,
                userId,
                lastReadAt: readAt.toISOString(),
            })
            .into(FORUM_READ_STATES_TABLE_NAME)
            .onConflict(['userId', 'forumId'])
            .merge({
                lastReadAt: knexBuilder.raw('GREATEST("forumReadStates"."lastReadAt", EXCLUDED."lastReadAt")'),
                updatedAt: knexBuilder.raw('NOW()'),
            })
            .returning(['lastReadAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows?.[0]?.lastReadAt);
    }

    deleteByUserId(userId: string): Promise<number> {
        const queryString = knexBuilder
            .from(FORUM_READ_STATES_TABLE_NAME)
            .where({ userId })
            .delete()
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }
}
