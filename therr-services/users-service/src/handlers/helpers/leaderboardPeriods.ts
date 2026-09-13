import { BrandVariations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { BrandValue } from '../../store/BrandScopedStore';
import { IDBLeaderboardPeriodResult } from '../../store/LeaderboardPeriodResultsStore';
import { getLeaderboardPeriodEnd, getLeaderboardPeriodStart } from '../../utilities/leaderboardHelpers';

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

/** Test affordance: forget which periods this process has already closed. */
export const resetClosedPeriodMemo = () => closedPeriodByBrand.clear();

/**
 * Close the most recently elapsed period for a brand if it has not been closed yet: rank every
 * participant and write `main.leaderboardPeriodResults` (ties share a placement; league columns
 * NULL). Idempotent — the store's INSERT ... ON CONFLICT DO NOTHING means a scheduled close and a
 * lazy close from a client read cannot both write. Returns the number of rows written.
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
    const written = alreadyClosed ? 0 : await Store.leaderboardPeriodResults.closePeriod(brand, periodStart);
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
    /** Reserved for leagues; always null today. */
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
