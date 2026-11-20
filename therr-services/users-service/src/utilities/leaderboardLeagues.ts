/**
 * Leaderboard leagues — the rules, as pure functions.
 *
 * A league is one tier of a brand's branded ladder (therr-js-utilities/config
 * `LEADERBOARD_TIERS_BY_BRAND`: Habits grows seedling → evergreen, Therr explores wanderer →
 * legend). While leagues are active, each user's weekly board, podium and placement are measured
 * against the people in their own tier, and each weekly close promotes the top of every tier and
 * relegates the bottom. See docs/FEATURES.md → "Leaderboard leagues".
 *
 * ## No cohorts — a league is the whole tier
 *
 * Duolingo splits each tier into cohorts of ~30. With a few dozen weekly participants per brand
 * that would mean several near-empty boards per tier, which reads as a dead app (the reason #3055
 * was deferred). So a league is simply every participant in a tier. On the first active week
 * everyone is in the lowest tier — the league *is* the whole brand board, unchanged — and higher
 * tiers fill only with people who earned their way up. Splitting a tier into cohorts later is a
 * change to `computeLeagueResults` alone; the stored ids do not change.
 *
 * ## When leagues run
 *
 * Two gates, both per brand:
 *   1. `LEADERBOARD_LEAGUES_BRANDS` (comma-separated brand list, e.g. `habits,therr`) — the
 *      rollout switch. Empty by default: leagues stay off until a brand's clients can render them.
 *   2. The activation threshold — a close only runs leagues when the elapsed week had at least
 *      `LEADERBOARD_LEAGUES_MIN_PARTICIPANTS` eligible participants (default 30). Below it the week
 *      closes exactly as before (one brand-wide ranking, league columns NULL) and nobody moves.
 *
 * "Active" for the live board means the most recently closed period was closed with leagues —
 * decided once per week at close, so the board never flips scope halfway through a week.
 */
import {
    getLeaderboardTierIndex,
    getLeaderboardTiers,
} from 'therr-js-utilities/config';

/** Share of a league promoted / relegated at each close (rounded down, at least 1). */
export const LEAGUE_PROMOTION_SHARE = 0.2;
export const LEAGUE_DEMOTION_SHARE = 0.2;

/**
 * A league smaller than this neither promotes nor relegates that week. With four people, "top 1
 * up, bottom 1 down" is half the league moving on what may be a single check-in's difference.
 */
export const LEAGUE_MIN_SIZE_FOR_MOVEMENT = 5;

export const DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS = 30;

/** Brands the rollout switch has turned leagues on for, limited to brands that have tiers. */
export const getLeagueEnabledBrands = (env: NodeJS.ProcessEnv = process.env): string[] => (env.LEADERBOARD_LEAGUES_BRANDS || '')
    .split(',')
    .map((brand) => brand.trim().toLowerCase())
    .filter((brand) => brand && getLeaderboardTiers(brand).length > 0);

export const areLeaguesEnabledForBrand = (brand: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean => (
    !!brand && getLeagueEnabledBrands(env).includes(String(brand).toLowerCase())
);

/** Weekly eligible participants a brand needs before a close runs leagues. Never below 1. */
export const getLeagueActivationThreshold = (env: NodeJS.ProcessEnv = process.env): number => {
    const parsed = parseInt(env.LEADERBOARD_LEAGUES_MIN_PARTICIPANTS || '', 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS;
};

/**
 * How many of a league move up and down at the close. The top tier promotes nobody and the lowest
 * relegates nobody — which is also why nobody can be demoted on the day leagues start.
 */
export const getLeagueMovementCounts = (
    leagueSize: number,
    tierIndex: number,
    tierCount: number,
): { promoteCount: number, demoteCount: number } => {
    if (leagueSize < LEAGUE_MIN_SIZE_FOR_MOVEMENT || tierCount < 2 || tierIndex < 0) {
        return { promoteCount: 0, demoteCount: 0 };
    }
    return {
        promoteCount: tierIndex < tierCount - 1 ? Math.max(1, Math.floor(leagueSize * LEAGUE_PROMOTION_SHARE)) : 0,
        demoteCount: tierIndex > 0 ? Math.max(1, Math.floor(leagueSize * LEAGUE_DEMOTION_SHARE)) : 0,
    };
};

export interface ILeagueParticipant {
    userId: string;
    points: number;
    /** The stored tier id; null (never moved) or an unknown id is the lowest tier. */
    league: string | null;
}

export interface ILeagueResult {
    userId: string;
    /** Competition rank within the user's league (ties share: 1, 1, 3). */
    placement: number;
    score: number;
    /** The league's size — the "of N" the placement is out of. */
    participants: number;
    leagueFrom: string;
    leagueTo: string;
}

/**
 * Rank every participant within their league and decide who moves.
 *
 * Ties are resolved in the users' favour at both edges: a tie straddling the promotion line
 * promotes everyone in it (they share the better placement), and a tie straddling the relegation
 * line spares everyone in it. A league can therefore promote or relegate slightly more or fewer
 * than `getLeagueMovementCounts` says, never someone who scored the same as a person who stayed.
 */
export const computeLeagueResults = (brand: string, participants: ILeagueParticipant[]): ILeagueResult[] => {
    const tiers = getLeaderboardTiers(brand);
    if (!tiers.length) {
        return [];
    }

    const byTierIndex = new Map<number, ILeagueParticipant[]>();
    participants.forEach((participant) => {
        const tierIndex = getLeaderboardTierIndex(brand, participant.league);
        const league = byTierIndex.get(tierIndex) || [];
        league.push(participant);
        byTierIndex.set(tierIndex, league);
    });

    const results: ILeagueResult[] = [];
    byTierIndex.forEach((league, tierIndex) => {
        const sorted = [...league].sort((a, b) => (b.points - a.points) || a.userId.localeCompare(b.userId));
        const size = sorted.length;
        const { promoteCount, demoteCount } = getLeagueMovementCounts(size, tierIndex, tiers.length);

        let previousPoints: number | null = null;
        let previousPlacement = 0;
        sorted.forEach((participant, index) => {
            const placement = previousPoints !== null && participant.points === previousPoints ? previousPlacement : index + 1;
            previousPoints = participant.points;
            previousPlacement = placement;

            let toIndex = tierIndex;
            if (promoteCount > 0 && placement <= promoteCount) {
                toIndex = tierIndex + 1;
            } else if (demoteCount > 0 && placement > size - demoteCount) {
                toIndex = tierIndex - 1;
            }

            results.push({
                userId: participant.userId,
                placement,
                score: participant.points,
                participants: size,
                leagueFrom: tiers[tierIndex].id,
                leagueTo: tiers[toIndex].id,
            });
        });
    });

    return results;
};
