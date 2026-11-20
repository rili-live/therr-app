/**
 * Leaderboard leagues — the rules, as pure functions.
 *
 * A league is one rung of a brand's branded ladder (therr-js-utilities/config
 * `LEADERBOARD_LEAGUES_BY_BRAND`: Habits grows seedling → evergreen, Therr explores wanderer →
 * legend). While leagues are active, each user's weekly board, podium and placement are measured
 * against the people in their own league, and each weekly close promotes the top of every league
 * and relegates the bottom. See docs/FEATURES.md → "Leaderboard leagues".
 *
 * ## No cohorts — everyone in a league competes together
 *
 * Duolingo splits each league into cohorts of ~30. With a few dozen weekly participants per brand
 * that would mean several near-empty boards per league, which reads as a dead app (the reason
 * #3055 was deferred). So a league's board is every participant in it. On the first active week
 * everyone is in the lowest league — its board *is* the whole brand board, unchanged — and higher
 * leagues fill only with people who earned their way up. Splitting a league into cohorts later is
 * a change to `computeLeagueResults` alone; the stored ids do not change.
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
    getLeaderboardLeagueIndex,
    getLeaderboardLeagues,
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

/** Brands the rollout switch has turned leagues on for, limited to brands that have a ladder. */
export const getLeagueEnabledBrands = (env: NodeJS.ProcessEnv = process.env): string[] => (env.LEADERBOARD_LEAGUES_BRANDS || '')
    .split(',')
    .map((brand) => brand.trim().toLowerCase())
    .filter((brand) => brand && getLeaderboardLeagues(brand).length > 0);

export const areLeaguesEnabledForBrand = (brand: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean => (
    !!brand && getLeagueEnabledBrands(env).includes(String(brand).toLowerCase())
);

/** Weekly eligible participants a brand needs before a close runs leagues. Never below 1. */
export const getLeagueActivationThreshold = (env: NodeJS.ProcessEnv = process.env): number => {
    const parsed = parseInt(env.LEADERBOARD_LEAGUES_MIN_PARTICIPANTS || '', 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS;
};

/**
 * How many of a league move up and down at the close. The top league promotes nobody and the lowest
 * relegates nobody — which is also why nobody can be demoted on the day leagues start.
 */
export const getLeagueMovementCounts = (
    leagueSize: number,
    leagueIndex: number,
    leagueCount: number,
): { promoteCount: number, demoteCount: number } => {
    if (leagueSize < LEAGUE_MIN_SIZE_FOR_MOVEMENT || leagueCount < 2 || leagueIndex < 0) {
        return { promoteCount: 0, demoteCount: 0 };
    }
    return {
        promoteCount: leagueIndex < leagueCount - 1 ? Math.max(1, Math.floor(leagueSize * LEAGUE_PROMOTION_SHARE)) : 0,
        demoteCount: leagueIndex > 0 ? Math.max(1, Math.floor(leagueSize * LEAGUE_DEMOTION_SHARE)) : 0,
    };
};

export interface ILeagueParticipant {
    userId: string;
    points: number;
    /** The stored league id; null (never moved) or an unknown id is the lowest league. */
    league: string | null;
    /**
     * When the user reached their score: the score row's `updatedAt`, bumped on every award. Breaks
     * ties at the promotion line — whoever got there first moves up. Missing sorts last.
     */
    reachedAt?: Date | string | null;
}

const toTime = (value?: Date | string | null): number => {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

/**
 * League order: points, then who reached that score first, then userId so the order is total.
 * The weekly board (UserLeaderboardScoresStore.getTopScores) orders ties the same way, so the row
 * a client marks as promoted is the row the close promotes.
 */
export const compareLeagueParticipants = (a: ILeagueParticipant, b: ILeagueParticipant): number => (b.points - a.points)
    || (toTime(a.reachedAt) - toTime(b.reachedAt))
    || a.userId.localeCompare(b.userId);

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
 * Placements are competition ranks (ties share: 1, 1, 3), but the two lines treat ties differently:
 *
 *   - Promotion moves exactly `promoteCount` people, in league order — a tie straddling the line
 *     goes to whoever reached the score first (`compareLeagueParticipants`). Promoting the whole
 *     tie instead let coarse XP (many users on one check-in's worth) promote most of a league, and
 *     a league where everyone tied promoted everyone.
 *   - Relegation spares a tie straddling its line, so it moves at most `demoteCount` and never
 *     someone who scored the same as a person who stayed.
 */
export const computeLeagueResults = (brand: string, participants: ILeagueParticipant[]): ILeagueResult[] => {
    const ladder = getLeaderboardLeagues(brand);
    if (!ladder.length) {
        return [];
    }

    const membersByLeagueIndex = new Map<number, ILeagueParticipant[]>();
    participants.forEach((participant) => {
        const leagueIndex = getLeaderboardLeagueIndex(brand, participant.league);
        const members = membersByLeagueIndex.get(leagueIndex) || [];
        members.push(participant);
        membersByLeagueIndex.set(leagueIndex, members);
    });

    const results: ILeagueResult[] = [];
    membersByLeagueIndex.forEach((members, leagueIndex) => {
        const sorted = [...members].sort(compareLeagueParticipants);
        const size = sorted.length;
        const { promoteCount, demoteCount } = getLeagueMovementCounts(size, leagueIndex, ladder.length);

        let previousPoints: number | null = null;
        let previousPlacement = 0;
        sorted.forEach((participant, index) => {
            const placement = previousPoints !== null && participant.points === previousPoints ? previousPlacement : index + 1;
            previousPoints = participant.points;
            previousPlacement = placement;

            let toIndex = leagueIndex;
            if (index < promoteCount) {
                toIndex = leagueIndex + 1;
            } else if (demoteCount > 0 && placement > size - demoteCount) {
                toIndex = leagueIndex - 1;
            }

            results.push({
                userId: participant.userId,
                placement,
                score: participant.points,
                participants: size,
                leagueFrom: ladder[leagueIndex].id,
                leagueTo: ladder[toIndex].id,
            });
        });
    });

    return results;
};
