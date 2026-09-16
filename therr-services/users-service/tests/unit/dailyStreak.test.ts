import { expect } from 'chai';
import {
    addDays,
    clampCelebratedDate,
    daysBetween,
    getDayOfWeekMondayFirst,
    getLocalDate,
    getWeekStart,
    isDailyStreakMilestone,
    isWeekPerfectThrough,
    pickFreezeSource,
    resolveCheckinHabitDate,
    resolveCheckinLocalDate,
    resolveCheckinTimeZone,
    walkDailyStreakDays,
    CONSECUTIVE_PERFECT_WEEKS_FOR_ACHIEVEMENT,
    DailyStreakDayStatus,
    IDailyStreakWalkState,
    IFreezeSource,
} from '../../src/utilities/dailyStreak';

/**
 * The app-level daily streak rules, pinned. Every case here is one of the decisions in the
 * feature brief, and the walk is pure — a fixed clock and an explicit timezone, no host
 * timezone anywhere (the suite is pinned to UTC by .mocharc.js, which is exactly the condition
 * under which a UTC-vs-local bug hides).
 */

const TZ_CHICAGO = 'America/Chicago';

const state = (overrides: Partial<IDailyStreakWalkState> = {}): IDailyStreakWalkState => ({
    currentStreak: 0,
    longestStreak: 0,
    consecutivePerfectWeeks: 0,
    lastResetFromStreak: 0,
    ...overrides,
});

const freeze = (overrides: Partial<IFreezeSource> = {}): IFreezeSource => ({
    streakId: 'streak-a',
    habitGoalId: 'habit-a',
    freezesRemaining: 1,
    currentStreak: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const statusesOf = (days: { localDate: string; status: DailyStreakDayStatus }[]) => days
    .reduce((acc: Record<string, DailyStreakDayStatus>, day) => {
        acc[day.localDate] = day.status;
        return acc;
    }, {});

describe('Daily streak — date helpers', () => {
    it('adds days and measures gaps across a month boundary', () => {
        expect(addDays('2026-08-31', 1)).to.equal('2026-09-01');
        expect(addDays('2026-09-01', -1)).to.equal('2026-08-31');
        expect(daysBetween('2026-08-31', '2026-09-02')).to.equal(2);
    });

    it('starts weeks on Monday', () => {
        // 2026-09-13 is a Sunday.
        expect(getDayOfWeekMondayFirst('2026-09-13')).to.equal(6);
        expect(getWeekStart('2026-09-13')).to.equal('2026-09-07');
        expect(getWeekStart('2026-09-07')).to.equal('2026-09-07');
    });

    it('flags exactly the milestone ladder, then every 500 past 1000', () => {
        [7, 30, 50, 100, 200, 365, 500, 730, 1000, 1500, 2000].forEach((n) => {
            expect(isDailyStreakMilestone(n), `${n} should be a milestone`).to.equal(true);
        });
        [0, 1, 6, 8, 29, 64, 999, 1001, 1200].forEach((n) => {
            expect(isDailyStreakMilestone(n), `${n} should not be a milestone`).to.equal(false);
        });
    });
});

describe('Habit day resolution — resolveCheckinHabitDate', () => {
    /**
     * The reported bug, pinned. 19:00 on Sep 15 in Chicago is 00:00 on Sep 16 in UTC, and the
     * habit day has to be the 15th: the user is looking at a calendar built from their own
     * local components, and a check-in that lands on tomorrow's cell is the whole complaint.
     */
    it('credits an evening check-in to the user\'s day, not the UTC day', () => {
        const at = new Date('2026-09-16T00:00:00.000Z'); // 19:00 on Sep 15 in Chicago (CDT, -5)
        expect(resolveCheckinHabitDate({ timeZone: TZ_CHICAGO, now: at })).to.equal('2026-09-15');
    });

    /**
     * The backwards-compatibility clamp. Installed app versions stamp `scheduledDate` with the
     * UTC day, which is ahead of the user's day for exactly those evening hours — so the fix
     * has to land server-side to reach them, not only in the next store release.
     */
    it('clamps a UTC-stamped scheduledDate from a legacy client down to the user\'s today', () => {
        const at = new Date('2026-09-16T00:00:00.000Z');
        expect(resolveCheckinHabitDate({
            requestedDate: '2026-09-16', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-15');
    });

    it('honours a backdated request — logging a missed day still works', () => {
        const at = new Date('2026-09-16T00:00:00.000Z');
        expect(resolveCheckinHabitDate({
            requestedDate: '2026-09-10', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-10');
    });

    it('pulls a skewed or hand-made future date back to today', () => {
        const at = new Date('2026-09-16T00:00:00.000Z');
        expect(resolveCheckinHabitDate({
            requestedDate: '2027-01-01', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-15');
    });

    it('ignores a malformed date rather than writing it', () => {
        const at = new Date('2026-09-16T00:00:00.000Z');
        expect(resolveCheckinHabitDate({
            requestedDate: 'yesterday', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-15');
        expect(resolveCheckinHabitDate({
            requestedDate: null, timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-15');
    });

    it('gives a user east of UTC their own day too', () => {
        // 08:00 on Sep 16 in Tokyo, while UTC is still Sep 15.
        const at = new Date('2026-09-15T23:00:00.000Z');
        expect(resolveCheckinHabitDate({ timeZone: 'Asia/Tokyo', now: at })).to.equal('2026-09-16');
    });
});

describe('Daily streak — local day resolution', () => {
    // Case 6 from the brief: a check-in at 23:50 local on Sep 12 in America/Chicago belongs to
    // Sep 12, even though it is already Sep 13 in UTC — which is the day a legacy client
    // stamps on `scheduledDate`.
    it('keeps a late-evening check-in on the user\'s own day, not the UTC day', () => {
        const at = new Date('2026-09-13T04:50:00.000Z'); // 23:50 on Sep 12 in Chicago (CDT, -5)
        expect(getLocalDate(TZ_CHICAGO, at)).to.equal('2026-09-12');
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-13',
            timeZone: TZ_CHICAGO,
            now: at,
        })).to.equal('2026-09-12');
    });

    it('shifts a backdated check-in by the same number of days', () => {
        const at = new Date('2026-09-13T16:00:00.000Z'); // 11:00 on Sep 13 in Chicago
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-12',
            timeZone: TZ_CHICAGO,
            now: at,
        })).to.equal('2026-09-12');
    });

    /**
     * The regression the habit-day change could have introduced. With `scheduledDate` now
     * resolved in the user's zone, measuring how far it is backdated against the *UTC* day
     * counts the zone offset twice and files an evening check-in under yesterday.
     */
    it('measures backdating against the user\'s today, not UTC\'s', () => {
        const at = new Date('2026-09-16T00:00:00.000Z'); // 19:00 on Sep 15 in Chicago
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-15',
            timeZone: TZ_CHICAGO,
            now: at,
        })).to.equal('2026-09-15');
        // And a genuinely backdated one still shifts.
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-14',
            timeZone: TZ_CHICAGO,
            now: at,
        })).to.equal('2026-09-14');
    });

    it('honours an explicit localDate for today and yesterday only', () => {
        const at = new Date('2026-09-13T16:00:00.000Z');
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-13', requestedLocalDate: '2026-09-12', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-12');
        // Older than yesterday, and the future, both fall back to the derived day.
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-13', requestedLocalDate: '2026-09-01', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-13');
        expect(resolveCheckinLocalDate({
            scheduledDate: '2026-09-13', requestedLocalDate: '2026-09-20', timeZone: TZ_CHICAGO, now: at,
        })).to.equal('2026-09-13');
    });

    it('prefers the account timezone, then the device, then the service fallback', () => {
        expect(resolveCheckinTimeZone('Europe/Berlin', 'America/Chicago')).to.equal('Europe/Berlin');
        expect(resolveCheckinTimeZone(null, 'America/Chicago')).to.equal('America/Chicago');
        expect(resolveCheckinTimeZone('not-a-zone', 'also-junk')).to.equal('America/Chicago');
        expect(resolveCheckinTimeZone('', undefined)).to.equal('America/Chicago');
    });
});

describe('Daily streak — clampCelebratedDate', () => {
    // 04:50Z on Sep 13: Sep 12 in Chicago, Sep 13 in Tokyo, and already Sep 13 in UTC+14.
    const at = new Date('2026-09-13T04:50:00.000Z');

    it('pulls a future date back to the user\'s own today, so it cannot silence later celebrations', () => {
        expect(clampCelebratedDate('2026-12-25', { settingsTimezone: TZ_CHICAGO }, at)).to.equal('2026-09-12');
        // A one-day clock skew is the realistic case, not only a hand-made request.
        expect(clampCelebratedDate('2026-09-13', { settingsTimezone: TZ_CHICAGO }, at)).to.equal('2026-09-12');
    });

    it('leaves today and earlier alone — the day can roll over between the offer and the dismissal', () => {
        expect(clampCelebratedDate('2026-09-12', { settingsTimezone: TZ_CHICAGO }, at)).to.equal('2026-09-12');
        expect(clampCelebratedDate('2026-09-11', { settingsTimezone: TZ_CHICAGO }, at)).to.equal('2026-09-11');
    });

    it('uses the device zone when the account has none saved', () => {
        expect(clampCelebratedDate('2026-09-13', { settingsTimezone: null, deviceTimezone: 'Asia/Tokyo' }, at))
            .to.equal('2026-09-13');
    });

    it('bounds by the latest local day on Earth, not the fallback zone, when no zone resolves', () => {
        // A Tokyo user with no saved zone and an old client that sends no device zone: their
        // real today is Sep 13. Clamping to the America/Chicago fallback's Sep 12 would make
        // the next summary read offer the same celebration again.
        expect(clampCelebratedDate('2026-09-13', { settingsTimezone: null }, at)).to.equal('2026-09-13');
        expect(clampCelebratedDate('2026-09-14', { settingsTimezone: 'junk', deviceTimezone: 'junk' }, at))
            .to.equal('2026-09-13');
    });
});

describe('Daily streak — freeze selection', () => {
    // Case 4: two habits with freezes → the one with more freezes lends.
    it('borrows from the habit with the most freezes remaining', () => {
        const picked = pickFreezeSource([
            freeze({ streakId: 's1', habitGoalId: 'h1', freezesRemaining: 1 }),
            freeze({ streakId: 's3', habitGoalId: 'h3', freezesRemaining: 3 }),
        ]);
        expect(picked?.habitGoalId).to.equal('h3');
    });

    it('breaks a tie on freezes by the longer habit streak, then the older habit', () => {
        expect(pickFreezeSource([
            freeze({ habitGoalId: 'short', freezesRemaining: 2, currentStreak: 3 }),
            freeze({ habitGoalId: 'long', freezesRemaining: 2, currentStreak: 40 }),
        ])?.habitGoalId).to.equal('long');

        expect(pickFreezeSource([
            freeze({
                habitGoalId: 'newer', freezesRemaining: 2, currentStreak: 5, createdAt: '2026-05-01T00:00:00Z',
            }),
            freeze({
                habitGoalId: 'older', freezesRemaining: 2, currentStreak: 5, createdAt: '2026-01-01T00:00:00Z',
            }),
        ])?.habitGoalId).to.equal('older');
    });

    it('returns nothing when no habit has a freeze left', () => {
        expect(pickFreezeSource([freeze({ freezesRemaining: 0 })])).to.equal(undefined);
        expect(pickFreezeSource([])).to.equal(undefined);
    });
});

describe('Daily streak — walkDailyStreakDays', () => {
    // Case 1
    it('increments across consecutive upheld days', () => {
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 2, longestStreak: 2 }),
            fromDate: '2026-09-08',
            upTo: '2026-09-10',
            upheldDates: new Set(['2026-09-08', '2026-09-09', '2026-09-10']),
            freezeSources: [],
        });

        expect(result.days.map((d) => d.streakAfter)).to.deep.equal([3, 4, 5]);
        expect(result.days.every((d) => d.status === 'upheld')).to.equal(true);
        expect(result.state.currentStreak).to.equal(5);
        expect(result.state.longestStreak).to.equal(5);
        expect(result.events.lastUpheldDate).to.equal('2026-09-10');
    });

    // Case 2
    it('freezes a missed day when a habit has freezes, and consumes exactly one', () => {
        const sources = [freeze({ streakId: 's1', freezesRemaining: 2 })];
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 5, longestStreak: 5 }),
            fromDate: '2026-09-09',
            upTo: '2026-09-09',
            upheldDates: new Set<string>(),
            freezeSources: sources,
        });

        expect(result.days[0].status).to.equal('frozen');
        expect(result.days[0].freezeHabitGoalId).to.equal('habit-a');
        expect(result.days[0].streakAfter).to.equal(5);
        expect(result.state.currentStreak).to.equal(5);
        expect(sources[0].freezesRemaining).to.equal(1);
        expect(result.freezesBorrowed.get('s1')).to.equal(1);
        expect(result.events.freezeSaved).to.equal(true);
    });

    // Case 3
    it('spends the last freeze on the first missed day and resets on the second', () => {
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 9, longestStreak: 9 }),
            fromDate: '2026-09-09',
            upTo: '2026-09-10',
            upheldDates: new Set<string>(),
            freezeSources: [freeze({ freezesRemaining: 1 })],
        });

        expect(result.days.map((d) => d.status)).to.deep.equal(['frozen', 'missed']);
        expect(result.days.map((d) => d.streakAfter)).to.deep.equal([9, 0]);
        expect(result.state.currentStreak).to.equal(0);
        // The record is retained through a reset.
        expect(result.state.longestStreak).to.equal(9);
    });

    it('never borrows a freeze when the streak is already zero', () => {
        const sources = [freeze({ freezesRemaining: 2 })];
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 0 }),
            fromDate: '2026-09-09',
            upTo: '2026-09-09',
            upheldDates: new Set<string>(),
            freezeSources: sources,
        });

        expect(result.days[0].status).to.equal('missed');
        expect(sources[0].freezesRemaining).to.equal(2);
    });

    it('resets instead of freezing in backfill mode', () => {
        const sources = [freeze({ freezesRemaining: 3 })];
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 4, longestStreak: 4 }),
            fromDate: '2026-09-09',
            upTo: '2026-09-09',
            upheldDates: new Set<string>(),
            freezeSources: sources,
            allowFreezes: false,
        });

        expect(result.days[0].status).to.equal('missed');
        expect(sources[0].freezesRemaining).to.equal(3);
    });

    // Case 5, the pure half: re-walking a day that is now upheld yields 'upheld' and borrows
    // nothing, which is what makes the rewind path a refund. (The refund write itself is the
    // orchestrator's job — rewindDailyStreak in handlers/helpers/dailyStreak.ts.)
    it('re-walks a previously frozen day as upheld once a backdated check-in fills it', () => {
        const sources = [freeze({ freezesRemaining: 1 })];
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 5, longestStreak: 5 }),
            fromDate: '2026-09-09',
            upTo: '2026-09-09',
            upheldDates: new Set(['2026-09-09']),
            freezeSources: sources,
        });

        expect(result.days[0].status).to.equal('upheld');
        expect(result.days[0].freezeHabitGoalId).to.equal(null);
        expect(result.freezesBorrowed.size).to.equal(0);
        expect(sources[0].freezesRemaining).to.equal(1);
    });

    // Case 7
    it('is a no-op when the range is already evaluated (upTo before fromDate)', () => {
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 3, longestStreak: 3 }),
            fromDate: '2026-09-11',
            upTo: '2026-09-10',
            upheldDates: new Set(['2026-09-10']),
            freezeSources: [],
        });

        expect(result.days).to.have.length(0);
        expect(result.state.currentStreak).to.equal(3);
        expect(result.events.milestonesReached).to.have.length(0);
    });

    it('produces identical days when the same range is walked twice', () => {
        const args = () => ({
            state: state({ currentStreak: 1, longestStreak: 1 }),
            fromDate: '2026-09-07',
            upTo: '2026-09-13',
            upheldDates: new Set(['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']),
            freezeSources: [freeze({ freezesRemaining: 1 })],
        });

        expect(walkDailyStreakDays(args()).days).to.deep.equal(walkDailyStreakDays(args()).days);
    });

    // Case 8
    it('counts a perfect week only when all seven days are upheld by a real check-in', () => {
        const week = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];

        const perfect = walkDailyStreakDays({
            state: state({ currentStreak: 0 }),
            fromDate: week[0],
            upTo: week[6],
            upheldDates: new Set(week),
            freezeSources: [],
        });
        expect(perfect.events.perfectWeeksClosed).to.equal(1);
        expect(perfect.state.consecutivePerfectWeeks).to.equal(1);

        const withFrozenDay = walkDailyStreakDays({
            state: state({ currentStreak: 3 }),
            fromDate: week[0],
            upTo: week[6],
            upheldDates: new Set(week.filter((d) => d !== '2026-09-10')),
            freezeSources: [freeze({ freezesRemaining: 1 })],
        });
        expect(statusesOf(withFrozenDay.days)['2026-09-10']).to.equal('frozen');
        expect(withFrozenDay.events.perfectWeeksClosed).to.equal(0);
        expect(withFrozenDay.state.consecutivePerfectWeeks).to.equal(0);
    });

    it('judges a mid-week start against the days already on the ledger', () => {
        const priorWeekStatuses = new Map<string, DailyStreakDayStatus>([
            ['2026-09-07', 'upheld'],
            ['2026-09-08', 'upheld'],
            ['2026-09-09', 'upheld'],
        ]);

        const result = walkDailyStreakDays({
            state: state({ currentStreak: 3 }),
            fromDate: '2026-09-10',
            upTo: '2026-09-13',
            upheldDates: new Set(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']),
            freezeSources: [],
            priorWeekStatuses,
        });

        expect(result.events.perfectWeeksClosed).to.equal(1);
    });

    it('raises the four-consecutive-perfect-weeks event exactly once', () => {
        const start = '2026-08-17'; // a Monday
        const days = Array.from({ length: 28 }, (_, i) => addDays(start, i));

        const result = walkDailyStreakDays({
            state: state(),
            fromDate: start,
            upTo: days[days.length - 1],
            upheldDates: new Set(days),
            freezeSources: [],
        });

        expect(result.events.perfectWeeksClosed).to.equal(4);
        expect(result.state.consecutivePerfectWeeks).to.equal(CONSECUTIVE_PERFECT_WEEKS_FOR_ACHIEVEMENT);
        expect(result.events.reachedConsecutivePerfectWeeks).to.equal(true);
    });

    // Case 9
    it('reports a milestone once — the first time that length is reached', () => {
        const first = walkDailyStreakDays({
            state: state({ currentStreak: 6, longestStreak: 6 }),
            fromDate: '2026-09-10',
            upTo: '2026-09-10',
            upheldDates: new Set(['2026-09-10']),
            freezeSources: [],
        });
        expect(first.events.milestonesReached).to.deep.equal([7]);

        // Same length again after a reset: celebrated on screen, but the ladder is already
        // climbed, so no achievement event.
        const again = walkDailyStreakDays({
            state: state({ currentStreak: 6, longestStreak: 40 }),
            fromDate: '2026-09-10',
            upTo: '2026-09-10',
            upheldDates: new Set(['2026-09-10']),
            freezeSources: [],
        });
        expect(again.events.milestonesReached).to.have.length(0);
        expect(isDailyStreakMilestone(7)).to.equal(true);
    });

    it('raises a comeback only after a reset from 30 or more', () => {
        const days = Array.from({ length: 7 }, (_, i) => addDays('2026-09-07', i));

        const comeback = walkDailyStreakDays({
            state: state({ longestStreak: 45, lastResetFromStreak: 45 }),
            fromDate: days[0],
            upTo: days[6],
            upheldDates: new Set(days),
            freezeSources: [],
        });
        expect(comeback.events.comeback).to.equal(true);
        expect(comeback.state.lastResetFromStreak).to.equal(0);

        const firstEverStreak = walkDailyStreakDays({
            state: state(),
            fromDate: days[0],
            upTo: days[6],
            upheldDates: new Set(days),
            freezeSources: [],
        });
        expect(firstEverStreak.events.comeback).to.equal(false);
    });

    it('records the streak length a reset destroyed so a later comeback can be judged', () => {
        const result = walkDailyStreakDays({
            state: state({ currentStreak: 31, longestStreak: 31 }),
            fromDate: '2026-09-09',
            upTo: '2026-09-09',
            upheldDates: new Set<string>(),
            freezeSources: [],
        });

        expect(result.days[0].status).to.equal('missed');
        expect(result.state.lastResetFromStreak).to.equal(31);
    });
});

describe('Daily streak — isWeekPerfectThrough', () => {
    it('is true only when every day up to and including the given one is upheld', () => {
        const statuses = new Map<string, DailyStreakDayStatus | 'future' | 'pending'>([
            ['2026-09-07', 'upheld'],
            ['2026-09-08', 'upheld'],
            ['2026-09-09', 'frozen'],
            ['2026-09-10', 'upheld'],
        ]);

        expect(isWeekPerfectThrough('2026-09-08', statuses)).to.equal(true);
        expect(isWeekPerfectThrough('2026-09-09', statuses)).to.equal(false);
        expect(isWeekPerfectThrough('2026-09-10', statuses)).to.equal(false);
    });
});
