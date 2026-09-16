import { it, describe, expect } from '@jest/globals';
import {
    addDaysToDateKey,
    formatWeekRange,
    shiftWeek,
} from '../../main/routes/WeeklyRecap/weekMath';

/**
 * The recap screen's date arithmetic.
 *
 * These keys are produced by users-service in the *user's* timezone and consumed here to move
 * between weeks. Parsing one into a local `Date` re-interprets it in the device's zone — and
 * `new Date('2026-09-07')` is UTC midnight, which is the evening of Sep 6 anywhere west of
 * UTC. So the assertions below matter most on a device that is not on UTC, which is exactly
 * the case a suite running in UTC cannot reproduce by accident: `weekMath` never touches the
 * local accessors, and these tests pin that by checking the string results rather than any
 * `Date`.
 *
 * If the arrows ever walked to a week the server does not recognise as adjacent, it would show
 * up as a recap screen that silently re-renders the same week.
 */

const translate = (key: string): string => {
    const month = key.split('.').pop() || '';
    return month.charAt(0).toUpperCase() + month.slice(1);
};

describe('weeklyRecap weekMath', () => {
    describe('addDaysToDateKey', () => {
        it('adds and subtracts whole days', () => {
            expect(addDaysToDateKey('2026-09-07', 6)).toBe('2026-09-13');
            expect(addDaysToDateKey('2026-09-07', -1)).toBe('2026-09-06');
        });

        it('crosses month and year boundaries', () => {
            expect(addDaysToDateKey('2026-09-28', 7)).toBe('2026-10-05');
            expect(addDaysToDateKey('2026-12-28', 7)).toBe('2027-01-04');
            expect(addDaysToDateKey('2027-01-04', -7)).toBe('2026-12-28');
        });

        it('crosses a DST boundary without losing or gaining a day', () => {
            // US DST ends 2026-11-01. A local-Date implementation lands on Oct 31 here.
            expect(addDaysToDateKey('2026-10-26', 7)).toBe('2026-11-02');
            // And begins 2026-03-08.
            expect(addDaysToDateKey('2026-03-02', 7)).toBe('2026-03-09');
        });

        it('leaves a value that is not a date key alone rather than producing NaN', () => {
            expect(addDaysToDateKey('', 7)).toBe('');
            expect(addDaysToDateKey('not-a-date', 7)).toBe('not-a-date');
        });
    });

    describe('shiftWeek', () => {
        it('moves a whole week in either direction', () => {
            expect(shiftWeek('2026-09-07', -1)).toBe('2026-08-31');
            expect(shiftWeek('2026-09-07', 1)).toBe('2026-09-14');
            expect(shiftWeek('2026-09-07', 0)).toBe('2026-09-07');
        });

        it('stays on Mondays across a year boundary', () => {
            expect(shiftWeek('2027-01-04', -1)).toBe('2026-12-28');
        });
    });

    describe('formatWeekRange', () => {
        it('names the month once when the week sits inside it', () => {
            expect(formatWeekRange('2026-09-07', '2026-09-13', translate)).toBe('September 7 – 13');
        });

        it('names both months when the week straddles two', () => {
            expect(formatWeekRange('2026-09-28', '2026-10-04', translate)).toBe('September 28 – October 4');
        });

        it('names both months across a year boundary', () => {
            expect(formatWeekRange('2026-12-28', '2027-01-03', translate)).toBe('December 28 – January 3');
        });

        it('renders nothing rather than "Invalid Date" for a malformed range', () => {
            expect(formatWeekRange('', '2026-09-13', translate)).toBe('');
            expect(formatWeekRange('2026-09-07', 'nope', translate)).toBe('');
        });
    });
});
