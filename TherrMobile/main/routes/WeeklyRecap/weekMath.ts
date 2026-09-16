/**
 * Date arithmetic and formatting for the weekly recap screen.
 *
 * Split out of the screen for the same reason `pactState.ts` and `checkinDayDetail.ts` are:
 * these are the parts worth testing, and testing them should not mount a component.
 *
 * ## Everything here is string arithmetic in UTC
 *
 * A recap date is a YYYY-MM-DD key the server computed in the *user's* zone. Parsing one into
 * a local `Date` to add seven days re-interprets it in the device's zone, and `new Date('2026-09-07')`
 * is UTC midnight — which is the evening of Sep 6 anywhere west of UTC. Adding a week and
 * formatting locally then produces Sep 13, off by one, for roughly half the planet. So the keys
 * are only ever parsed with an explicit `T00:00:00.000Z` and only ever read back with the UTC
 * accessors; the device's zone never enters the arithmetic at all.
 *
 * This mirrors `addDays` / `daysBetween` in users-service `utilities/dailyStreak.ts`, which is
 * the code that produced these keys — the two must agree or the arrow buttons walk to a week
 * the server does not recognise as adjacent.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, '0');

const isDateKey = (value: unknown): value is string => typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value);

const toUtcDate = (dateKey: string): Date => new Date(`${dateKey.slice(0, 10)}T00:00:00.000Z`);

const fromUtcDate = (date: Date): string => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** Add (or subtract) whole days to a YYYY-MM-DD key. Returns the input unchanged if it is not one. */
export const addDaysToDateKey = (dateKey: string, days: number): string => {
    if (!isDateKey(dateKey)) {
        return dateKey;
    }
    return fromUtcDate(new Date(toUtcDate(dateKey).getTime() + (days * MS_PER_DAY)));
};

/** The Monday `offsetWeeks` away from this one. Negative goes back. */
export const shiftWeek = (weekStartDate: string, offsetWeeks: number): string => addDaysToDateKey(
    weekStartDate,
    offsetWeeks * 7,
);

const MONTH_KEYS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * "September 7 – 13" for a week inside one month, "September 28 – October 4" when it straddles
 * two.
 *
 * Month names come from the `dateTime.months` dictionary rather than `toLocaleDateString`,
 * because the app's locale is the user's account setting and need not match the device's — the
 * one is what every other string on this screen is translated with.
 */
export const formatWeekRange = (
    weekStartDate: string,
    weekEndDate: string,
    translate: (key: string, params?: any) => string,
): string => {
    if (!isDateKey(weekStartDate) || !isDateKey(weekEndDate)) {
        return '';
    }

    const start = toUtcDate(weekStartDate);
    const end = toUtcDate(weekEndDate);
    const startMonth = translate(`dateTime.months.${MONTH_KEYS[start.getUTCMonth()]}`);
    const endMonth = translate(`dateTime.months.${MONTH_KEYS[end.getUTCMonth()]}`);

    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
        return `${startMonth} ${start.getUTCDate()} – ${end.getUTCDate()}`;
    }

    return `${startMonth} ${start.getUTCDate()} – ${endMonth} ${end.getUTCDate()}`;
};

/**
 * The device's IANA zone, or undefined when the platform cannot name one.
 *
 * Sent as a fallback only: the server prefers the account's saved `settingsTimezone`, which is
 * written on push registration. A user who declined notifications has no saved zone, and
 * without this their week would be bucketed in the service's fallback zone instead of their own.
 */
export const getDeviceTimeZone = (): string | undefined => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
        // Older JSC builds without full ICU. Omitting the param is handled server-side.
        return undefined;
    }
};
