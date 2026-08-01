import { it, describe, expect } from '@jest/globals';
import { IPact } from 'therr-react/types';
import getPactTimeline from '../../main/utilities/pactTimeline';

/**
 * Fixture instants are built in **local** time, not from UTC ISO literals.
 *
 * `getPactTimeline` counts days off local calendar boundaries, and
 * `PactsStore.activate` stores `startDate` as the activation instant (a
 * `timestamptz`), not a UTC midnight. A hardcoded `...T00:00:00.000Z` start
 * therefore lands on the *previous* local date everywhere west of UTC, which
 * made these assertions pass in CI (UTC) and fail in the Americas.
 */
const localAt = (year: number, month: number, day: number, hour = 0) => new Date(year, month - 1, day, hour);
const at = (year: number, month: number, day: number, hour = 0) => localAt(year, month, day, hour).getTime();

const buildPact = (overrides: Partial<IPact> = {}): IPact => ({
    id: 'pact-1',
    creatorUserId: 'user-1',
    habitGoalId: 'goal-1',
    pactType: 'accountability',
    status: 'active',
    durationDays: 30,
    startDate: localAt(2026, 8, 1).toISOString(),
    endDate: localAt(2026, 8, 31).toISOString(),
    createdAt: localAt(2026, 7, 31).toISOString(),
    updatedAt: localAt(2026, 7, 31).toISOString(),
    ...overrides,
} as IPact);

describe('pactTimeline', () => {
    it('returns null when the pact has no run window yet', () => {
        expect(getPactTimeline(buildPact({ startDate: undefined, endDate: undefined }))).toBeNull();
        expect(getPactTimeline(buildPact({ endDate: undefined }))).toBeNull();
    });

    it('returns null for an unparseable or inverted window rather than dividing by zero', () => {
        expect(getPactTimeline(buildPact({ startDate: 'not-a-date' }))).toBeNull();
        expect(getPactTimeline(buildPact({
            startDate: '2026-08-31T00:00:00.000Z',
            endDate: '2026-08-01T00:00:00.000Z',
        }))).toBeNull();
    });

    it('reports day 1 with the full duration remaining on the start date', () => {
        const timeline = getPactTimeline(buildPact(), at(2026, 8, 1, 9));

        expect(timeline?.currentDay).toBe(1);
        expect(timeline?.totalDays).toBe(30);
        expect(timeline?.daysRemaining).toBe(30);
        expect(timeline?.hasStarted).toBe(true);
        expect(timeline?.hasEnded).toBe(false);
    });

    it('advances the day counter and the progress bar mid-pact', () => {
        const timeline = getPactTimeline(buildPact(), at(2026, 8, 16));

        expect(timeline?.currentDay).toBe(16);
        expect(timeline?.daysRemaining).toBe(15);
        expect(timeline?.progressPct).toBe(50);
    });

    // The screenshot case: a "30 day" pact whose stored window spans 31
    // calendar dates. The header advertises durationDays, so the day counter
    // must agree with it rather than with the inclusive date span.
    it('prefers durationDays over the raw date span for the total', () => {
        const timeline = getPactTimeline(buildPact({ durationDays: 30 }), at(2026, 8, 1));

        expect(timeline?.totalDays).toBe(30);
    });

    it('falls back to the date span when durationDays is missing', () => {
        const timeline = getPactTimeline(
            buildPact({ durationDays: 0 as any }),
            at(2026, 8, 1),
        );

        expect(timeline?.totalDays).toBe(30);
    });

    it('clamps a finished pact instead of reporting negative days or over 100%', () => {
        const timeline = getPactTimeline(buildPact(), at(2026, 9, 15));

        expect(timeline?.currentDay).toBe(30);
        expect(timeline?.daysRemaining).toBe(0);
        expect(timeline?.progressPct).toBe(100);
        expect(timeline?.hasEnded).toBe(true);
    });

    it('clamps a pact that has not started to day 1 and 0%', () => {
        const timeline = getPactTimeline(buildPact(), at(2026, 7, 20));

        expect(timeline?.currentDay).toBe(1);
        expect(timeline?.progressPct).toBe(0);
        expect(timeline?.hasStarted).toBe(false);
    });
});
