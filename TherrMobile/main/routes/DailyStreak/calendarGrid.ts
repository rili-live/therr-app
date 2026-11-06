import type { DailyStreakCalendarDayStatus, IDailyStreakCalendarDay } from 'therr-react/services';

/**
 * Pure layout rules for the daily streak month calendar. Kept out of the component so the band
 * logic — the part that is easy to get subtly wrong — is unit-tested without rendering.
 *
 * Dates are YYYY-MM-DD strings in the user's local day, exactly as the server sent them. Nothing
 * here builds a `Date` in the device zone: the server already decided which local day each entry
 * is, and re-deriving it would disagree with it for a user whose saved timezone is not the
 * device's.
 */

export interface ICalendarCell {
    day: IDailyStreakCalendarDay;
    /** 1–31. */
    dayOfMonth: number;
    /** Draw the streak band from this cell's centre to its left edge. */
    bandLeft: boolean;
    /** Draw the streak band from this cell's centre to its right edge. */
    bandRight: boolean;
}

/** `null` is a padding cell before the 1st or after the last day. Every row has 7 entries. */
export type CalendarRow = Array<ICalendarCell | null>;

const KEPT_STATUSES: DailyStreakCalendarDayStatus[] = ['upheld', 'frozen'];

const isKept = (status: DailyStreakCalendarDayStatus) => KEPT_STATUSES.includes(status);

/**
 * Which days belong to a run of the streak: every upheld or frozen day, plus a rest day that sits
 * between two of them (a rest day neither breaks nor extends the streak, so a band that broke on
 * it would draw a reset that never happened). A rest day at either end of a run is left out — it
 * is not bracketed by the streak, so there is nothing to connect it to.
 */
export const getRunMembership = (days: IDailyStreakCalendarDay[]): boolean[] => {
    const statuses = days.map((day) => day.status);
    return statuses.map((status, index) => {
        if (isKept(status)) {
            return true;
        }
        if (status !== 'rest') {
            return false;
        }
        let before = index - 1;
        while (before >= 0 && statuses[before] === 'rest') {
            before -= 1;
        }
        let after = index + 1;
        while (after < statuses.length && statuses[after] === 'rest') {
            after += 1;
        }
        return before >= 0 && after < statuses.length && isKept(statuses[before]) && isKept(statuses[after]);
    });
};

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD date. UTC so the device zone cannot shift it. */
export const getDayOfWeek = (date: string): number => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

/**
 * Sunday-first week rows, matching the per-habit calendar on the habit detail screen. Bands do
 * not cross a row break: a run that wraps from Saturday to Sunday ends on one row and starts
 * again on the next, as a printed calendar would draw it.
 */
export const buildCalendarRows = (days: IDailyStreakCalendarDay[]): CalendarRow[] => {
    if (!days.length) {
        return [];
    }
    const inRun = getRunMembership(days);
    const leading = getDayOfWeek(days[0].date);
    const cells: Array<ICalendarCell | null> = Array.from({ length: leading }, () => null);

    days.forEach((day, index) => {
        const column = (leading + index) % 7;
        cells.push({
            day,
            dayOfMonth: Number(day.date.slice(8, 10)),
            bandLeft: inRun[index] && index > 0 && inRun[index - 1] && column > 0,
            bandRight: inRun[index] && index < days.length - 1 && inRun[index + 1] && column < 6,
        });
    });

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    const rows: CalendarRow[] = [];
    for (let start = 0; start < cells.length; start += 7) {
        rows.push(cells.slice(start, start + 7));
    }
    return rows;
};

/** YYYY-MM shifted by whole months. */
export const shiftMonth = (month: string, offset: number): string => {
    const [year, monthNumber] = month.split('-').map(Number);
    const zeroBased = (year * 12) + (monthNumber - 1) + offset;
    const nextYear = Math.floor(zeroBased / 12);
    const nextMonth = (zeroBased % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
};

export const MONTH_KEYS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

/** 0-based month index of a YYYY-MM string. */
export const getMonthIndex = (month: string): number => Number(month.slice(5, 7)) - 1;

export const getYear = (month: string): number => Number(month.slice(0, 4));
