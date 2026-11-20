import { BrandVariations } from 'therr-js-utilities/constants';
import { getLeaderboardLeagueIndex, resolveLeaderboardLeague } from 'therr-js-utilities/config';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { BrandValue } from '../../store/BrandScopedStore';
import { IDBLeaderboardPeriodResult } from '../../store/LeaderboardPeriodResultsStore';
import { getLeaderboardPeriodEnd, getLeaderboardPeriodStart } from '../../utilities/leaderboardHelpers';
import {
    areLeaguesEnabledForBrand,
    computeLeagueResults,
    getLeagueActivationThreshold,
    ILeagueResult,
} from '../../utilities/leaderboardLeagues';

/**
 * How many closed periods a user is shown placements for before older ones are auto-
 * acknowledged. A returning user gets at most this many placement screens/cards, never a wall.
 */
export const MAX_PENDING_PLACEMENTS = 3;

/** Placements at or above this get the full-screen celebration; the rest an inline card. */
export const PODIUM_PLACEMENT_MAX = 3;

/** Brands that have a leaderboard and therefore periods to close. */
export const LEADERBOARD_BRANDS: BrandValue[] = [BrandVariations.THERR, BrandVariations.HABITS];

/**
 * The most recently *elapsed* weekly period (the Monday before the current one), as of `now`.
 */
export const getPreviousPeriodStart = (now: Date = new Date()): string => {
    const current = getLeaderboardPeriodStart(now);
    const previous = new Date(`${current}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 7);
    return previous.toISOString().split('T')[0];
};

/**
 * The last period each brand closed in this process. `hasResultsForPeriod` cannot tell a period
 * that was closed with no participants from one never closed, so without this a brand whose
 * previous week had no scores would re-run the ranking INSERT ... SELECT on every summary read,
 * all week. One key per brand: it rotates on its own when the period does, and a restart only
 * costs one extra (idempotent) close.
 */
const closedPeriodByBrand = new Map<string, string>();

/**
 * Whether each brand's most recently elapsed period was closed with leagues, per process. Keyed by
 * that periodStart, so it re-evaluates on its own when the week rolls over.
 */
const leagueModeByBrand = new Map<string, { periodStart: string, isActive: boolean }>();

/**
 * Each user's resolved league for the week, per process, keyed `brand:userId`. A league only
 * changes at the weekly close, and `areLeaguesActiveForBrand` has applied that close's moves in
 * this process before anything reads here, so an entry is good until `periodStart` rolls over.
 * Spares the rank-milestone check a league read on every XP award. Bounded: cleared wholesale at
 * the cap rather than evicted one by one — a miss is a single indexed read.
 */
const leagueByUser = new Map<string, { periodStart: string, league: string | undefined }>();
const LEAGUE_BY_USER_MAX_ENTRIES = 10000;

/** Test affordance: forget which periods this process has already closed. */
export const resetClosedPeriodMemo = () => {
    closedPeriodByBrand.clear();
    leagueModeByBrand.clear();
    leagueByUser.clear();
};

/** How many results moved up (direction 1) or down (-1) a league. */
const countMoves = (brand: string, results: ILeagueResult[], direction: 1 | -1): number => results
    .filter((result) => Math.sign(getLeaderboardLeagueIndex(brand, result.leagueTo) - getLeaderboardLeagueIndex(brand, result.leagueFrom)) === direction)
    .length;

/**
 * Rank one elapsed period and write its results. With leagues on for the brand and the week at or
 * above the activation threshold, every participant is ranked within their own league and the top
 * and bottom of each league move (utilities/leaderboardLeagues.ts); otherwise it is the one
 * brand-wide ranking with the league columns NULL, exactly as before leagues existed.
 */
const writePeriodResults = async (brand: BrandValue, periodStart: string): Promise<number> => {
    if (!areLeaguesEnabledForBrand(String(brand))) {
        return Store.leaderboardPeriodResults.closePeriod(brand, periodStart);
    }

    const participants = await Store.userLeaderboardScores.getEligibleParticipantsForPeriod(brand, periodStart);
    const threshold = getLeagueActivationThreshold();
    if (participants.length < threshold) {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Leaderboard period closed without leagues: below the activation threshold'],
            traceArgs: {
                'pushNotification.brandVariation': String(brand),
                'leaderboard.periodStart': periodStart,
                'leaderboard.participants': participants.length,
                'leaderboard.leagueThreshold': threshold,
            },
        });
        return Store.leaderboardPeriodResults.closePeriod(brand, periodStart);
    }

    const results = computeLeagueResults(String(brand), participants);
    const written = await Store.leaderboardPeriodResults.insertLeagueResults(brand, periodStart, results);
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Leaderboard period closed with leagues'],
        traceArgs: {
            'pushNotification.brandVariation': String(brand),
            'leaderboard.periodStart': periodStart,
            'leaderboard.participants': participants.length,
            'leaderboard.promoted': countMoves(String(brand), results, 1),
            'leaderboard.demoted': countMoves(String(brand), results, -1),
            'leaderboard.rowsWritten': written,
        },
    });
    return written;
};

/**
 * Close the most recently elapsed period for a brand if it has not been closed yet: rank every
 * participant and write `main.leaderboardPeriodResults` (ties share a placement). Idempotent — the
 * store's INSERT ... ON CONFLICT DO NOTHING means a scheduled close and a lazy close from a client
 * read cannot both write. Returns the number of rows written.
 *
 * With leagues on for the brand, the league moves the close froze are then applied to
 * `main.userLeaderboardLeagues` — on every first close attempt of the period in this process,
 * including when the results were already there, so a crash between the two writes heals on the
 * next read. The apply only ever moves a user forward in time, so repeating it changes nothing.
 *
 * Only the immediately previous period is closed. Older periods are not retroactively ranked:
 * a placement announced weeks late is noise, and the scores themselves stay on the all-time
 * board regardless.
 */
export const closeElapsedLeaderboardPeriod = async (brand: BrandValue, now: Date = new Date()): Promise<number> => {
    const periodStart = getPreviousPeriodStart(now);
    if (closedPeriodByBrand.get(String(brand)) === periodStart) {
        return 0;
    }
    const alreadyClosed = await Store.leaderboardPeriodResults.hasResultsForPeriod(brand, periodStart);
    const written = alreadyClosed ? 0 : await writePeriodResults(brand, periodStart);
    if (areLeaguesEnabledForBrand(String(brand))) {
        await Store.leaderboardPeriodResults.applyLeagueMoves(brand, periodStart);
    }
    // Remembered only once the close has actually happened — a throw above leaves the next
    // read to try again.
    closedPeriodByBrand.set(String(brand), periodStart);
    return written;
};

/**
 * Best-effort close for every leaderboard brand — the scheduled path. Never throws.
 */
export const closeElapsedLeaderboardPeriods = async (now: Date = new Date()): Promise<Record<string, number>> => {
    const written: Record<string, number> = {};
    await Promise.all(LEADERBOARD_BRANDS.map((brand) => closeElapsedLeaderboardPeriod(brand, now)
        .then((count) => {
            written[brand] = count;
        })
        .catch((err) => {
            written[brand] = -1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to close leaderboard period'],
                traceArgs: { 'error.message': err?.message, 'pushNotification.brandVariation': String(brand) },
            });
        })));
    return written;
};

export interface IPendingPlacement {
    /** The period id: its Monday-anchored UTC periodStart. */
    periodId: string;
    periodStart: string;
    periodEnd: string;
    placement: number;
    participants: number;
    score: number;
    /**
     * The league the user competed in and the league the close moved them to (equal when they stayed).
     * Both null when the period closed without leagues; `placement` / `participants` are then
     * brand-wide rather than league-relative.
     */
    leagueFrom: string | null;
    leagueTo: string | null;
}

export const toPendingPlacement = (row: IDBLeaderboardPeriodResult): IPendingPlacement => ({
    periodId: row.periodStart,
    periodStart: row.periodStart,
    periodEnd: getLeaderboardPeriodEnd(row.periodStart),
    placement: row.placement,
    participants: row.participants,
    score: row.score,
    leagueFrom: row.leagueFrom,
    leagueTo: row.leagueTo,
});

/**
 * The user's unacknowledged placements, newest first, capped to MAX_PENDING_PLACEMENTS periods.
 * Anything older than the cap is marked acknowledged so it is never surfaced later either.
 * Closes the elapsed period first (lazily) so a user opening the app on Monday morning sees
 * last week's result without waiting for the scheduled close.
 */
export const getPendingPlacementsForUser = async (brand: BrandValue, userId: string, now: Date = new Date()): Promise<IPendingPlacement[]> => {
    await closeElapsedLeaderboardPeriod(brand, now).catch((err) => logSpan({
        level: 'warn',
        messageOrigin: 'API_SERVER',
        messages: ['Lazy leaderboard period close failed'],
        traceArgs: { 'error.message': err?.message, 'user.id': userId },
    }));

    const pending = await Store.leaderboardPeriodResults.getPendingForUser(brand, userId);
    const surfaced = pending.slice(0, MAX_PENDING_PLACEMENTS);
    if (pending.length > MAX_PENDING_PLACEMENTS) {
        const oldestSurfaced = surfaced[surfaced.length - 1];
        await Store.leaderboardPeriodResults.acknowledgeOlderThan(brand, userId, oldestSurfaced.periodStart)
            .catch(() => null);
    }

    return surfaced.map(toPendingPlacement);
};

/**
 * Whether leagues are running for a brand this week: the rollout switch is on for the brand AND
 * the most recently elapsed period was closed with leagues (it met the activation threshold).
 * Closes that period first if nothing has yet, so Monday's first read decides the week.
 *
 * A failed lookup answers false — the brand-wide board is always a safe fallback.
 */
export const areLeaguesActiveForBrand = async (brand: BrandValue, now: Date = new Date()): Promise<boolean> => {
    if (!areLeaguesEnabledForBrand(String(brand))) {
        return false;
    }
    const periodStart = getPreviousPeriodStart(now);
    const memo = leagueModeByBrand.get(String(brand));
    if (memo && memo.periodStart === periodStart) {
        return memo.isActive;
    }

    try {
        await closeElapsedLeaderboardPeriod(brand, now);
        const isActive = await Store.leaderboardPeriodResults.wasClosedWithLeagues(brand, periodStart);
        leagueModeByBrand.set(String(brand), { periodStart, isActive });
        return isActive;
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Leaderboard league mode lookup failed; using the brand-wide board'],
            traceArgs: { 'error.message': err?.message, 'pushNotification.brandVariation': String(brand) },
        });
        return false;
    }
};

/**
 * The league a user's weekly rank is measured in, or undefined while leagues are not active for
 * the brand (rank against the whole brand board, as before). The id is always a real league — a user
 * with no stored row is in the lowest one.
 */
export const getActiveLeagueForUser = async (
    brand: BrandValue,
    userId: string,
    now: Date = new Date(),
): Promise<string | undefined> => {
    if (!(await areLeaguesActiveForBrand(brand, now))) {
        return undefined;
    }
    const periodStart = getPreviousPeriodStart(now);
    const cacheKey = `${String(brand)}:${userId}`;
    const cached = leagueByUser.get(cacheKey);
    if (cached && cached.periodStart === periodStart) {
        return cached.league;
    }

    const stored = await Store.userLeaderboardLeagues.getLeagueForUser(brand, userId);
    const league = resolveLeaderboardLeague(String(brand), stored)?.id;
    if (leagueByUser.size >= LEAGUE_BY_USER_MAX_ENTRIES) {
        leagueByUser.clear();
    }
    leagueByUser.set(cacheKey, { periodStart, league });
    return league;
};
