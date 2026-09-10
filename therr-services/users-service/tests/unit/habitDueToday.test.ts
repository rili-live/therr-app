import { expect } from 'chai';
import { isHabitDueToday } from '../../src/utilities/streakHelpers';

/**
 * `isHabitDueToday` — the gate that keeps the daily reminder from becoming spam.
 *
 * A habit app that nudges a 3x/week habit seven days a week teaches its users
 * that reminders are noise, which
 * docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md lists as an anti-pattern that
 * *costs* DAU rather than lifting it. Everything here is about not doing that,
 * while still reaching a habit nobody has started yet.
 */

// A Wednesday, chosen so the weekday assertions read plainly. getUTCDay() === 3.
const WEDNESDAY = '2026-08-26';

describe('isHabitDueToday', () => {
    it('is due every day for a daily habit', () => {
        expect(isHabitDueToday({ frequencyType: 'daily' }, WEDNESDAY)).to.equal(true);
    });

    it('honours an explicit weekday schedule over frequencyType', () => {
        expect(isHabitDueToday({ frequencyType: 'daily', targetDaysOfWeek: [1, 3, 5] }, WEDNESDAY)).to.equal(true);
        expect(isHabitDueToday({ frequencyType: 'daily', targetDaysOfWeek: [1, 5] }, WEDNESDAY)).to.equal(false);
    });

    it('reads the weekday in UTC, matching getTodayDateString', () => {
        // Parsed locally, `new Date('2026-08-26')` lands on Tuesday evening for
        // any host west of UTC and the whole schedule shifts a day — the same
        // hazard habitLifecycleContext.shiftDate documents.
        expect(new Date(`${WEDNESDAY}T00:00:00.000Z`).getUTCDay()).to.equal(3);
        expect(isHabitDueToday({ targetDaysOfWeek: [3] }, WEDNESDAY)).to.equal(true);
        expect(isHabitDueToday({ targetDaysOfWeek: [2] }, WEDNESDAY)).to.equal(false);
    });

    it('is due for a flexible habit nobody has ever completed', () => {
        // The permissive branch on purpose: a habit someone set up and never
        // started is precisely who a reminder is for.
        expect(isHabitDueToday(
            { frequencyType: 'weekly', frequencyCount: 3, lastCompletedDate: null },
            WEDNESDAY,
        )).to.equal(true);
    });

    it('spaces a flexible habit by its own cadence instead of nudging daily', () => {
        // 3x/week -> due roughly every other day.
        const habit = { frequencyType: 'weekly', frequencyCount: 3 };

        expect(isHabitDueToday({ ...habit, lastCompletedDate: '2026-08-25' }, WEDNESDAY)).to.equal(false);
        expect(isHabitDueToday({ ...habit, lastCompletedDate: '2026-08-24' }, WEDNESDAY)).to.equal(true);
    });

    it('treats a once-a-week habit as due only after a full week', () => {
        const habit = { frequencyType: 'weekly', frequencyCount: 1 };

        expect(isHabitDueToday({ ...habit, lastCompletedDate: '2026-08-21' }, WEDNESDAY)).to.equal(false);
        expect(isHabitDueToday({ ...habit, lastCompletedDate: '2026-08-19' }, WEDNESDAY)).to.equal(true);
    });

    it('degrades a malformed frequencyCount to weekly rather than dividing by zero', () => {
        // Unclamped, 0 makes the interval infinite and the habit is never
        // reminded again — silent, and indistinguishable from "working". Clamped
        // to 1/week it errs quiet, which is the right direction to err for a
        // notification.
        const bad = { frequencyType: 'weekly', frequencyCount: 0 };

        expect(isHabitDueToday({ ...bad, lastCompletedDate: '2026-08-25' }, WEDNESDAY)).to.equal(false);
        expect(isHabitDueToday({ ...bad, lastCompletedDate: '2026-08-01' }, WEDNESDAY)).to.equal(true);
    });

    it('stays silent on a date it cannot parse', () => {
        expect(isHabitDueToday({ frequencyType: 'daily' }, 'not-a-date')).to.equal(false);
    });
});
