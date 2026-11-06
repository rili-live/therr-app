import { expect } from 'chai';
import { shouldNudgeToday } from '../../src/utilities/streakHelpers';

/**
 * `shouldNudgeToday` — the gate that keeps the daily reminder from becoming spam.
 *
 * A habit app that nudges a 3x/week habit seven days a week teaches its users
 * that reminders are noise, which
 * docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md lists as an anti-pattern that
 * *costs* DAU rather than lifting it. Everything here is about not doing that,
 * while still reaching a habit nobody has started yet.
 *
 * This replaced `isHabitDueToday`, which asked "has enough time passed since the last
 * completion" — a spacing heuristic, `floor(7 / N)`. It had two failures this suite now pins
 * the absence of: it collapsed 4x, 5x, 6x and 7x per week to "every day", and it kept nudging
 * after the week's target was already met, because a gap since the last check-in says nothing
 * about whether the week is done.
 */

// A Wednesday, chosen so the weekday assertions read plainly. getUTCDay() === 3.
// 2026-08-24 is that week's Monday, so Wednesday has 5 days left in the week.
const WEDNESDAY = '2026-08-26';
const MONDAY = '2026-08-24';
const THURSDAY = '2026-08-27';
const SATURDAY = '2026-08-29';

describe('shouldNudgeToday', () => {
    it('nudges every day for a daily habit that has not been done today', () => {
        expect(shouldNudgeToday({ frequencyType: 'daily' }, WEDNESDAY)).to.equal(true);
        expect(shouldNudgeToday({ frequencyType: 'daily' }, SATURDAY)).to.equal(true);
    });

    it('honours an explicit weekday schedule over frequencyType', () => {
        expect(shouldNudgeToday({ frequencyType: 'daily', targetDaysOfWeek: [1, 3, 5] }, WEDNESDAY)).to.equal(true);
        expect(shouldNudgeToday({ frequencyType: 'daily', targetDaysOfWeek: [1, 5] }, WEDNESDAY)).to.equal(false);
    });

    it('reads the weekday in UTC, matching getTodayDateString', () => {
        // Parsed locally, `new Date('2026-08-26')` lands on Tuesday evening for
        // any host west of UTC and the whole schedule shifts a day — the same
        // hazard habitLifecycleContext.shiftDate documents.
        expect(shouldNudgeToday({ targetDaysOfWeek: [3] }, WEDNESDAY)).to.equal(true);
        expect(shouldNudgeToday({ targetDaysOfWeek: [2] }, WEDNESDAY)).to.equal(false);
    });

    it('leaves a flexible habit alone while the week has room to spare', () => {
        // The point of a 3x/week habit is that most days are optional. Nudging it every morning
        // from Monday is a reminder the user can safely ignore four times — which teaches them
        // to ignore the fifth, the one that matters.
        const threePerWeek = { frequencyType: 'weekly', frequencyCount: 3 };

        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 0 }, MONDAY)).to.equal(false);
        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 1 }, WEDNESDAY)).to.equal(false);
        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 2 }, WEDNESDAY)).to.equal(false);
    });

    it('starts nudging once skipping today and tomorrow would cost the week', () => {
        const threePerWeek = { frequencyType: 'weekly', frequencyCount: 3 };

        // Thursday, nothing done: 4 days left against 3 owed — one spare day.
        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 0 }, THURSDAY)).to.equal(true);
        // Saturday, 2 done: 2 days left against 1 owed — one spare day.
        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 2 }, SATURDAY)).to.equal(true);
    });

    it('goes quiet for the rest of the week once the target is met', () => {
        // The substance of the change. The old spacing rule would still have nudged here on any
        // day two or more after the last check-in, however much of the week was already done.
        const threePerWeek = { frequencyType: 'weekly', frequencyCount: 3 };

        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 3 }, WEDNESDAY)).to.equal(false);
        expect(shouldNudgeToday({ ...threePerWeek, completionsEarlierThisWeek: 3 }, SATURDAY)).to.equal(false);
    });

    it('does not collapse 4x-per-week into daily', () => {
        // `floor(7 / 4)` is 1, so the old interval rule made this — and 5x, 6x and 7x — due
        // every single day regardless of progress.
        const fourPerWeek = { frequencyType: 'weekly', frequencyCount: 4 };

        expect(shouldNudgeToday({ ...fourPerWeek, completionsEarlierThisWeek: 4 }, SATURDAY)).to.equal(false);
    });

    it('nudges a habit that has never been completed once its week starts to slip', () => {
        // A habit someone set up and never started is who a reminder is for — but on the day it
        // matters, not every day before it.
        expect(shouldNudgeToday({ frequencyType: 'weekly', frequencyCount: 2 }, WEDNESDAY)).to.equal(false);
        expect(shouldNudgeToday({ frequencyType: 'weekly', frequencyCount: 2 }, SATURDAY)).to.equal(true);
    });

    it('degrades a malformed frequencyCount to once a week rather than dividing by zero', () => {
        expect(shouldNudgeToday(
            { frequencyType: 'weekly', frequencyCount: 0, completionsEarlierThisWeek: 1 },
            WEDNESDAY,
        )).to.equal(false);
        expect(shouldNudgeToday(
            { frequencyType: 'weekly', frequencyCount: 0, completionsEarlierThisWeek: 0 },
            SATURDAY,
        )).to.equal(true);
    });

    it('stays silent on a date it cannot identify rather than risking spam', () => {
        expect(shouldNudgeToday({ frequencyType: 'daily' }, 'not-a-date')).to.equal(false);
    });
});
