import { expect } from 'chai';
import {
    assembleWeeklyRecap,
    buildRecapDays,
    getRecapWeekStart,
    isPerfectRecapWeek,
    isRecapDay,
    pickWeeklyRecapHeadline,
    rankRecapHabits,
    resolveRequestedWeekStart,
    sumRecapTotals,
    weeklyRecapDedupeKey,
    EMPTY_WEEKLY_RECAP_TOTALS,
    IWeeklyRecapDay,
    IWeeklyRecapHabit,
    WeeklyRecapDayStatus,
} from '../../src/utilities/weeklyRecap';

/**
 * The weekly recap rules, pinned.
 *
 * Everything here is pure — a week is a pair of date strings and a map, never "now" — because
 * the cases that actually break (the week either side of a year boundary, a user whose Monday
 * is not the server's, a first week with nothing before it) are only reachable in a test if
 * the dates are arguments. The suite is pinned to UTC by .mocharc.js, which is the condition
 * under which a UTC-vs-local bug hides rather than fails.
 */

// 2026-09-07 is a Monday; 2026-09-13 the Sunday that closes its week.
const WEEK_START = '2026-09-07';
const PREVIOUS_WEEK_START = '2026-08-31';

const statuses = (entries: [string, WeeklyRecapDayStatus][]) => new Map<string, WeeklyRecapDayStatus>(entries);
const counts = (entries: [string, number][]) => new Map<string, number>(entries);

const fullWeek = (status: WeeklyRecapDayStatus, checkinsPerDay = 1) => {
    const statusEntries: [string, WeeklyRecapDayStatus][] = [];
    const countEntries: [string, number][] = [];
    for (let i = 0; i < 7; i += 1) {
        const date = `2026-09-${String(7 + i).padStart(2, '0')}`;
        statusEntries.push([date, status]);
        countEntries.push([date, checkinsPerDay]);
    }
    return { statusByDate: statuses(statusEntries), checkinCountByDate: counts(countEntries) };
};

describe('weeklyRecap — week selection', () => {
    it('recaps the week that just closed, not the week in progress', () => {
        // Decided on Monday 2026-09-14 → the recap is about 2026-09-07..13.
        expect(getRecapWeekStart('2026-09-14')).to.equal(WEEK_START);
    });

    it('resolves to the same week on any day of the deciding week', () => {
        // This is what makes the dedupe key safe to compute on a re-run: a digest that fires
        // again on Wednesday must land on the key Monday's run already inserted.
        ['2026-09-14', '2026-09-16', '2026-09-20'].forEach((day) => {
            expect(getRecapWeekStart(day), day).to.equal(WEEK_START);
        });
    });

    it('treats only the user\'s local Monday as a recap day', () => {
        expect(isRecapDay('2026-09-14')).to.equal(true);
        expect(isRecapDay('2026-09-15')).to.equal(false);
        expect(isRecapDay('2026-09-13')).to.equal(false);
    });

    it('crosses a year boundary without drifting', () => {
        // 2027-01-04 is a Monday; the week it recaps starts in the previous year.
        expect(getRecapWeekStart('2027-01-04')).to.equal('2026-12-28');
        expect(isRecapDay('2027-01-04')).to.equal(true);
    });

    it('stamps the dedupe key with the week and nothing else', () => {
        const key = weeklyRecapDedupeKey(WEEK_START);
        expect(key).to.equal(`weekly-recap:${WEEK_START}`);
        // The guard that matters: a key holding a clock or a random value makes every enqueue
        // unique and silently disables UNIQUE (brandVariation, userId, dedupeKey).
        expect(weeklyRecapDedupeKey(WEEK_START)).to.equal(key);
    });

    it('normalizes any day inside a week to that week, and junk to the default', () => {
        expect(resolveRequestedWeekStart('2026-09-10', '2026-09-16')).to.equal(WEEK_START);
        expect(resolveRequestedWeekStart(WEEK_START, '2026-09-16')).to.equal(WEEK_START);
        expect(resolveRequestedWeekStart(undefined, '2026-09-16')).to.equal(WEEK_START);
        expect(resolveRequestedWeekStart('not-a-date', '2026-09-16')).to.equal(WEEK_START);
        expect(resolveRequestedWeekStart(42 as any, '2026-09-16')).to.equal(WEEK_START);
    });
});

describe('weeklyRecap — building the days', () => {
    it('renders a closed week in full', () => {
        const { statusByDate, checkinCountByDate } = fullWeek('upheld', 2);
        const days = buildRecapDays({
            weekStartDate: WEEK_START, upTo: '2026-09-13', statusByDate, checkinCountByDate,
        });

        expect(days).to.have.length(7);
        expect(days[0]).to.deep.equal({
            date: WEEK_START, dow: 0, status: 'upheld', checkinCount: 2,
        });
        expect(days[6].date).to.equal('2026-09-13');
        expect(days[6].dow).to.equal(6);
    });

    it('stops the in-progress week at today rather than pre-filling missed days', () => {
        // A Thursday read of the current week must show four days, not three days the user has
        // not lived yet reported as failures.
        const { statusByDate, checkinCountByDate } = fullWeek('upheld');
        const days = buildRecapDays({
            weekStartDate: WEEK_START, upTo: '2026-09-10', statusByDate, checkinCountByDate,
        });

        expect(days.map((day) => day.date)).to.deep.equal([
            '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
        ]);
    });

    it('treats a day absent from the ledger as missed', () => {
        const days = buildRecapDays({
            weekStartDate: WEEK_START,
            upTo: '2026-09-13',
            statusByDate: statuses([['2026-09-07', 'upheld']]),
            checkinCountByDate: counts([['2026-09-07', 1]]),
        });

        expect(days[0].status).to.equal('upheld');
        expect(days.slice(1).every((day) => day.status === 'missed')).to.equal(true);
        expect(days.slice(1).every((day) => day.checkinCount === 0)).to.equal(true);
    });

    it('totals check-ins and day statuses separately', () => {
        const days = buildRecapDays({
            weekStartDate: WEEK_START,
            upTo: '2026-09-13',
            statusByDate: statuses([
                ['2026-09-07', 'upheld'],
                ['2026-09-08', 'upheld'],
                ['2026-09-09', 'frozen'],
                ['2026-09-10', 'missed'],
            ]),
            checkinCountByDate: counts([['2026-09-07', 3], ['2026-09-08', 1]]),
        });

        expect(sumRecapTotals(days)).to.deep.equal({
            checkinCount: 4,
            upheldDays: 2,
            frozenDays: 1,
            missedDays: 4,
        });
    });

    it('does not call a frozen week perfect', () => {
        // Same rule as walkDailyStreakDays: a freeze keeps the streak alive, it does not earn
        // the day. If these two disagreed, the recap would congratulate a perfect week the
        // achievement ladder refused to award.
        const frozen = buildRecapDays({
            weekStartDate: WEEK_START, upTo: '2026-09-13', ...fullWeek('frozen'),
        });
        const upheld = buildRecapDays({
            weekStartDate: WEEK_START, upTo: '2026-09-13', ...fullWeek('upheld'),
        });

        expect(isPerfectRecapWeek(frozen)).to.equal(false);
        expect(isPerfectRecapWeek(upheld)).to.equal(true);
    });

    it('does not call a partial week perfect even when every day so far was upheld', () => {
        const partial = buildRecapDays({
            weekStartDate: WEEK_START, upTo: '2026-09-09', ...fullWeek('upheld'),
        });

        expect(partial).to.have.length(3);
        expect(isPerfectRecapWeek(partial)).to.equal(false);
    });
});

describe('weeklyRecap — habit ranking', () => {
    const habit = (name: string, completedCount: number): IWeeklyRecapHabit => ({
        habitGoalId: `id-${name}`, name, emoji: null, completedCount,
    });

    it('orders by count, then by name so the order is stable', () => {
        const ranked = rankRecapHabits([habit('Walk', 2), habit('Read', 5), habit('Apnea', 2)]);

        expect(ranked.map((h) => h.name)).to.deep.equal(['Read', 'Apnea', 'Walk']);
    });

    it('drops habits with no completions in the week', () => {
        const ranked = rankRecapHabits([habit('Read', 3), habit('Dormant', 0)]);

        expect(ranked.map((h) => h.name)).to.deep.equal(['Read']);
    });
});

describe('weeklyRecap — headline', () => {
    const totals = (checkinCount: number) => ({ ...EMPTY_WEEKLY_RECAP_TOTALS, checkinCount });

    it('puts a perfect week ahead of any comparison', () => {
        // A perfect week that happens to be one check-in down on the last one is still a
        // perfect week; reporting it as a decline would be true and useless.
        expect(pickWeeklyRecapHeadline({
            totals: totals(7),
            previousTotals: totals(12),
            hasPreviousWeek: true,
            isPerfectWeek: true,
        })).to.equal('perfectWeek');
    });

    it('never compares against a week the user did not have', () => {
        expect(pickWeeklyRecapHeadline({
            totals: totals(4),
            previousTotals: { ...EMPTY_WEEKLY_RECAP_TOTALS },
            hasPreviousWeek: false,
            isPerfectWeek: false,
        })).to.equal('firstWeek');
    });

    it('compares check-ins, not upheld days', () => {
        // Upheld days saturate at seven, so a user who went from one habit a day to three
        // would read "steady" forever if the comparison used them.
        const base = { hasPreviousWeek: true, isPerfectWeek: false };

        expect(pickWeeklyRecapHeadline({
            ...base,
            totals: { ...EMPTY_WEEKLY_RECAP_TOTALS, checkinCount: 21, upheldDays: 7 },
            previousTotals: { ...EMPTY_WEEKLY_RECAP_TOTALS, checkinCount: 7, upheldDays: 7 },
        })).to.equal('improved');

        expect(pickWeeklyRecapHeadline({
            ...base, totals: totals(3), previousTotals: totals(9),
        })).to.equal('declined');

        expect(pickWeeklyRecapHeadline({
            ...base, totals: totals(5), previousTotals: totals(5),
        })).to.equal('steady');
    });
});

describe('weeklyRecap — assembly', () => {
    const days: IWeeklyRecapDay[] = buildRecapDays({
        weekStartDate: WEEK_START,
        upTo: '2026-09-13',
        statusByDate: statuses([
            ['2026-09-07', 'upheld'],
            ['2026-09-08', 'upheld'],
            ['2026-09-09', 'upheld'],
        ]),
        checkinCountByDate: counts([['2026-09-07', 2], ['2026-09-08', 1], ['2026-09-09', 1]]),
    });

    const assemble = (overrides: Partial<Parameters<typeof assembleWeeklyRecap>[0]> = {}) => assembleWeeklyRecap({
        weekStartDate: WEEK_START,
        timeZone: 'America/Chicago',
        today: '2026-09-16',
        days,
        previousTotals: { ...EMPTY_WEEKLY_RECAP_TOTALS, checkinCount: 2 },
        hasPreviousWeek: true,
        habits: [
            {
                habitGoalId: 'a', name: 'Read', emoji: '📖', completedCount: 3,
            },
            {
                habitGoalId: 'b', name: 'Walk', emoji: null, completedCount: 1,
            },
        ],
        streakAtWeekEnd: 3,
        longestStreak: 11,
        ...overrides,
    });

    it('closes the week on the Sunday and names the busiest habit', () => {
        const recap = assemble();

        expect(recap.weekStartDate).to.equal(WEEK_START);
        expect(recap.weekEndDate).to.equal('2026-09-13');
        expect(recap.totals.checkinCount).to.equal(4);
        expect(recap.topHabit?.name).to.equal('Read');
        expect(recap.headline).to.equal('improved');
        expect(recap.isPerfectWeek).to.equal(false);
    });

    it('flags the week in progress so the client can render it differently', () => {
        expect(assemble().isCurrentWeek).to.equal(false);
        // A `today` inside the recapped week means the caller asked for the open week.
        expect(assemble({ today: '2026-09-10' }).isCurrentWeek).to.equal(true);
    });

    it('reports no top habit for a week with nothing in it', () => {
        const emptyWeek = assemble({
            days: buildRecapDays({
                weekStartDate: WEEK_START,
                upTo: '2026-09-13',
                statusByDate: statuses([]),
                checkinCountByDate: counts([]),
            }),
            habits: [],
            previousTotals: { ...EMPTY_WEEKLY_RECAP_TOTALS },
            hasPreviousWeek: false,
        });

        expect(emptyWeek.topHabit).to.equal(null);
        expect(emptyWeek.totals).to.deep.equal({
            checkinCount: 0, upheldDays: 0, frozenDays: 0, missedDays: 7,
        });
        // The digest refuses to send this one — see runWeeklyRecapPass — but the screen can
        // still be opened on it, so it has to assemble rather than throw.
        expect(emptyWeek.headline).to.equal('firstWeek');
    });

    it('keeps the previous week\'s totals separate from this week\'s', () => {
        const recap = assemble();

        expect(recap.previousTotals.checkinCount).to.equal(2);
        expect(recap.totals.checkinCount).to.equal(4);
        expect(recap.hasPreviousWeek).to.equal(true);
    });

    it('carries the streak as it stood at the close of the week, not today\'s', () => {
        // The distinction only matters for a recap read days later, which is exactly when a
        // live `currentStreak` would be a different number and the wrong one.
        expect(assemble({ streakAtWeekEnd: 3, longestStreak: 11 }).streakAtWeekEnd).to.equal(3);
        expect(assemble({ streakAtWeekEnd: 3, longestStreak: 11 }).longestStreak).to.equal(11);
    });
});

// Keeps PREVIOUS_WEEK_START referenced: the previous week is one addDays(-7) from the recap
// week, and a change to that arithmetic should fail here rather than silently compare the
// wrong seven days.
describe('weeklyRecap — previous week', () => {
    it('is the seven days immediately before the recap week', () => {
        expect(getRecapWeekStart(WEEK_START)).to.equal(PREVIOUS_WEEK_START);
    });
});
