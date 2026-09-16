const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Formats a Date as the YYYY-MM-DD key the habits API uses for `scheduledDate`,
 * reading the date's **local** calendar fields.
 *
 * Deliberately not `toISOString().split('T')[0]`. Calendar UI builds its cells
 * from local components (`new Date(year, monthIndex, day)`, `getDate()`), and
 * local midnight converts to the *previous* UTC day everywhere east of UTC — so
 * round-tripping through UTC keyed the cell labelled "6" as "...-05" for every
 * user in Europe, Asia and Australia. Checkins rendered a day early and the
 * "today" highlight landed on the wrong cell.
 *
 * Use this for **every** habit date, read and write, including "today". There
 * is no second, UTC-flavoured today to keep track of: a habit day is the user's
 * own calendar day, resolved from their zone (`resolveCheckinHabitDate` in the
 * users-service), and a client-sent date ahead of it is clamped back down.
 *
 * It was UTC once, and this comment used to carve out writes for that — which
 * is exactly how a 19:00 check-in came to be written under tomorrow's date and
 * drawn on tomorrow's cell, in the same file that explains why the grid cannot
 * use UTC.
 */
export const toLocalDateKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export default toLocalDateKey;
