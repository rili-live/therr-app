import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const FORUM_REPORTS_TABLE_NAME = 'main.forumReports';

/**
 * How many different people must report a group before it leaves Discover.
 *
 * More than one, so a single grudge cannot hide a group; low, because the groups this exists for
 * (scam listings) are seen by few real users before they do damage. A hidden group stays visible
 * to its members and by direct link, and comes back if a reviewer deletes its report rows.
 */
export const FORUM_REPORT_HIDE_THRESHOLD = 3;

export const FORUM_REPORT_REASONS = ['spam', 'scam', 'offensive', 'other'] as const;

/**
 * Member reports against groups. One row per (forum, reporter).
 *
 * Not a BrandScopedStore: rows are always reached through a forumId, and the forum carries the
 * brand (see the migration, 20261119000001_main.forumReadStates_forumReports.js).
 */
export default class ForumReportsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Records the report. Reporting a group twice is a no-op rather than an error, so a retried
     * request or a second tap reads as success. Resolves to whether a new row was written.
     */
    create(forumId: string, reportedByUserId: string, reason?: string): Promise<boolean> {
        const queryString = knexBuilder
            .insert({
                forumId,
                reportedByUserId,
                reason: reason || null,
            })
            .into(FORUM_REPORTS_TABLE_NAME)
            .onConflict(['forumId', 'reportedByUserId'])
            .ignore()
            .toString();

        return this.db.write.query(queryString).then((response) => (response.rowCount || 0) > 0);
    }

    countReporters(forumId: string): Promise<number> {
        const queryString = knexBuilder
            .count('* as count')
            .from(FORUM_REPORTS_TABLE_NAME)
            .where({ forumId })
            .toString();

        return this.db.read.query(queryString).then((response) => parseInt(response.rows?.[0]?.count, 10) || 0);
    }

    /**
     * Groups to leave out of a viewer's Discover: those this viewer reported (gone for them at
     * once), plus those enough different people reported (gone for everyone, pending review).
     */
    getHiddenFromDiscoverIds(viewerUserId?: string): Promise<string[]> {
        let query = knexBuilder
            .select('forumId')
            .from(FORUM_REPORTS_TABLE_NAME)
            .groupBy('forumId')
            .havingRaw('COUNT(*) >= ?', [FORUM_REPORT_HIDE_THRESHOLD]);

        if (viewerUserId) {
            query = query.union((qb) => {
                qb.select('forumId')
                    .from(FORUM_REPORTS_TABLE_NAME)
                    .where({ reportedByUserId: viewerUserId });
            });
        }

        return this.db.read.query(query.toString()).then((response) => response.rows.map((row) => row.forumId));
    }

    deleteByUserId(userId: string): Promise<number> {
        const queryString = knexBuilder
            .from(FORUM_REPORTS_TABLE_NAME)
            .where({ reportedByUserId: userId })
            .delete()
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }
}
