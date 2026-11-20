import { ILeaderboardTier, getLeaderboardTiers, resolveLeaderboardTier } from 'therr-js-utilities/config';

/**
 * Leaderboard leagues on the client: the requester's league as `GET /users/leaderboards` describes
 * it (null while leagues are not running for the brand), plus the display helpers the board uses.
 *
 * Each brand climbs its own branded ladder (therr-js-utilities/config `LEADERBOARD_TIERS_BY_BRAND`):
 * the ids, emoji and colours come from there; the names come from the locale dictionaries under
 * `pages.leaderboard.leagues.tiers.<brand>.<id>`, so a tier is renamed per locale without touching
 * the id the server stores.
 */
export interface ILeaderboardLeague {
    /** The requester's tier id. */
    id: string;
    /** 0-based position on the brand's ladder (0 = lowest). */
    tierIndex: number;
    tierCount: number;
    /** People in this league with XP this week. */
    size: number;
    /** How many the weekly close would move up / down if the week ended now. */
    promoteCount: number;
    demoteCount: number;
}

export type LeagueZone = 'promote' | 'demote' | null;

export const getTierNameKey = (brand: string, tierId: string) => `pages.leaderboard.leagues.tiers.${brand}.${tierId}`;

/** The tier a stored id resolves to on this brand's ladder (the lowest one for null/unknown ids). */
export const getTier = (brand: string, tierId?: string | null): ILeaderboardTier | undefined => resolveLeaderboardTier(brand, tierId);

/** The tier `offset` steps from `tierIndex` on the ladder, or undefined past either end. */
export const getNeighbourTier = (brand: string, tierIndex: number, offset: 1 | -1): ILeaderboardTier | undefined => (
    getLeaderboardTiers(brand)[tierIndex + offset]
);

/**
 * Whether a row on the league board currently sits in the promotion or relegation zone. Mirrors the
 * server's rule (utilities/leaderboardLeagues.ts `computeLeagueResults`): competition ranks, ties
 * resolved in the user's favour, promotion checked first.
 */
export const getLeagueZone = (rank: number, league: ILeaderboardLeague | null | undefined): LeagueZone => {
    if (!league || rank < 1) {
        return null;
    }
    if (league.promoteCount > 0 && rank <= league.promoteCount) {
        return 'promote';
    }
    if (league.demoteCount > 0 && rank > league.size - league.demoteCount) {
        return 'demote';
    }
    return null;
};
