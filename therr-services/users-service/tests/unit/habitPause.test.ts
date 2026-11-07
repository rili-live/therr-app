import { expect } from 'chai';
import {
    computeRequiredDates,
    countMissedPeriods,
    expandExcusedDates,
    getCadence,
    isDateExcused,
} from '../../src/utilities/habitCadence';
import { walkDailyStreakDays } from '../../src/utilities/dailyStreak';
import {
    formatLocalDateForLocale,
    getDaysPaused,
    getPauseEligibility,
    getPauseReminderDedupeKey,
    getPauseReminderSchedule,
    groupExcusedRangesByHabit,
    PAUSE_COOLDOWN_DAYS,
    PAUSE_REMINDER_DAYS,
    toExcusedRange,
} from '../../src/utilities/habitPause';

/**
 * Pausing a habit. The promise the feature makes, in the copy the user reads before they tap
 * "Pause", is that a paused habit cannot cost them anything: not the habit's own streak, not a
 * freeze, and not the overall daily streak. These pin each part of that.
 *
 *   2026-09-14 Mon · 15 Tue · 16 Wed · 17 Thu · 18 Fri · 19 Sat · 20 Sun · 21 Mon …
 */
const MON = '2026-09-14';
const TUE = '2026-09-15';
const WED = '2026-09-16';
const THU = '2026-09-17';
const FRI = '2026-09-18';
const SUN = '2026-09-20';
const NEXT_MON = '2026-09-21';
const NEXT_SUN = '2026-09-27';

const daily = getCadence({ frequencyType: 'daily' });

describe('Habit pause', () => {
    describe('excused ranges', () => {
        it('excuses the day the pause began and not the day it ended', () => {
            const ranges = [{ from: TUE, until: FRI }];
            expect(isDateExcused(MON, ranges)).to.equal(false);
            expect(isDateExcused(TUE, ranges)).to.equal(true);
            expect(isDateExcused(THU, ranges)).to.equal(true);
            expect(isDateExcused(FRI, ranges)).to.equal(false);
        });

        it('treats an open pause as running indefinitely', () => {
            const ranges = [{ from: TUE, until: null }];
            expect(isDateExcused(NEXT_SUN, ranges)).to.equal(true);
            expect(Array.from(expandExcusedDates(ranges, MON, THU))).to.deep.equal([TUE, WED, THU]);
        });

        it('reads stored rows, including dates the driver hands back as Date objects', () => {
            expect(toExcusedRange({ pausedOn: TUE, resumedOn: null })).to.deep.equal({ from: TUE, until: null });
            expect(toExcusedRange({ pausedOn: new Date(`${TUE}T00:00:00.000Z`) as any, resumedOn: FRI }))
                .to.deep.equal({ from: TUE, until: FRI });
            expect(toExcusedRange({ pausedOn: 'garbage', resumedOn: null })).to.equal(null);

            const grouped = groupExcusedRangesByHabit([
                { habitGoalId: 'g1', pausedOn: MON, resumedOn: TUE },
                { habitGoalId: 'g1', pausedOn: THU, resumedOn: null },
                { habitGoalId: 'g2', pausedOn: WED, resumedOn: FRI },
            ]);
            expect(grouped.get('g1')).to.have.length(2);
            expect(grouped.get('g2')).to.deep.equal([{ from: WED, until: FRI }]);
        });
    });

    describe("the habit's own streak (countMissedPeriods)", () => {
        it('does not count paused days of a daily habit as misses', () => {
            // Last done Mon, paused Tue–Thu, resumed and checked in Fri: nothing missed.
            const excusedDates = expandExcusedDates([{ from: TUE, until: FRI }], MON, FRI);
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: FRI, excusedDates })).to.equal(0);
            // Without the pause the same gap is three misses.
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: FRI })).to.equal(3);
        });

        it('still counts the days before the pause began', () => {
            // Last done Mon, skipped Tue, paused Wed–Thu, checked in Fri: one miss (Tue).
            const excusedDates = expandExcusedDates([{ from: WED, until: FRI }], MON, FRI);
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: FRI, excusedDates })).to.equal(1);
        });

        it('skips paused scheduled weekdays', () => {
            const monWedFri = getCadence({ targetDaysOfWeek: [1, 3, 5] });
            const excusedDates = expandExcusedDates([{ from: TUE, until: NEXT_MON }], MON, NEXT_MON);
            expect(countMissedPeriods(monWedFri, { lastCompletedDate: MON, throughDate: NEXT_MON, excusedDates })).to.equal(0);
            expect(countMissedPeriods(monWedFri, { lastCompletedDate: MON, throughDate: NEXT_MON })).to.equal(2);
        });

        it('does not judge a quota week the user paused any part of', () => {
            const threePerWeek = getCadence({ frequencyType: 'weekly', frequencyCount: 3 });
            // One check-in the week of MON, paused from Thursday, back the following Monday.
            const excusedDates = expandExcusedDates([{ from: THU, until: NEXT_MON }], MON, NEXT_MON);
            expect(countMissedPeriods(threePerWeek, {
                lastCompletedDate: MON,
                throughDate: NEXT_MON,
                completedDates: [MON],
                excusedDates,
            })).to.equal(0);
            expect(countMissedPeriods(threePerWeek, {
                lastCompletedDate: MON,
                throughDate: NEXT_MON,
                completedDates: [MON],
            })).to.equal(1);
        });
    });

    describe('the overall daily streak', () => {
        it('makes a day only a paused habit required a rest day', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: daily, pausedRanges: [{ from: TUE, until: FRI }] }],
                fromDate: MON,
                upTo: SUN,
                completions: [],
            });
            expect(Array.from(required)).to.deep.equal([MON, FRI, '2026-09-19', SUN]);
        });

        it('still requires the day of any habit that is not paused', () => {
            const required = computeRequiredDates({
                habits: [
                    { habitGoalId: 'g1', cadence: daily, pausedRanges: [{ from: TUE, until: null }] },
                    { habitGoalId: 'g2', cadence: daily },
                ],
                fromDate: MON,
                upTo: WED,
                completions: [],
            });
            expect(Array.from(required)).to.deep.equal([MON, TUE, WED]);
        });

        it('holds the streak through a pause without spending a freeze', () => {
            const requiredDates = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: daily, pausedRanges: [{ from: TUE, until: FRI }] }],
                fromDate: MON,
                upTo: FRI,
                completions: [],
            });
            const freezeSources = [{
                streakId: 's1', habitGoalId: 'g1', freezesRemaining: 1, currentStreak: 10, createdAt: null,
            }];
            const result = walkDailyStreakDays({
                state: {
                    currentStreak: 10, longestStreak: 10, consecutivePerfectWeeks: 0, lastResetFromStreak: 0,
                },
                fromDate: MON,
                upTo: FRI,
                upheldDates: new Set([MON, FRI]),
                requiredDates,
                freezeSources,
            });

            expect(result.days.map((day) => day.status)).to.deep.equal(['upheld', 'rest', 'rest', 'rest', 'upheld']);
            expect(result.state.currentStreak).to.equal(12);
            expect(result.freezesBorrowed.size).to.equal(0);
            expect(freezeSources[0].freezesRemaining).to.equal(1);
        });
    });

    describe('eligibility', () => {
        it('allows a first pause', () => {
            expect(getPauseEligibility({ today: WED })).to.deep.equal({ canPause: true });
        });

        it('refuses a second pause while one is open', () => {
            expect(getPauseEligibility({ openPause: { id: 'p1' }, today: WED }))
                .to.deep.equal({ canPause: false, reason: 'already-paused' });
        });

        it(`refuses a re-pause for ${PAUSE_COOLDOWN_DAYS} days after the last one ended`, () => {
            const lastClosedPause = { resumedOn: MON };
            expect(getPauseEligibility({ lastClosedPause, today: SUN }))
                .to.deep.equal({ canPause: false, reason: 'cooldown', availableOn: NEXT_MON });
            expect(getPauseEligibility({ lastClosedPause, today: NEXT_MON })).to.deep.equal({ canPause: true });
        });

        it('counts the days paused from the day it began', () => {
            expect(getDaysPaused(MON, MON)).to.equal(0);
            expect(getDaysPaused(MON, NEXT_MON)).to.equal(7);
            expect(getDaysPaused(NEXT_MON, MON)).to.equal(0);
        });
    });

    describe('resume reminders', () => {
        it('schedules one reminder per offset, mid-morning in the user\'s zone', () => {
            const schedule = getPauseReminderSchedule({
                pausedOn: MON,
                timeZone: 'America/Chicago',
                pausedAt: new Date(`${MON}T23:00:00.000Z`),
            });

            expect(schedule.map((reminder) => reminder.dayCount)).to.deep.equal([...PAUSE_REMINDER_DAYS]);
            expect(schedule.map((reminder) => reminder.localDate)).to.deep.equal([NEXT_MON, '2026-09-28', '2026-10-14']);
            // 10:00 CDT is 15:00 UTC.
            expect(schedule[0].scheduledFor.toISOString()).to.equal('2026-09-21T15:00:00.000Z');
        });

        it('keys each reminder on the pause, never on a clock value', () => {
            expect(getPauseReminderDedupeKey('pause-1', 7)).to.equal('habit-pause-reminder:pause-1:7');
            expect(getPauseReminderDedupeKey('pause-1', 7)).to.equal(getPauseReminderDedupeKey('pause-1', 7));
        });
    });
    describe('formatLocalDateForLocale', () => {
        it('writes the day the way each locale reads it, not as YYYY-MM-DD', () => {
            expect(formatLocalDateForLocale('2026-11-14', 'en-us', '2026-11-07')).to.equal('November 14');
            expect(formatLocalDateForLocale('2026-11-14', 'es', '2026-11-07')).to.equal('14 de noviembre');
            expect(formatLocalDateForLocale('2026-11-14', 'fr-ca', '2026-11-07')).to.equal('14 novembre');
        });

        it('names the year only when the date falls in a different one', () => {
            expect(formatLocalDateForLocale('2027-01-03', 'en-us', '2026-12-29')).to.equal('January 3, 2027');
        });

        it('keeps the calendar day, whatever zone the server runs in', () => {
            expect(formatLocalDateForLocale('2026-03-01', 'en-us', '2026-02-25')).to.equal('March 1');
        });

        it('falls back to English for an unknown locale and returns unreadable input unchanged', () => {
            expect(formatLocalDateForLocale('2026-11-14', 'de-de', '2026-11-07')).to.equal('November 14');
            expect(formatLocalDateForLocale('2026-11-14', undefined, '2026-11-07')).to.equal('November 14');
            expect(formatLocalDateForLocale('not-a-date', 'es', '2026-11-07')).to.equal('not-a-date');
        });
    });
});
