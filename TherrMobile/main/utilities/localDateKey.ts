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
 * Use this whenever the Date was constructed from local fields. For "today as
 * the server counts it", keep using the UTC form — the users-service defines a
 * habit day in UTC (`getTodayDateString` in `utilities/streakHelpers.ts`).
 */
export const toLocalDateKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export default toLocalDateKey;
