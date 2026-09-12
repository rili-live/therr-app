import {
    getFreezeConsumed,
    getStreakSavedByFreeze,
    streakFreezeRuleParams,
    STARTING_STREAK_FREEZES,
    MAX_STREAK_FREEZES,
} from '../../main/utilities/streakFreezes';

/**
 * The check-in toast announces a streak freeze only when the server says one
 * was spent. `graceDaysConsumed` and `streakSavedByFreeze` were added to the
 * `POST /habits/checkins` 201 after these screens shipped, so a client talking
 * to an older users-service gets neither field.
 *
 * The asymmetry is the point: staying quiet when a freeze *was* spent costs the
 * user one confirmation, while claiming one on a day nothing was saved tells
 * them the net caught them when it did not — which is exactly the trust the
 * mechanic depends on.
 */
describe('streak freeze reporting', () => {
    describe('getFreezeConsumed', () => {
        it('reports the count when the server sent one', () => {
            expect(getFreezeConsumed({ graceDaysConsumed: 1 })).toBe(1);
            expect(getFreezeConsumed({ graceDaysConsumed: 2 })).toBe(2);
        });

        it('treats a server that did not say as "no freeze spent"', () => {
            expect(getFreezeConsumed({})).toBe(0);
            expect(getFreezeConsumed(undefined)).toBe(0);
            expect(getFreezeConsumed(null)).toBe(0);
        });

        it('never reports a freeze from a zero, negative or unparseable value', () => {
            expect(getFreezeConsumed({ graceDaysConsumed: 0 })).toBe(0);
            expect(getFreezeConsumed({ graceDaysConsumed: -1 })).toBe(0);
            expect(getFreezeConsumed({ graceDaysConsumed: 'yes' })).toBe(0);
            expect(getFreezeConsumed({ graceDaysConsumed: NaN })).toBe(0);
        });
    });

    describe('getStreakSavedByFreeze', () => {
        it('reports the streak the freeze preserved', () => {
            expect(getStreakSavedByFreeze({ streakSavedByFreeze: 12 })).toBe(12);
        });

        it('falls back to 0 rather than rendering NaN or undefined in the copy', () => {
            expect(getStreakSavedByFreeze({})).toBe(0);
            expect(getStreakSavedByFreeze({ streakSavedByFreeze: null })).toBe(0);
            expect(getStreakSavedByFreeze(undefined)).toBe(0);
        });
    });

    describe('streakFreezeRuleParams', () => {
        it('states the allowance the backend actually grants', () => {
            // Mirrors users-service: StreaksStore seeds 1, habitCheckins grants
            // one per 7-day milestone, MAX_GRACE_PERIOD_DAYS caps at 3. If the
            // backend moves and this does not, the creation-time copy lies.
            expect(streakFreezeRuleParams).toEqual({ starting: 1, interval: 7, max: 3 });
            expect(STARTING_STREAK_FREEZES).toBeLessThanOrEqual(MAX_STREAK_FREEZES);
        });
    });
});
