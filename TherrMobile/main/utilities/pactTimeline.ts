import { IPact } from 'therr-react/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface IPactTimeline {
    /** Total days the pact runs for. */
    totalDays: number;
    /** 1-based day the pact is on today, clamped to [1, totalDays]. */
    currentDay: number;
    /** Whole days left before `endDate`, never negative. */
    daysRemaining: number;
    /** Elapsed share of the window, 0-100. */
    progressPct: number;
    hasStarted: boolean;
    hasEnded: boolean;
}

const startOfLocalDay = (date: Date): number => new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
).getTime();

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Derives "day X of Y" / "N days left" / progress for a pact's run window.
 *
 * `daysRemaining` and `progressPct` mirror `getDaysRemaining` and
 * `getPactProgress` in the users-service (`src/utilities/pactHelpers.ts`) so the
 * detail screen never contradicts a server-rendered figure. `totalDays` prefers
 * `durationDays` — it is what the pact header already advertises — and falls
 * back to the start/end span for legacy pacts written without it.
 *
 * Returns null when the pact has no run window yet (i.e. still a pending invite).
 */
const getPactTimeline = (pact: IPact, now: number = Date.now()): IPactTimeline | null => {
    if (!pact?.startDate || !pact?.endDate) {
        return null;
    }

    const startMs = new Date(pact.startDate).getTime();
    const endMs = new Date(pact.endDate).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return null;
    }

    const spanDays = Math.max(1, Math.round((startOfLocalDay(new Date(endMs)) - startOfLocalDay(new Date(startMs))) / MS_PER_DAY));
    const totalDays = pact.durationDays > 0 ? pact.durationDays : spanDays;

    const elapsedDays = Math.floor((startOfLocalDay(new Date(now)) - startOfLocalDay(new Date(startMs))) / MS_PER_DAY);

    return {
        totalDays,
        currentDay: clamp(elapsedDays + 1, 1, totalDays),
        daysRemaining: Math.max(0, Math.ceil((endMs - now) / MS_PER_DAY)),
        progressPct: clamp(Math.round(((now - startMs) / (endMs - startMs)) * 100), 0, 100),
        hasStarted: now >= startMs,
        hasEnded: now > endMs,
    };
};

export default getPactTimeline;

export {
    getPactTimeline,
};
