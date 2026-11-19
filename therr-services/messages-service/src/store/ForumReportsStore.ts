import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const FORUM_REPORTS_TABLE_NAME = 'main.forumReports';

/**
 * How many different established reporters (see FORUM_REPORT_MIN_ACCOUNT_AGE_DAYS) must report a
 * group before it leaves Discover.
 *
 * More than one, so a single grudge cannot hide a group; low, because the groups this exists for
 * (scam listings) are seen by few real users before they do damage. A hidden group stays visible
 * to its members and by direct link, and comes back if a reviewer deletes its report rows.
 */
export const FORUM_REPORT_HIDE_THRESHOLD = 3;

/**
 * How old a reporter's account must be for their report to count toward hiding a group from
 * everyone. A newer account's report is still recorded and still hides the group from that
 * reporter; it just cannot help hide it from anyone else. This is what stops three throwaway
 * accounts, registered for the purpose, from removing a real group from Discover.
 */
export const FORUM_REPORT_MIN_ACCOUNT_AGE_DAYS = 7;

export const FORUM_REPORT_REASONS = ['spam', 'scam', 'offensive', 'other'] as const;

/**
 * Whether an account created at `accountCreatedAt` is old enough for its reports to count toward
 * hiding a group. Fails closed: a missing or unparseable date does not count.
 */
export const isAccountOldEnoughToHide = (accountCreatedAt: any, now: Date = new Date()): boolean => {
    const createdAtMs = accountCreatedAt ? new Date(accountCreatedAt).getTime() : NaN;
    if (Number.isNaN(createdAtMs)) {
        return false;
    }

    return now.getTime() - createdAtMs >= FORUM_REPORT_MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
};

export interface IForumReporterCounts {
    /** Distinct people who reported the group. */
    total: number;
    /** Those whose reports count toward FORUM_REPORT_HIDE_THRESHOLD. */
    counting: number;
}

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
     * `countsTowardHide` is fixed at filing time; see FORUM_REPORT_MIN_ACCOUNT_AGE_DAYS.
     */
    create(forumId: string, reportedByUserId: string, reason?: string, countsTowardHide = false): Promise<boolean> {
        const queryString = knexBuilder
            .insert({
                forumId,
                reportedByUserId,
                reason: reason || null,
                countsTowardHide,
            })
            .into(FORUM_REPORTS_TABLE_NAME)
            .onConflict(['forumId', 'reportedByUserId'])
            .ignore()
            .toString();

        return this.db.write.query(queryString).then((response) => (response.rowCount || 0) > 0);
    }

    countReporters(forumId: string): Promise<IForumReporterCounts> {
        const queryString = knexBuilder
            .select(
                knexBuilder.raw('COUNT(*) AS ??', ['total']),
                knexBuilder.raw('COUNT(*) FILTER (WHERE ??) AS ??', ['countsTowardHide', 'counting']),
            )
            .from(FORUM_REPORTS_TABLE_NAME)
            .where({ forumId })
            .toString();

        return this.db.read.query(queryString).then((response) => ({
            total: parseInt(response.rows?.[0]?.total, 10) || 0,
            counting: parseInt(response.rows?.[0]?.counting, 10) || 0,
        }));
    }

    /**
     * Groups to leave out of a viewer's Discover: those this viewer reported (gone for them at
     * once, whatever their account age), plus those enough different established reporters
     * reported (gone for everyone, pending review).
     */
    getHiddenFromDiscoverIds(viewerUserId?: string): Promise<string[]> {
        // One grouped pass rather than a UNION: knex attaches a trailing groupBy/having to the last
        // branch of a union, which would have hidden a group from everyone after a single report.
        const query = knexBuilder
            .select('forumId')
            .from(FORUM_REPORTS_TABLE_NAME)
            .groupBy('forumId');

        if (viewerUserId) {
            query.havingRaw('COUNT(*) FILTER (WHERE ??) >= ? OR BOOL_OR(?? = ?)', [
                'countsTowardHide', FORUM_REPORT_HIDE_THRESHOLD, 'reportedByUserId', viewerUserId,
            ]);
        } else {
            query.havingRaw('COUNT(*) FILTER (WHERE ??) >= ?', ['countsTowardHide', FORUM_REPORT_HIDE_THRESHOLD]);
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
