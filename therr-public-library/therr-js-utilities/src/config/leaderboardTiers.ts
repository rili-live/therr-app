import { BrandVariations } from '../constants/enums/Branding';

/**
 * Leaderboard tiers ("leagues") — the ladder a brand's weekly board is split into once leagues
 * are active for that brand. Each brand climbs its own themed ladder, lowest tier first:
 *
 *   - Friends with Habits grows: a habit planted as a seedling becomes an evergreen.
 *   - Therr explores: a wanderer becomes a legend of the map.
 *
 * Shared by the backend (which persists the ids and computes promotion/relegation at each
 * weekly close) and the clients (which render the name, emoji and colour).
 *
 * ## Ids are persisted — never rename or reorder one
 *
 * `id` is written to `main.userLeaderboardLeagues.league` and to
 * `main.leaderboardPeriodResults.leagueFrom` / `leagueTo`. Renaming an id strands every user in
 * it (an unknown id is read as the lowest tier); reordering silently promotes or demotes people.
 * To rebrand a tier, change its display name in the client locale dictionaries
 * (`pages.leaderboard.leagues.tiers.<brand>.<id>`) and keep the id. Appending a new top tier is
 * safe.
 *
 * Ids must be unique within a brand and at most 50 characters (the column width).
 */

export interface ILeaderboardTier {
    /** Persisted identifier. Stable forever — see the note above. */
    id: string;
    /** Shown beside the tier name; the cheapest way to make a tier recognisable at a glance. */
    emoji: string;
    /** Accent colour for the tier badge and header. Must read on both light and dark surfaces. */
    color: string;
}

const HABITS_TIERS: ReadonlyArray<ILeaderboardTier> = [
    { id: 'seedling', emoji: '🌱', color: '#7CB342' },
    { id: 'sprout', emoji: '🌿', color: '#43A047' },
    { id: 'sapling', emoji: '🪴', color: '#2E7D32' },
    { id: 'bloom', emoji: '🌸', color: '#D81B60' },
    { id: 'oak', emoji: '🌳', color: '#8D6E63' },
    { id: 'evergreen', emoji: '🌲', color: '#00695C' },
];

const THERR_TIERS: ReadonlyArray<ILeaderboardTier> = [
    { id: 'wanderer', emoji: '🥾', color: '#8D6E63' },
    { id: 'scout', emoji: '🔭', color: '#5C6BC0' },
    { id: 'pathfinder', emoji: '🧭', color: '#1E88E5' },
    { id: 'trailblazer', emoji: '⛰️', color: '#00897B' },
    { id: 'cartographer', emoji: '🗺️', color: '#F4511E' },
    { id: 'legend', emoji: '🌟', color: '#FFB300' },
];

/**
 * Tiers per brand, lowest first. A brand without an entry has no leagues; `getLeaderboardTiers`
 * returns an empty list for it and every caller treats that as "leagues off".
 */
export const LEADERBOARD_TIERS_BY_BRAND: { [brand: string]: ReadonlyArray<ILeaderboardTier> } = {
    [BrandVariations.HABITS]: HABITS_TIERS,
    [BrandVariations.THERR]: THERR_TIERS,
};

export const getLeaderboardTiers = (
    brandVariation?: BrandVariations | string | null,
): ReadonlyArray<ILeaderboardTier> => (brandVariation && LEADERBOARD_TIERS_BY_BRAND[brandVariation]) || [];

/** The tier every user starts in (and the one an unknown/legacy id is read as). */
export const getLowestLeaderboardTier = (
    brandVariation?: BrandVariations | string | null,
): ILeaderboardTier | undefined => getLeaderboardTiers(brandVariation)[0];

/**
 * 0-based position of a tier on its brand's ladder (0 = lowest). An unknown, null or legacy id
 * resolves to 0, the lowest tier — never -1 — so a stored id that no longer exists can only ever
 * cost a user ground, never crash a read. Returns -1 only when the brand has no tiers at all.
 */
export const getLeaderboardTierIndex = (
    brandVariation: BrandVariations | string | null | undefined,
    tierId?: string | null,
): number => {
    const tiers = getLeaderboardTiers(brandVariation);
    if (!tiers.length) return -1;
    const index = tierId ? tiers.findIndex((tier) => tier.id === tierId) : -1;
    return index < 0 ? 0 : index;
};

/**
 * The tier a stored id resolves to for a brand — the lowest tier for null/unknown ids.
 * Undefined only when the brand has no tiers.
 */
export const resolveLeaderboardTier = (
    brandVariation: BrandVariations | string | null | undefined,
    tierId?: string | null,
): ILeaderboardTier | undefined => {
    const index = getLeaderboardTierIndex(brandVariation, tierId);
    return index < 0 ? undefined : getLeaderboardTiers(brandVariation)[index];
};
