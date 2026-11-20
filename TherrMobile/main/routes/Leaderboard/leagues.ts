import { ILeaderboardLeague, getLeaderboardLeagues, resolveLeaderboardLeague } from 'therr-js-utilities/config';

/**
 * Leaderboard leagues on the client: the requester's league as `GET /users/leaderboards` describes
 * it (null while leagues are not running for the brand), plus the display helpers the board uses.
 *
 * Each brand climbs its own branded ladder of leagues (therr-js-utilities/config
 * `LEADERBOARD_LEAGUES_BY_BRAND`): the ids, emoji and colours come from there; the names come from
 * the locale dictionaries under `pages.leaderboard.leagues.names.<brand>.<id>`, so a league is
 * renamed per locale without touching the id the server stores.
 */
export interface ILeaderboardLeagueStatus {
    /** The requester's league id. */
    id: string;
    /** 0-based position on the brand's ladder (0 = lowest). */
    leagueIndex: number;
    leagueCount: number;
    /** People in this league with XP this week. */
    size: number;
    /** How many the weekly close would move up / down if the week ended now. */
    promoteCount: number;
    demoteCount: number;
}

export type LeagueZone = 'promote' | 'demote' | null;

export const getLeagueNameKey = (brand: string, leagueId: string) => `pages.leaderboard.leagues.names.${brand}.${leagueId}`;

/** The league a stored id resolves to on this brand's ladder (the lowest one for null/unknown ids). */
export const resolveLeague = (brand: string, leagueId?: string | null): ILeaderboardLeague | undefined => (
    resolveLeaderboardLeague(brand, leagueId)
);

/** The league `offset` steps from `leagueIndex` on the ladder, or undefined past either end. */
export const getNeighbourLeague = (brand: string, leagueIndex: number, offset: 1 | -1): ILeaderboardLeague | undefined => (
    getLeaderboardLeagues(brand)[leagueIndex + offset]
);

/**
 * Whether a row on the league board currently sits in the promotion or relegation zone. Mirrors the
 * server's rule (utilities/leaderboardLeagues.ts `computeLeagueResults`): competition ranks, ties
 * resolved in the user's favour, promotion checked first.
 */
export const getLeagueZone = (rank: number, status: ILeaderboardLeagueStatus | null | undefined): LeagueZone => {
    if (!status || rank < 1) {
        return null;
    }
    if (status.promoteCount > 0 && rank <= status.promoteCount) {
        return 'promote';
    }
    if (status.demoteCount > 0 && rank > status.size - status.demoteCount) {
        return 'demote';
    }
    return null;
};
