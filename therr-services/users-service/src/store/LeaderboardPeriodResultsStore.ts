import KnexBuilder, { Knex } from 'knex';
import { AccessLevels } from 'therr-js-utilities/constants';
import { quoteTableName, withBrandOnInsert } from 'therr-js-utilities/db';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';
import UserDailyStreaksStore from './UserDailyStreaksStore';
import { USER_LEADERBOARD_SCORES_TABLE_NAME } from './UserLeaderboardScoresStore';
import { USER_LEADERBOARD_LEAGUES_TABLE_NAME } from './UserLeaderboardLeaguesStore';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line therr/no-direct-brand-scoped-table -- this is the sanctioned canonical reference
export const LEADERBOARD_PERIOD_RESULTS_TABLE_NAME = 'main.leaderboardPeriodResults';
const USERS_TABLE_NAME = 'main.users';
// Rows per INSERT when writing a league close: well inside Postgres' 65535 bind-parameter cap.
const INSERT_CHUNK_SIZE = 500;

export interface IDBLeaderboardPeriodResult {
    id: string;
    userId: string;
    brandVariation: string;
    periodStart: string; // YYYY-MM-DD (Monday, UTC) — the period id
    placement: number;
    score: number;
    participants: number;
    leagueFrom: string | null; // the tier the user competed in; null when the period closed without leagues
    leagueTo: string | null; // the tier the close moved them to (equal to leagueFrom when they stayed)
    acknowledgedAt: Date | null;
    createdAt: Date;
}

/**
 * Final placements for closed weekly leaderboard periods (`main.leaderboardPeriodResults`).
 * Brand-scoped: a result belongs to one brand's board. See the table migration.
 */
export default class LeaderboardPeriodResultsStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // Brand-scoped from creation per docs/NICHE_APP_DATABASE_GUIDELINES.md. 'enforce' from
        // day one: there are no legacy rows and every caller has a brand in hand.
        super(dbConnection, LEADERBOARD_PERIOD_RESULTS_TABLE_NAME, 'enforce');
    }

    private static normalize(row: any): IDBLeaderboardPeriodResult {
        return {
            ...row,
            periodStart: UserDailyStreaksStore.dateToString(row.periodStart),
            placement: Number(row.placement) || 0,
            score: Number(row.score) || 0,
            participants: Number(row.participants) || 0,
            leagueFrom: row.leagueFrom || null,
            leagueTo: row.leagueTo || null,
            acknowledgedAt: row.acknowledgedAt || null,
        };
    }

    /**
     * Close one period for one brand: rank every eligible score row for `periodStart` with
     * standard competition ranking (ties share a placement: 1, 1, 3) and write one result per
     * participant. `participants` is the size of that ranked set, frozen at close.
     *
     * Eligibility matches the live board (UserLeaderboardScoresStore.applyEligibilityFilters):
     * leaderboard opt-out and soft-deleted accounts are excluded, so a placement is never
     * announced to someone the board did not show.
     *
     * Idempotent: INSERT ... ON CONFLICT DO NOTHING on (brandVariation, periodStart, userId). A
     * re-run (a second scheduler firing, a lazy close racing the scheduled one) inserts nothing.
     * `leagueFrom` / `leagueTo` are left NULL: this is the brand-wide close, used whenever
     * leagues are off for the brand or the week fell below the activation threshold. The league
     * close is `insertLeagueResults`.
     *
     * Returns the number of result rows this call inserted (0 on a repeat).
     */
    closePeriod(brand: BrandValue, periodStart: string): Promise<number> {
        this.assertBrand(brand);
        // Both table names are camelCase. Interpolated bare into raw SQL, Postgres folds them
        // to lowercase and reports `relation "main.leaderboardperiodresults" does not exist`
        // (prod, 2026-09-19). The query builder quotes for us; raw SQL has to do it, and
        // therr/no-unquoted-camelcase-table-in-raw-sql now insists on it.
        const resultsTable = quoteTableName(this.tableName);
        const scoresTable = quoteTableName(USER_LEADERBOARD_SCORES_TABLE_NAME);

        const queryString = knexBuilder.raw(
            `INSERT INTO ${resultsTable}
                ("userId", "brandVariation", "periodStart", "placement", "score", "participants")
            SELECT
                ranked."userId",
                ?::text,
                ?::date,
                ranked."placement",
                ranked."points",
                ranked."participants"
            FROM (
                SELECT
                    s."userId",
                    s."points",
                    RANK() OVER (ORDER BY s."points" DESC)::int AS "placement",
                    COUNT(*) OVER ()::int AS "participants"
                FROM ${scoresTable} s
                INNER JOIN ${USERS_TABLE_NAME} u ON u."id" = s."userId"
                WHERE s."brandVariation" = ?::text
                    AND s."periodStart" = ?::date
                    AND u."settingsIsLeaderboardEnabled" = true
                    AND (u."settingsIsAccountSoftDeleted" = false OR u."settingsIsAccountSoftDeleted" IS NULL)
                    AND NOT (COALESCE(u."accessLevels", '[]'::jsonb) @> '["${AccessLevels.TEST_ACCOUNT}"]'::jsonb)
            ) ranked
            ON CONFLICT ("brandVariation", "periodStart", "userId") DO NOTHING`,
            [brand, periodStart, brand, periodStart],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }

    /**
     * Write one period's league-relative results, computed by `computeLeagueResults`
     * (utilities/leaderboardLeagues.ts): each placement is out of the user's own league, and
     * `leagueFrom` / `leagueTo` record the move. Same first-writer-wins idempotency as
     * `closePeriod` — rows already present for (brand, period, user) are left untouched, so
     * whichever close wrote first decides the outcome.
     *
     * Returns the number of rows this call inserted.
     */
    async insertLeagueResults(brand: BrandValue, periodStart: string, results: {
        userId: string;
        placement: number;
        score: number;
        participants: number;
        leagueFrom: string;
        leagueTo: string;
    }[]): Promise<number> {
        this.assertBrand(brand);
        let written = 0;
        for (let offset = 0; offset < results.length; offset += INSERT_CHUNK_SIZE) {
            const chunk = results.slice(offset, offset + INSERT_CHUNK_SIZE).map((result) => withBrandOnInsert({
                userId: result.userId,
                periodStart,
                placement: result.placement,
                score: result.score,
                participants: result.participants,
                leagueFrom: result.leagueFrom,
                leagueTo: result.leagueTo,
            }, brand));
            const queryString = knexBuilder.insert(chunk)
                .into(this.tableName)
                .onConflict(['brandVariation', 'periodStart', 'userId'])
                .ignore()
                .toString();
            // Sequential on purpose: chunks are few, and one failing chunk should stop the rest
            // rather than leave an arbitrary subset written. A re-run fills in what is missing.
            // eslint-disable-next-line no-await-in-loop
            const response = await this.db.write.query(queryString);
            written += response.rowCount || 0;
        }
        return written;
    }

    /**
     * Move every user to the tier a closed period assigned them (`leagueTo`), into
     * `main.userLeaderboardLeagues`. Reads the moves back from the stored results rather than
     * taking them as arguments: those rows are first-writer-wins, so a lazy close racing the
     * scheduled one, or a retry after a crash between the two writes, applies exactly the
     * outcome that was frozen — never a second promotion computed from an already-moved tier.
     *
     * Only moves a row forward in time (`lastPeriodStart` strictly older), so it is idempotent and
     * a no-op for a period closed without leagues. Returns the number of rows inserted or moved.
     */
    applyLeagueMoves(brand: BrandValue, periodStart: string): Promise<number> {
        this.assertBrand(brand);
        const resultsTable = quoteTableName(this.tableName);
        const leaguesTable = quoteTableName(USER_LEADERBOARD_LEAGUES_TABLE_NAME);

        const queryString = knexBuilder.raw(
            `INSERT INTO ${leaguesTable} AS l ("userId", "brandVariation", "league", "lastPeriodStart")
            SELECT r."userId", r."brandVariation", r."leagueTo", r."periodStart"
            FROM ${resultsTable} r
            WHERE r."brandVariation" = ?::text
                AND r."periodStart" = ?::date
                AND r."leagueTo" IS NOT NULL
            ON CONFLICT ("brandVariation", "userId") DO UPDATE
            SET "league" = excluded."league",
                "lastPeriodStart" = excluded."lastPeriodStart",
                "updatedAt" = now()
            WHERE l."lastPeriodStart" IS NULL
                OR l."lastPeriodStart" < excluded."lastPeriodStart"`,
            [brand, periodStart],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }

    /**
     * Whether a closed period was closed with leagues. This is what "leagues are active" means for
     * the live board, the pushes and the next placement: decided once per week at the close, so a
     * board never changes scope halfway through a week.
     */
    wasClosedWithLeagues(brand: BrandValue, periodStart: string): Promise<boolean> {
        const queryString = this.scopedQuery(brand)
            .select(`${this.tableName}.id`)
            .andWhere(`${this.tableName}.periodStart`, periodStart)
            .whereNotNull(`${this.tableName}.leagueTo`)
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.length > 0);
    }

    /** Whether the close job has already written results for this (brand, period). */
    hasResultsForPeriod(brand: BrandValue, periodStart: string): Promise<boolean> {
        const queryString = this.scopedQuery(brand)
            .count(`${this.tableName}.id as count`)
            .andWhere(`${this.tableName}.periodStart`, periodStart)
            .toString();

        return this.db.read.query(queryString).then((response) => (Number(response.rows[0]?.count) || 0) > 0);
    }

    /** A user's unacknowledged results, newest period first. */
    getPendingForUser(brand: BrandValue, userId: string): Promise<IDBLeaderboardPeriodResult[]> {
        const queryString = this.scopedQuery(brand)
            .select(`${this.tableName}.*`)
            .andWhere(`${this.tableName}.userId`, userId)
            .whereNull(`${this.tableName}.acknowledgedAt`)
            .orderBy(`${this.tableName}.periodStart`, 'desc')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map(LeaderboardPeriodResultsStore.normalize));
    }

    /** A user's result for one period, acknowledged or not. */
    getForUserAndPeriod(brand: BrandValue, userId: string, periodStart: string): Promise<IDBLeaderboardPeriodResult | undefined> {
        const queryString = this.scopedQuery(brand)
            .select(`${this.tableName}.*`)
            .andWhere(`${this.tableName}.userId`, userId)
            .andWhere(`${this.tableName}.periodStart`, periodStart)
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => (response.rows[0] ? LeaderboardPeriodResultsStore.normalize(response.rows[0]) : undefined));
    }

    /** Mark one period's result acknowledged. Idempotent; returns the row (or undefined if none). */
    acknowledge(brand: BrandValue, userId: string, periodStart: string): Promise<IDBLeaderboardPeriodResult | undefined> {
        const queryString = this.scopedUpdate(brand, { userId, periodStart })
            .whereNull('acknowledgedAt')
            .update({ acknowledgedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => (response.rows[0] ? LeaderboardPeriodResultsStore.normalize(response.rows[0]) : undefined));
    }

    /**
     * Auto-acknowledge every unacknowledged result for a user *older than* `periodStart`. The
     * daily-streak summary calls this after capping what it surfaces to the 3 most recent
     * periods, so a returning user is not shown (and never re-shown) a wall of stale placements.
     */
    acknowledgeOlderThan(brand: BrandValue, userId: string, periodStart: string): Promise<number> {
        const queryString = this.scopedUpdate(brand, { userId })
            .whereNull('acknowledgedAt')
            .andWhere('periodStart', '<', periodStart)
            .update({ acknowledgedAt: new Date() })
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }
}
