import { it, describe, expect } from '@jest/globals';
import { toLocalDateKey } from '../../main/utilities/localDateKey';

/**
 * `toLocalDateKey` exists because the habits calendar builds its grid from local
 * calendar fields but used to key each cell with `toISOString().split('T')[0]`.
 * Local midnight is the *previous* UTC day everywhere east of UTC, so the cell
 * labelled "6" was keyed "...-05" for every user in Europe, Asia and Australia:
 * checkins rendered a day early and the "today" highlight sat on the wrong cell.
 *
 * The divergence these tests guard cannot be reproduced with a real Date on a
 * UTC runner — where CI runs, local and UTC always agree — and Node caches the
 * process timezone after the first Date, so reassigning `process.env.TZ` inside
 * a Jest worker is a no-op. The regression case therefore uses a date-like stub
 * whose UTC day is deliberately a day behind its local fields, which fails
 * against the old implementation in *every* timezone rather than only in some.
 */
const dateLike = (
    { year, month, day, isoDay }: { year: number; month: number; day: number; isoDay: string },
): Date => ({
    getFullYear: () => year,
    getMonth: () => month - 1,
    getDate: () => day,
    toISOString: () => `${isoDay}T15:00:00.000Z`,
} as unknown as Date);

describe('toLocalDateKey', () => {
    it('round-trips the local calendar fields it was built from', () => {
        expect(toLocalDateKey(new Date(2026, 7, 6))).toBe('2026-08-06');
    });

    it('keys by the local day, not the UTC day, when the two differ', () => {
        // Midnight on the 6th in Tokyo is 2026-08-05T15:00Z. The cell renders "6",
        // so its key must be the 6th — toISOString() returned the 5th here.
        const sixthOfAugustInTokyo = dateLike({
            year: 2026, month: 8, day: 6, isoDay: '2026-08-05',
        });

        expect(toLocalDateKey(sixthOfAugustInTokyo)).toBe('2026-08-06');
    });

    it('keys the last day of a month by its local day, so a month range does not drop it', () => {
        // HabitDetail.getDateRange builds this as its endDate. Under toISOString()
        // it collapsed to 2026-08-30 and the fetch window lost the 31st.
        const lastDayOfAugustInSydney = dateLike({
            year: 2026, month: 8, day: 31, isoDay: '2026-08-30',
        });

        expect(toLocalDateKey(lastDayOfAugustInSydney)).toBe('2026-08-31');
    });

    it('derives the last day of a month from a real local Date', () => {
        expect(toLocalDateKey(new Date(2026, 8, 0))).toBe('2026-08-31');
    });

    it('zero-pads single-digit months and days', () => {
        expect(toLocalDateKey(new Date(2026, 0, 9))).toBe('2026-01-09');
    });
});
