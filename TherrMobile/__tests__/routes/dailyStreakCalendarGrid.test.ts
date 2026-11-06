import { it, describe, expect } from '@jest/globals';
import {
    buildCalendarRows,
    getDayOfWeek,
    getRunMembership,
    shiftMonth,
} from '../../main/routes/DailyStreak/calendarGrid';

type Status = 'upheld' | 'frozen' | 'missed' | 'rest' | 'pending' | 'future' | 'none';

const monthOf = (startDate: string, statuses: Status[]) => {
    const [year, month] = startDate.split('-').map(Number);
    return statuses.map((status, index) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
        return { date, status, isToday: status === 'pending' };
    });
};

/**
 * The daily streak calendar's layout. The band is what draws the run, so a band that bridged a
 * miss (or broke on a rest day) would show the user a streak they do not have (or a reset that
 * never happened).
 */
describe('daily streak calendar grid', () => {
    describe('getRunMembership', () => {
        it('includes upheld and frozen days, excludes misses', () => {
            const days = monthOf('2026-11-01', ['upheld', 'frozen', 'upheld', 'missed', 'upheld']);
            expect(getRunMembership(days)).toEqual([true, true, true, false, true]);
        });

        it('bridges a rest day only between two kept days', () => {
            const days = monthOf('2026-11-01', ['upheld', 'rest', 'rest', 'upheld', 'rest', 'missed', 'rest']);
            expect(getRunMembership(days)).toEqual([true, true, true, true, false, false, false]);
        });

        it('never bands untracked, pending or future days', () => {
            const days = monthOf('2026-11-01', ['none', 'upheld', 'pending', 'future']);
            expect(getRunMembership(days)).toEqual([false, true, false, false]);
        });
    });

    describe('buildCalendarRows', () => {
        it('pads to a Sunday-first grid of full weeks', () => {
            // November 2026 starts on a Sunday and has 30 days → 5 rows, no leading padding.
            const days = monthOf('2026-11-01', Array.from({ length: 30 }, () => 'future' as Status));
            const rows = buildCalendarRows(days);
            expect(rows).toHaveLength(5);
            expect(rows.every((row) => row.length === 7)).toBe(true);
            expect(rows[0][0]?.dayOfMonth).toBe(1);
            expect(rows[4].filter((cell) => cell === null)).toHaveLength(5);
        });

        it('offsets the first day by its weekday', () => {
            // October 2026 starts on a Thursday.
            const days = monthOf('2026-10-01', Array.from({ length: 31 }, () => 'none' as Status));
            const rows = buildCalendarRows(days);
            expect(rows[0].slice(0, 4)).toEqual([null, null, null, null]);
            expect(rows[0][4]?.dayOfMonth).toBe(1);
        });

        it('connects neighbours in a run and stops at its ends and at row breaks', () => {
            // Nov 1 (Sun) .. Nov 9 (Mon): a run from the 5th to the 9th crosses the Sat→Sun break.
            const days = monthOf('2026-11-01', [
                'upheld', 'missed', 'none', 'none', 'upheld', 'frozen', 'upheld', 'upheld', 'upheld',
            ]);
            const cells = buildCalendarRows(days).flat().filter(Boolean) as any[];
            expect(cells[0]).toMatchObject({ bandLeft: false, bandRight: false });
            expect(cells[4]).toMatchObject({ bandLeft: false, bandRight: true });
            expect(cells[5]).toMatchObject({ bandLeft: true, bandRight: true });
            // The 7th is a Saturday: the band ends at the row's edge...
            expect(cells[6]).toMatchObject({ bandLeft: true, bandRight: false });
            // ...and the 8th (Sunday) picks it up on the next row with no left half.
            expect(cells[7]).toMatchObject({ bandLeft: false, bandRight: true });
            expect(cells[8]).toMatchObject({ bandLeft: true, bandRight: false });
        });

        it('returns no rows for no days', () => {
            expect(buildCalendarRows([])).toEqual([]);
        });
    });

    describe('date helpers', () => {
        it('reads weekdays without the device timezone', () => {
            expect(getDayOfWeek('2026-11-01')).toBe(0);
            expect(getDayOfWeek('2026-11-06')).toBe(5);
        });

        it('shifts months across year boundaries', () => {
            expect(shiftMonth('2026-11', -1)).toBe('2026-10');
            expect(shiftMonth('2026-01', -1)).toBe('2025-12');
            expect(shiftMonth('2026-12', 1)).toBe('2027-01');
            expect(shiftMonth('2026-11', -13)).toBe('2025-10');
        });
    });
});
