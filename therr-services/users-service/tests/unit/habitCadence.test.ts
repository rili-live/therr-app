import { expect } from 'chai';
import {
    getCadence,
    getWeeklyTarget,
    getDayOfWeekSundayFirst,
    getDaysRemainingInWeek,
    isRequiredOn,
    isQuotaUnmet,
    isPeriodSatisfied,
    countMissedPeriods,
    countScheduledForRange,
    computeRequiredDates,
    describeWeekProgress,
    hasCadenceChanged,
} from '../../src/utilities/habitCadence';
import { addDays as addDaysLocal } from '../../src/utilities/dailyStreak';

/**
 * The cadence rules, and specifically the one the feature exists for: a "4x per week, any days"
 * habit must be able to spend most of its week off-duty without spending a streak freeze.
 *
 * Weeks are Monday–Sunday. The dates below are a real week so the weekday assertions read
 * plainly:
 *   2026-09-14 Mon · 15 Tue · 16 Wed · 17 Thu · 18 Fri · 19 Sat · 20 Sun
 */
const MON = '2026-09-14';
const TUE = '2026-09-15';
const WED = '2026-09-16';
const THU = '2026-09-17';
const FRI = '2026-09-18';
const SAT = '2026-09-19';
const SUN = '2026-09-20';
const NEXT_MON = '2026-09-21';

describe('habitCadence', () => {
    describe('day-of-week helpers', () => {
        it('reads targetDaysOfWeek Sunday-first, matching the column', () => {
            expect(getDayOfWeekSundayFirst(SUN)).to.equal(0);
            expect(getDayOfWeekSundayFirst(MON)).to.equal(1);
            expect(getDayOfWeekSundayFirst(WED)).to.equal(3);
            expect(getDayOfWeekSundayFirst(SAT)).to.equal(6);
        });

        it('counts days remaining in a Monday-first week inclusively', () => {
            expect(getDaysRemainingInWeek(MON)).to.equal(7);
            expect(getDaysRemainingInWeek(THU)).to.equal(4);
            expect(getDaysRemainingInWeek(SUN)).to.equal(1);
        });
    });

    describe('getCadence', () => {
        it('defaults to daily', () => {
            expect(getCadence(null)).to.deep.equal({ kind: 'daily' });
            expect(getCadence({})).to.deep.equal({ kind: 'daily' });
            expect(getCadence({ frequencyType: 'daily' })).to.deep.equal({ kind: 'daily' });
        });

        it('lets an explicit weekday schedule win over frequencyType, in both directions', () => {
            expect(getCadence({ frequencyType: 'daily', targetDaysOfWeek: [1, 3, 5] }))
                .to.deep.equal({ kind: 'weekdays', days: [1, 3, 5] });
            expect(getCadence({ frequencyType: 'custom', targetDaysOfWeek: [2, 4] }))
                .to.deep.equal({ kind: 'weekdays', days: [2, 4] });
        });

        it('treats weekly and custom alike when no days are fixed', () => {
            expect(getCadence({ frequencyType: 'weekly', frequencyCount: 4 }))
                .to.deep.equal({ kind: 'weeklyQuota', count: 4 });
            expect(getCadence({ frequencyType: 'custom', frequencyCount: 3 }))
                .to.deep.equal({ kind: 'weeklyQuota', count: 3 });
        });

        it('degrades a malformed count to 1/week rather than dividing by zero or spamming', () => {
            expect(getCadence({ frequencyType: 'weekly', frequencyCount: 0 }))
                .to.deep.equal({ kind: 'weeklyQuota', count: 1 });
            expect(getCadence({ frequencyType: 'weekly', frequencyCount: -3 }))
                .to.deep.equal({ kind: 'weeklyQuota', count: 1 });
            expect(getCadence({ frequencyType: 'weekly', frequencyCount: null }))
                .to.deep.equal({ kind: 'weeklyQuota', count: 1 });
            expect(getCadence({ frequencyType: 'weekly', frequencyCount: 99 }))
                .to.deep.equal({ kind: 'weeklyQuota', count: 7 });
        });

        it('discards junk weekdays and de-duplicates the rest', () => {
            expect(getCadence({ targetDaysOfWeek: [3, 1, 3, 9, -1, 5] as any }))
                .to.deep.equal({ kind: 'weekdays', days: [1, 3, 5] });
            // Nothing survivable left → falls through to frequencyType.
            expect(getCadence({ frequencyType: 'daily', targetDaysOfWeek: [9, -1] as any }))
                .to.deep.equal({ kind: 'daily' });
        });
    });

    describe('getWeeklyTarget', () => {
        it('is 7 for daily, the schedule length for weekdays, the count for a quota', () => {
            expect(getWeeklyTarget({ kind: 'daily' })).to.equal(7);
            expect(getWeeklyTarget({ kind: 'weekdays', days: [1, 3, 5] })).to.equal(3);
            expect(getWeeklyTarget({ kind: 'weeklyQuota', count: 4 })).to.equal(4);
        });
    });

    describe('isRequiredOn — the rule the feature exists for', () => {
        const fourPerWeek = getCadence({ frequencyType: 'weekly', frequencyCount: 4 });

        it('a 4x/week user training Mon–Thu is never required on any day', () => {
            // Each day, the quota is still reachable in the days that remain, so skipping is free.
            expect(isRequiredOn(fourPerWeek, MON, 0)).to.equal(false); // 7 days left, 4 owed
            expect(isRequiredOn(fourPerWeek, TUE, 1)).to.equal(false); // 6 left, 3 owed
            expect(isRequiredOn(fourPerWeek, WED, 2)).to.equal(false); // 5 left, 2 owed
            expect(isRequiredOn(fourPerWeek, THU, 3)).to.equal(false); // 4 left, 1 owed
            // Quota met — the rest of the week is free outright.
            expect(isRequiredOn(fourPerWeek, FRI, 4)).to.equal(false);
            expect(isRequiredOn(fourPerWeek, SUN, 4)).to.equal(false);
        });

        it('a 4x/week user who has done nothing owes every day from Thursday on', () => {
            expect(isRequiredOn(fourPerWeek, MON, 0)).to.equal(false);
            expect(isRequiredOn(fourPerWeek, WED, 0)).to.equal(false); // 5 left, 4 owed
            expect(isRequiredOn(fourPerWeek, THU, 0)).to.equal(true); // 4 left, 4 owed
            expect(isRequiredOn(fourPerWeek, FRI, 1)).to.equal(true); // 3 left, 3 owed
            expect(isRequiredOn(fourPerWeek, SAT, 2)).to.equal(true);
            expect(isRequiredOn(fourPerWeek, SUN, 3)).to.equal(true);
        });

        it('a 4x/week user who did Mon/Tue then stopped owes Fri, Sat and Sun', () => {
            expect(isRequiredOn(fourPerWeek, WED, 2)).to.equal(false); // 5 left, 2 owed
            expect(isRequiredOn(fourPerWeek, THU, 2)).to.equal(false); // 4 left, 2 owed
            expect(isRequiredOn(fourPerWeek, FRI, 2)).to.equal(false); // 3 left, 2 owed
            expect(isRequiredOn(fourPerWeek, SAT, 2)).to.equal(true); // 2 left, 2 owed
            expect(isRequiredOn(fourPerWeek, SUN, 2)).to.equal(true);
        });

        it('is always true for daily and schedule-driven for fixed weekdays', () => {
            expect(isRequiredOn({ kind: 'daily' }, WED)).to.equal(true);
            expect(isRequiredOn({ kind: 'daily' }, SUN)).to.equal(true);
            expect(isRequiredOn({ kind: 'weekdays', days: [1, 3, 5] }, WED)).to.equal(true);
            expect(isRequiredOn({ kind: 'weekdays', days: [1, 3, 5] }, THU)).to.equal(false);
        });

        it('refuses to call an unparseable date required', () => {
            expect(isRequiredOn({ kind: 'daily' }, 'not-a-date')).to.equal(false);
        });
    });

    describe('isQuotaUnmet — the reminder gate', () => {
        const fourPerWeek = getCadence({ frequencyType: 'weekly', frequencyCount: 4 });

        it('keeps asking until the quota is met, then goes quiet for the rest of the week', () => {
            expect(isQuotaUnmet(fourPerWeek, MON, 0)).to.equal(true);
            expect(isQuotaUnmet(fourPerWeek, WED, 2)).to.equal(true);
            expect(isQuotaUnmet(fourPerWeek, THU, 4)).to.equal(false);
            expect(isQuotaUnmet(fourPerWeek, SUN, 4)).to.equal(false);
        });

        it('is the one gate that stays true where isRequiredOn is false', () => {
            // This divergence is the point: a required-days-only reminder would never nudge the
            // user who trains Mon–Thu, because they have no required days.
            expect(isRequiredOn(fourPerWeek, MON, 0)).to.equal(false);
            expect(isQuotaUnmet(fourPerWeek, MON, 0)).to.equal(true);
        });

        it('follows the schedule, not a count, for fixed weekdays', () => {
            expect(isQuotaUnmet({ kind: 'weekdays', days: [1, 3, 5] }, WED, 0)).to.equal(true);
            expect(isQuotaUnmet({ kind: 'weekdays', days: [1, 3, 5] }, THU, 0)).to.equal(false);
        });
    });

    describe('isPeriodSatisfied', () => {
        it('needs all seven days for daily', () => {
            const all = [MON, TUE, WED, THU, FRI, SAT, SUN];
            expect(isPeriodSatisfied({ kind: 'daily' }, MON, all)).to.equal(true);
            expect(isPeriodSatisfied({ kind: 'daily' }, MON, all.slice(0, 6))).to.equal(false);
        });

        it('needs every scheduled weekday for a fixed schedule, and ignores extras', () => {
            const cadence = { kind: 'weekdays' as const, days: [1, 3, 5] };
            expect(isPeriodSatisfied(cadence, MON, [MON, WED, FRI])).to.equal(true);
            expect(isPeriodSatisfied(cadence, MON, [MON, WED, FRI, SAT])).to.equal(true);
            expect(isPeriodSatisfied(cadence, MON, [MON, WED])).to.equal(false);
        });

        it('needs the count for a quota, on any days', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 4 };
            expect(isPeriodSatisfied(cadence, MON, [MON, WED, FRI, SUN])).to.equal(true);
            expect(isPeriodSatisfied(cadence, MON, [MON, TUE, WED, THU])).to.equal(true);
            expect(isPeriodSatisfied(cadence, MON, [MON, TUE, WED])).to.equal(false);
        });

        it('only counts dates inside the week it was asked about', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 2 };
            expect(isPeriodSatisfied(cadence, MON, [SUN, NEXT_MON])).to.equal(false);
        });
    });

    describe('countMissedPeriods', () => {
        it('matches the old daily behaviour exactly', () => {
            const daily = { kind: 'daily' as const };
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: MON })).to.equal(0);
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: TUE })).to.equal(0);
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: THU })).to.equal(2);
            expect(countMissedPeriods(daily, { lastCompletedDate: MON, throughDate: NEXT_MON })).to.equal(6);
        });

        it('counts only scheduled weekdays inside the gap for a fixed schedule', () => {
            const cadence = { kind: 'weekdays' as const, days: [1, 3, 5] };
            // Mon -> Fri: Wed is the only scheduled day strictly between.
            expect(countMissedPeriods(cadence, { lastCompletedDate: MON, throughDate: FRI })).to.equal(1);
            // Mon -> Wed: nothing scheduled strictly between.
            expect(countMissedPeriods(cadence, { lastCompletedDate: MON, throughDate: WED })).to.equal(0);
        });

        it('honours a fixed schedule regardless of frequencyType, which the old code did not', () => {
            // A `custom` goal with fixed days used to fall through to the daily branch and be
            // scored against all seven days.
            const cadence = getCadence({ frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] });
            expect(countMissedPeriods(cadence, { lastCompletedDate: MON, throughDate: FRI })).to.equal(1);
        });

        it('judges a quota by whole closed weeks, never the week in progress', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 4 };
            // Same week: nothing has closed, so nothing can be missed yet.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: MON,
                throughDate: SUN,
                completedDates: [MON],
            })).to.equal(0);

            // Last week closed with only 2 of 4 → one missed period.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: MON,
                throughDate: NEXT_MON,
                completedDates: [MON, TUE],
            })).to.equal(1);

            // Last week closed with all 4 → intact.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: THU,
                throughDate: NEXT_MON,
                completedDates: [MON, TUE, WED, THU],
            })).to.equal(0);
        });

        it('counts each unmet week separately across a long absence', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 3 };
            // Mon 2026-09-14 -> Mon 2026-10-05 is three closed weeks, none of them satisfied.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: MON,
                throughDate: '2026-10-05',
                completedDates: [MON],
            })).to.equal(3);
        });

        it('never reaches back past cadenceEffectiveFrom', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 4 };
            // The week of MON closed at 1 of 4, but the cadence only became authoritative on the
            // following Monday, so that week is not this cadence's to judge.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: MON,
                throughDate: NEXT_MON,
                completedDates: [MON],
                effectiveFrom: NEXT_MON,
            })).to.equal(0);
        });

        it('does not judge the week cadenceEffectiveFrom lands in partway', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 4 };
            // The cadence took effect on Thursday (a mid-week deploy, or a user's edit). Mon–Wed
            // were never under it, so that week cannot be held to 4. The first judged week is the
            // next full one, starting NEXT_MON, which has not closed yet on NEXT_MON itself.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: '2026-09-07',
                throughDate: NEXT_MON,
                completedDates: ['2026-09-07'],
                effectiveFrom: THU,
            })).to.equal(0);
            // A week later the first full week has closed unmet, and that one does count.
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: '2026-09-07',
                throughDate: '2026-09-28',
                completedDates: ['2026-09-07'],
                effectiveFrom: THU,
            })).to.equal(1);
        });

        it('is inert on unparseable input rather than inventing a miss', () => {
            expect(countMissedPeriods({ kind: 'daily' }, {
                lastCompletedDate: 'nope',
                throughDate: MON,
            })).to.equal(0);
        });
    });

    describe('countScheduledForRange', () => {
        it('is every day for daily', () => {
            expect(countScheduledForRange({ kind: 'daily' }, MON, SUN)).to.equal(7);
        });

        it('counts scheduled weekdays, so a perfect 3x/week habit scores 100% not 43%', () => {
            const cadence = { kind: 'weekdays' as const, days: [1, 3, 5] };
            expect(countScheduledForRange(cadence, MON, SUN)).to.equal(3);
            expect(countScheduledForRange(cadence, MON, NEXT_MON)).to.equal(4);
        });

        it('owes a partial week its full target, capped by the days available', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 4 };
            expect(countScheduledForRange(cadence, MON, SUN)).to.equal(4);
            expect(countScheduledForRange(cadence, MON, TUE)).to.equal(2); // capped at 2 days
            expect(countScheduledForRange(cadence, MON, NEXT_MON)).to.equal(8);
        });
    });

    describe('computeRequiredDates', () => {
        const fourPerWeek = getCadence({ frequencyType: 'weekly', frequencyCount: 4 });
        const daily = getCadence({ frequencyType: 'daily' });

        const completionsOn = (habitGoalId: string, dates: string[]) => dates.map((localDate) => ({
            habitGoalId,
            localDate,
        }));

        it('marks no day required for a 4x/week habit trained Mon–Thu', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: fourPerWeek }],
                fromDate: MON,
                upTo: SUN,
                completions: completionsOn('g1', [MON, TUE, WED, THU]),
            });

            expect(Array.from(required)).to.deep.equal([]);
        });

        it('marks the tail of the week required once the user has stalled', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: fourPerWeek }],
                fromDate: MON,
                upTo: SUN,
                completions: completionsOn('g1', [MON, TUE]),
            });

            expect(Array.from(required)).to.deep.equal([SAT, SUN]);
        });

        it('marks every day required for a daily habit', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: daily }],
                fromDate: MON,
                upTo: WED,
                completions: [],
            });

            expect(Array.from(required)).to.deep.equal([MON, TUE, WED]);
        });

        it('takes the union across habits — one daily habit makes every day required', () => {
            const required = computeRequiredDates({
                habits: [
                    { habitGoalId: 'g1', cadence: fourPerWeek },
                    { habitGoalId: 'g2', cadence: daily },
                ],
                fromDate: MON,
                upTo: WED,
                completions: completionsOn('g1', [MON, TUE, WED, THU]),
            });

            expect(Array.from(required)).to.deep.equal([MON, TUE, WED]);
        });

        it('keeps each habit\'s quota separate — another habit\'s check-ins do not count', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: fourPerWeek }],
                fromDate: SAT,
                upTo: SUN,
                // All four completions belong to a different habit.
                completions: completionsOn('g2', [MON, TUE, WED, THU]),
            });

            expect(Array.from(required)).to.deep.equal([SAT, SUN]);
        });

        it('never requires a day before the habit was started', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: daily, startedOn: WED }],
                fromDate: MON,
                upTo: THU,
                completions: [],
            });

            expect(Array.from(required)).to.deep.equal([WED, THU]);
        });

        it('never requires a day before the cadence took effect', () => {
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: daily, effectiveFrom: THU }],
                fromDate: MON,
                upTo: FRI,
                completions: [],
            });

            expect(Array.from(required)).to.deep.equal([THU, FRI]);
        });

        it('counts completions from earlier in the week even when the walk starts mid-week', () => {
            // The walk begins on Friday, but Mon–Thu already satisfied the quota, so the rest of
            // the week is free. Reading only the walk window would have made Fri–Sun required.
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: fourPerWeek }],
                fromDate: FRI,
                upTo: SUN,
                completions: completionsOn('g1', [MON, TUE, WED, THU]),
            });

            expect(Array.from(required)).to.deep.equal([]);
        });

        it('resets the quota at each Monday', () => {
            // A full previous week must not make the new week free.
            const required = computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: fourPerWeek }],
                fromDate: NEXT_MON,
                upTo: addDaysLocal(NEXT_MON, 6),
                completions: completionsOn('g1', [MON, TUE, WED, THU]),
            });

            expect(Array.from(required)).to.deep.equal([
                addDaysLocal(NEXT_MON, 3),
                addDaysLocal(NEXT_MON, 4),
                addDaysLocal(NEXT_MON, 5),
                addDaysLocal(NEXT_MON, 6),
            ]);
        });

        it('returns nothing for an inverted or unparseable range', () => {
            expect(computeRequiredDates({
                habits: [{ habitGoalId: 'g1', cadence: daily }],
                fromDate: SUN,
                upTo: MON,
                completions: [],
            }).size).to.equal(0);
        });
    });

    describe('describeWeekProgress', () => {
        it('reports what the copy and the progress chip need', () => {
            const cadence = { kind: 'weeklyQuota' as const, count: 4 };
            expect(describeWeekProgress(cadence, WED, 2)).to.deep.equal({
                done: 2,
                target: 4,
                daysLeft: 5,
                isRequiredToday: false,
                isMet: false,
            });
            expect(describeWeekProgress(cadence, SAT, 2)).to.deep.equal({
                done: 2,
                target: 4,
                daysLeft: 2,
                isRequiredToday: true,
                isMet: false,
            });
            expect(describeWeekProgress(cadence, FRI, 4)).to.deep.equal({
                done: 4,
                target: 4,
                daysLeft: 3,
                isRequiredToday: false,
                isMet: true,
            });
        });
    });
});

describe('hasCadenceChanged', () => {
    const existing = { frequencyType: 'weekly', frequencyCount: 4, targetDaysOfWeek: null };

    it('is false for an edit that leaves the cadence alone', () => {
        // Renaming must not stamp cadenceEffectiveFrom — that would put the whole gap beyond
        // evaluation and forgive every day missed in it.
        expect(hasCadenceChanged(existing, {})).to.equal(false);
        expect(hasCadenceChanged(existing, { frequencyType: 'weekly', frequencyCount: 4 })).to.equal(false);
    });

    it('is true when the meaning changes', () => {
        expect(hasCadenceChanged(existing, { frequencyCount: 3 })).to.equal(true);
        expect(hasCadenceChanged(existing, { frequencyType: 'daily' })).to.equal(true);
        expect(hasCadenceChanged(existing, { targetDaysOfWeek: [1, 3, 5] })).to.equal(true);
    });

    it('compares meaning, not spelling', () => {
        // Both resolve to the same Mon/Wed/Fri schedule — targetDaysOfWeek wins over frequencyType.
        expect(hasCadenceChanged(
            { frequencyType: 'weekly', targetDaysOfWeek: [5, 1, 3] },
            { frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] },
        )).to.equal(false);
    });
});
