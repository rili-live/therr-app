const MONTH_KEYS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * A full calendar date ("September 15, 2026") built from the locale dictionary
 * rather than `toLocaleDateString`.
 *
 * Two things `toLocaleDateString()` gets wrong here, and the second is the one
 * that actually reaches users:
 *
 *   - Called with no locale tag it uses the **device's** locale, not the app's.
 *     A user who set the app to Spanish on an English phone read English dates
 *     under Spanish headings.
 *   - Called with the right tag it still is not reliable: Hermes on Android is
 *     not guaranteed to carry ICU data for every locale this app ships, so
 *     `toLocaleDateString('fr-ca', …)` can silently fall back to English.
 *
 * `formatDayTitle` in routes/Habits/checkinDayDetail.ts resolves month and
 * weekday names the same way, and for the same reasons; this is the variant
 * without a weekday, for date ranges.
 *
 * Ordering is the dictionary's, not this function's — `dateTime.monthDayYear`
 * is "{month} {day}, {year}" in en-us and "{day} de {month} de {year}" in es,
 * which is the whole reason the format string is a translated key rather than
 * a template literal here.
 *
 * Pass a `Date` (or anything `new Date()` accepts). The **local** calendar
 * fields are read, so an instant is rendered as the day the user was living in
 * when it happened. Returns an empty string for an unparseable value rather
 * than "Invalid Date".
 */
export const formatCalendarDate = (
    value: Date | string | number | null | undefined,
    translate: (key: string, params?: any) => string,
): string => {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return translate('dateTime.monthDayYear', {
        month: translate(`dateTime.months.${MONTH_KEYS[date.getMonth()]}`),
        day: date.getDate(),
        year: date.getFullYear(),
    });
};

export default formatCalendarDate;
