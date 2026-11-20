import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

// eslint-disable-next-line therr/no-direct-brand-scoped-table -- this is the sanctioned canonical reference
export const USER_LEADERBOARD_LEAGUES_TABLE_NAME = 'main.userLeaderboardLeagues';

export interface IDBUserLeaderboardLeague {
    id: string;
    userId: string;
    brandVariation: string;
    league: string;
    lastPeriodStart: string | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * The leaderboard league each user is in, per brand (`main.userLeaderboardLeagues`).
 * A user with no row is in the brand's lowest league — callers resolve a missing or unknown id
 * through `resolveLeaderboardLeague` from therr-js-utilities/config.
 *
 * Read-only from the API's side: the only writer is the weekly close, through
 * LeaderboardPeriodResultsStore.applyLeagueMoves, which applies what the close froze into
 * `main.leaderboardPeriodResults.leagueTo`. See the table migration.
 */
export default class UserLeaderboardLeaguesStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // 'enforce' from day one: there are no legacy rows and every caller has a brand in hand.
        super(dbConnection, USER_LEADERBOARD_LEAGUES_TABLE_NAME, 'enforce');
    }

    /** The user's stored league id for a brand, or null when they have never moved (lowest league). */
    getLeagueForUser(brand: BrandValue, userId: string): Promise<string | null> {
        const queryString = this.scopedQuery(brand)
            .select(`${this.tableName}.league`)
            .andWhere(`${this.tableName}.userId`, userId)
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]?.league || null);
    }
}
