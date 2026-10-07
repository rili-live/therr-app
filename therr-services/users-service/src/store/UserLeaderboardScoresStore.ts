import KnexBuilder, { Knex } from 'knex';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line therr/no-direct-brand-scoped-table -- this is the sanctioned canonical reference
export const USER_LEADERBOARD_SCORES_TABLE_NAME = 'main.userLeaderboardScores';
const USERS_TABLE_NAME = 'main.users';

export interface IDBLeaderboardScore {
    id: string;
    userId: string;
    brandVariation: string;
    periodStart: string;
    points: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILeaderboardEntry {
    userId: string;
    points: number;
    userName: string;
    firstName?: string;
    lastName?: string;
    media?: any;
}

interface IGetTopScoresArgs {
    periodStart?: string; // omitted → all-time (SUM across periods)
    limit?: number;
    userIds?: string[]; // restrict ranking pool (connections scope)
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Weekly XP aggregates powering the leaderboard. XP is append-only and separate from
 * the spendable coin balance — see the table's migration for the full design rationale.
 * Eligibility (opt-out setting, soft-deleted accounts) is enforced here at read time so
 * the write path stays a blind upsert-increment.
 */
export default class UserLeaderboardScoresStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // Brand-scoped from creation per docs/NICHE_APP_DATABASE_GUIDELINES.md.
        // Stays in 'shadow' for one release cycle; flip to 'enforce' once shadow logs are clean.
        super(dbConnection, USER_LEADERBOARD_SCORES_TABLE_NAME, 'shadow');
    }

    /**
     * Atomically adds points to a user's score for the given weekly period,
     * creating the row on first activity of the week.
     */
    incrementPoints(brand: BrandValue, userId: string, periodStart: string, points: number) {
        if (!points || points <= 0) {
            return Promise.resolve([] as IDBLeaderboardScore[]);
        }
        const queryString = this.scopedInsert(brand, {
            userId,
            periodStart,
            points: Math.round(points),
        })
            .onConflict(['userId', 'brandVariation', 'periodStart'])
            .merge({
                points: knexBuilder.raw(`"${this.tableName.split('.')[1]}"."points" + excluded."points"`),
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    private applyEligibilityFilters(qb: Knex.QueryBuilder) {
        return qb
            .innerJoin(USERS_TABLE_NAME, `${USERS_TABLE_NAME}.id`, `${this.tableName}.userId`)
            .andWhere(`${USERS_TABLE_NAME}.settingsIsLeaderboardEnabled`, true)
            .andWhere((builder) => {
                builder.where(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`, false)
                    .orWhereNull(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`);
            });
    }

    /**
     * Ranked top scores for a brand. With periodStart → that week's board; without →
     * all-time board (SUM of all periods). Pass userIds to restrict the pool
     * (connections scope — caller includes the requesting user's own id).
     */
    getTopScores(brand: BrandValue, {
        periodStart,
        limit,
        userIds,
    }: IGetTopScoresArgs): Promise<ILeaderboardEntry[]> {
        const safeLimit = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
        let queryBuilder = this.scopedQuery(brand)
            .select([
                `${this.tableName}.userId`,
                `${USERS_TABLE_NAME}.userName`,
                `${USERS_TABLE_NAME}.firstName`,
                `${USERS_TABLE_NAME}.lastName`,
                `${USERS_TABLE_NAME}.media`,
            ]);

        queryBuilder = this.applyEligibilityFilters(queryBuilder);

        if (userIds) {
            if (!userIds.length) {
                return Promise.resolve([]);
            }
            queryBuilder = queryBuilder.whereIn(`${this.tableName}.userId`, userIds);
        }

        if (periodStart) {
            queryBuilder = queryBuilder
                .select(`${this.tableName}.points`)
                .andWhere(`${this.tableName}.periodStart`, periodStart)
                .orderBy(`${this.tableName}.points`, 'desc');
        } else {
            queryBuilder = queryBuilder
                .sum(`${this.tableName}.points as points`)
                .groupBy([
                    `${this.tableName}.userId`,
                    `${USERS_TABLE_NAME}.userName`,
                    `${USERS_TABLE_NAME}.firstName`,
                    `${USERS_TABLE_NAME}.lastName`,
                    `${USERS_TABLE_NAME}.media`,
                ])
                .orderBy('points', 'desc');
        }

        const queryString = queryBuilder
            // Deterministic tie-break so pagination/ranks are stable within a tie
            .orderBy(`${this.tableName}.userId`, 'asc')
            .limit(safeLimit)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map((row) => ({
                ...row,
                points: Number(row.points) || 0,
            })));
    }

    /**
     * The requesting user's own points for a period (or all-time when periodStart is
     * omitted). Returns 0 when the user has no activity yet. Not eligibility-filtered —
     * a user always sees their own score, even while opted out of public boards.
     */
    getUserScore(brand: BrandValue, userId: string, periodStart?: string): Promise<number> {
        let queryBuilder = this.scopedQuery(brand)
            .sum(`${this.tableName}.points as points`)
            .andWhere(`${this.tableName}.userId`, userId);

        if (periodStart) {
            queryBuilder = queryBuilder.andWhere(`${this.tableName}.periodStart`, periodStart);
        }

        return this.db.read.query(queryBuilder.toString())
            .then((response) => Number(response.rows[0]?.points) || 0);
    }

    /**
     * 1-based rank of a score within a brand's eligible pool: 1 + count of eligible
     * users strictly ahead. Pass userIds to rank within a connections pool.
     *
     * Pass excludeUserId to omit a user's own row from the count. Rank-milestone
     * detection needs this: it asks for the rank of a *historical* score after the
     * user's row has already been incremented, so without the exclusion the user's
     * own new points count as "ahead of" their old score and inflate the rank by one.
     */
    getRankForScore(brand: BrandValue, score: number, {
        periodStart,
        userIds,
        excludeUserId,
    }: { periodStart?: string, userIds?: string[], excludeUserId?: string }): Promise<number> {
        if (userIds && !userIds.length) {
            return Promise.resolve(1);
        }

        let queryBuilder;
        if (periodStart) {
            queryBuilder = this.scopedQuery(brand)
                .count(`${this.tableName}.userId as count`)
                .andWhere(`${this.tableName}.periodStart`, periodStart)
                .andWhere(`${this.tableName}.points`, '>', score);
            queryBuilder = this.applyEligibilityFilters(queryBuilder);
            if (userIds) {
                queryBuilder = queryBuilder.whereIn(`${this.tableName}.userId`, userIds);
            }
            if (excludeUserId) {
                queryBuilder = queryBuilder.whereNot(`${this.tableName}.userId`, excludeUserId);
            }
        } else {
            // All-time: count users whose summed points exceed the score
            let innerBuilder = this.scopedQuery(brand)
                .select(`${this.tableName}.userId`)
                .sum(`${this.tableName}.points as totalPoints`)
                .groupBy(`${this.tableName}.userId`);
            innerBuilder = this.applyEligibilityFilters(innerBuilder);
            if (userIds) {
                innerBuilder = innerBuilder.whereIn(`${this.tableName}.userId`, userIds);
            }
            if (excludeUserId) {
                innerBuilder = innerBuilder.whereNot(`${this.tableName}.userId`, excludeUserId);
            }
            queryBuilder = knexBuilder
                .count('sub.userId as count')
                .from(innerBuilder.having(knexBuilder.raw(`SUM("${this.tableName.split('.')[1]}"."points") > ?`, [score])).as('sub'));
        }

        return this.db.read.query(queryBuilder.toString())
            .then((response) => 1 + (Number(response.rows[0]?.count) || 0));
    }

    /**
     * Eligible users on a weekly board scoring below `targetPoints` by at most `maxGap`, who
     * have not muted leaderboard alerts. With targetPoints = the third-highest score, these
     * are exactly the users who would reach the podium by tying it (competition ranking:
     * tying #3 makes you #3). Includes what the podium-within-reach push needs to schedule
     * and localize itself.
     */
    getUsersWithinReachOfScore(brand: BrandValue, {
        periodStart,
        targetPoints,
        maxGap,
    }: {
        periodStart: string,
        targetPoints: number,
        maxGap: number,
    }): Promise<{
        userId: string,
        points: number,
        settingsLocale?: string | null,
        settingsTimezone?: string | null,
        settingsQuietHoursStart?: string | null,
        settingsQuietHoursEnd?: string | null,
    }[]> {
        if (targetPoints <= 0 || maxGap <= 0) {
            return Promise.resolve([]);
        }
        let queryBuilder = this.scopedQuery(brand)
            .select([
                `${this.tableName}.userId`,
                `${this.tableName}.points`,
                `${USERS_TABLE_NAME}.settingsLocale`,
                `${USERS_TABLE_NAME}.settingsTimezone`,
                `${USERS_TABLE_NAME}.settingsQuietHoursStart`,
                `${USERS_TABLE_NAME}.settingsQuietHoursEnd`,
            ])
            .andWhere(`${this.tableName}.periodStart`, periodStart)
            .andWhere(`${this.tableName}.points`, '<', targetPoints)
            .andWhere(`${this.tableName}.points`, '>=', Math.max(targetPoints - maxGap, 1))
            // Mutes on an explicit false only; null is a row that predates the column.
            .andWhereRaw(`"${USERS_TABLE_NAME.split('.')[1]}"."settingsPushLeaderboardAlerts" IS DISTINCT FROM false`);
        queryBuilder = this.applyEligibilityFilters(queryBuilder);

        return this.db.read.query(queryBuilder.orderBy(`${this.tableName}.points`, 'desc').toString())
            .then((response) => response.rows.map((row) => ({
                ...row,
                points: Number(row.points) || 0,
            })));
    }

    /**
     * Eligible users the climber just pushed from exactly `rank` to `rank + 1` on a weekly
     * board, by moving from prevPoints to newPoints.
     *
     * A climb shifts another user's rank only if it jumps them: their score s satisfies
     * prevPoints <= s < newPoints. Such a user's rank goes from 1 + A to 2 + A, where A is
     * the number of OTHER users (climber excluded) strictly ahead of them — which is what
     * RANK() over the climber-less pool computes. So "was exactly `rank`, now one worse" is
     * that window rank equalling `rank` within the jumped score band. Ties at `rank` all
     * fall together, matching how getRankForScore ranks them.
     *
     * Users who muted leaderboard alerts are dropped only AFTER ranking: they are still on
     * the board, and ranking without them would mis-rank everyone below.
     */
    getUsersDisplacedFromRank(brand: BrandValue, {
        periodStart,
        rank,
        climberUserId,
        prevPoints,
        newPoints,
    }: {
        periodStart: string,
        rank: number,
        climberUserId: string,
        prevPoints: number,
        newPoints: number,
    }): Promise<{ userId: string, points: number, settingsLocale?: string }[]> {
        if (newPoints <= prevPoints) {
            return Promise.resolve([]);
        }
        const pointsColumn = `"${this.tableName.split('.')[1]}"."points"`;
        let rankedPool = this.scopedQuery(brand)
            .select([
                `${this.tableName}.userId`,
                `${this.tableName}.points`,
                `${USERS_TABLE_NAME}.settingsLocale`,
                `${USERS_TABLE_NAME}.settingsPushLeaderboardAlerts`,
                knexBuilder.raw(`RANK() OVER (ORDER BY ${pointsColumn} DESC) AS "boardRank"`),
            ])
            .andWhere(`${this.tableName}.periodStart`, periodStart)
            .whereNot(`${this.tableName}.userId`, climberUserId);
        rankedPool = this.applyEligibilityFilters(rankedPool);

        const queryString = knexBuilder
            .select(['ranked.userId', 'ranked.points', 'ranked.settingsLocale'])
            .from(rankedPool.as('ranked'))
            .where('ranked.boardRank', rank)
            .andWhere('ranked.points', '>=', prevPoints)
            .andWhere('ranked.points', '<', newPoints)
            // Mutes on an explicit false only; null is a row that predates the column.
            .andWhereRaw('"ranked"."settingsPushLeaderboardAlerts" IS DISTINCT FROM false')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map((row) => ({
                ...row,
                points: Number(row.points) || 0,
            })));
    }
}
