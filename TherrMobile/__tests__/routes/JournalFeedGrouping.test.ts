import { it, describe, expect } from '@jest/globals';
import {
    formatEntryTime,
    getMonthKey,
    getWeekdayKey,
    groupFeedByDay,
    toLocalEntryDate,
} from '../../main/routes/Journal/journalGrouping';

/**
 * Journal day-grouping.
 *
 * The screenshot this feature was built from groups entries under one date
 * block per day, with a month heading above the first day of each month. The
 * risk worth testing is dates: `new Date('2026-08-14')` parses as UTC midnight
 * and reads back as the 13th anywhere west of Greenwich, which would file
 * entries under the wrong day for a large share of users and only for part of
 * the day. `.mocharc`-style TZ pinning does not apply to Jest here, so these
 * assert the parsing directly.
 */
const item = (id: string, entryDate: string, occurredAt?: string): any => ({
    id,
    type: 'note',
    entryDate,
    occurredAt: occurredAt || `${entryDate}T12:00:00.000Z`,
    body: `body ${id}`,
});

// Stands in for the translator; returns the key so assertions can see which
// dictionary entry would be rendered.
const translate = (key: string) => key;

describe('journal date parsing', () => {
    it('reads the calendar day from a YYYY-MM-DD string without a UTC shift', () => {
        expect(getMonthKey('2026-08-14')).toBe('august');
        expect(getWeekdayKey('2026-08-14')).toBe('fri');
    });

    it('handles the first of a month, where an off-by-one would cross into the previous one', () => {
        expect(getMonthKey('2026-03-01')).toBe('march');
    });

    it('handles the first of January, where an off-by-one would cross the year', () => {
        expect(getMonthKey('2026-01-01')).toBe('january');
    });
});

describe('groupFeedByDay', () => {
    it('returns nothing for an empty feed', () => {
        expect(groupFeedByDay([], translate)).toEqual([]);
    });

    it('collapses entries from the same day into one section', () => {
        const sections = groupFeedByDay([
            item('a', '2026-03-11'),
            item('b', '2026-03-11'),
            item('c', '2026-03-11'),
        ], translate);

        expect(sections).toHaveLength(1);
        expect(sections[0].data.map((i: any) => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('starts a new section on each new day, preserving feed order', () => {
        const sections = groupFeedByDay([
            item('a', '2026-03-11'),
            item('b', '2026-03-08'),
        ], translate);

        expect(sections.map((s) => s.entryDate)).toEqual(['2026-03-11', '2026-03-08']);
        expect(sections[0].dayOfMonth).toBe('11');
        expect(sections[1].dayOfMonth).toBe('8');
    });

    it('flags only the first section of each month so the heading renders once', () => {
        const sections = groupFeedByDay([
            item('a', '2026-03-11'),
            item('b', '2026-03-08'),
            item('c', '2026-02-27'),
        ], translate);

        expect(sections.map((s) => s.isFirstOfMonth)).toEqual([true, false, true]);
    });

    it('renders a heading for the same month in a different year', () => {
        // Reachable from a correctly-sorted feed: a journal older than a year
        // eventually puts August 2025 directly below August 2026. Comparing
        // month *names* alone suppressed the second heading, filing a year of
        // entries under the wrong visible month.
        const sections = groupFeedByDay([
            item('a', '2026-08-14'),
            item('b', '2025-08-30'),
        ], translate);

        expect(sections.map((s) => s.isFirstOfMonth)).toEqual([true, true]);
    });

    it('re-flags a month that the feed returns to after leaving it', () => {
        // Not reachable from a correctly-sorted feed, but the guard is cheap
        // and the alternative — a silently missing heading — is invisible.
        const sections = groupFeedByDay([
            item('a', '2026-03-11'),
            item('b', '2026-02-27'),
            item('c', '2026-03-02'),
        ], translate);

        expect(sections.map((s) => s.isFirstOfMonth)).toEqual([true, true, true]);
    });

    it('routes month and weekday labels through the translator', () => {
        const sections = groupFeedByDay([item('a', '2026-03-11')], translate);

        expect(sections[0].monthLabel).toBe('dateTime.months.march');
        expect(sections[0].weekdayLabel).toBe('pages.habits.daysOfWeekShort.wed');
    });

    it('marks only the section matching the day passed as today', () => {
        const sections = groupFeedByDay([
            item('a', '2026-03-11'),
            item('b', '2026-03-10'),
        ], translate, '2026-03-11');

        expect(sections.map((s) => s.isToday)).toEqual([true, false]);
    });

    it('marks nothing when the caller passes no today', () => {
        // A journal that highlights no day is merely plain; one that highlights
        // the wrong day tells the user they logged something they did not.
        const sections = groupFeedByDay([item('a', '2026-03-11')], translate);

        expect(sections[0].isToday).toBe(false);
    });

    it('keeps mixed item types in one day together', () => {
        const sections = groupFeedByDay([
            { ...item('a', '2026-03-11'), type: 'checkin' },
            { ...item('b', '2026-03-11'), type: 'achievement' },
        ], translate);

        expect(sections).toHaveLength(1);
        expect(sections[0].data.map((i: any) => i.type)).toEqual(['checkin', 'achievement']);
    });
});

describe('toLocalEntryDate', () => {
    it('reads the device calendar day, not the UTC one', () => {
        // 23:40 local on the 14th. `toISOString().split("T")[0]` would file this
        // under the 15th anywhere east of Greenwich — the exact off-by-one that
        // `parseEntryDate` exists to prevent in the other direction, and the one
        // that would highlight tomorrow as "today".
        expect(toLocalEntryDate(new Date(2026, 7, 14, 23, 40))).toBe('2026-08-14');
    });

    it('zero-pads so the string sorts and compares as YYYY-MM-DD', () => {
        expect(toLocalEntryDate(new Date(2026, 0, 2))).toBe('2026-01-02');
    });
});

describe('formatEntryTime', () => {
    it('returns an empty string rather than "Invalid Date" for a bad timestamp', () => {
        expect(formatEntryTime('not-a-timestamp', 'en-us')).toBe('');
    });

    it('formats a valid instant as a 24-hour clock time', () => {
        expect(formatEntryTime('2026-03-11T21:14:00.000Z', 'en-us')).toMatch(/^\d{2}:\d{2}$/);
    });
});
