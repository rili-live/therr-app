import { expect } from 'chai';
import {
    buildPactMemberStats,
    countScheduledCheckins,
    getPactStatsWindow,
} from '../../src/utilities/pactMemberStats';
import { isHabitDueToday } from '../../src/utilities/streakHelpers';

/**
 * Pact progress statistics — regression tests.
 *
 * The progress-comparison card on the pact detail screen rendered zeros for
 * every member because `habits.pact_members`' stat columns are only written
 * from the check-in handler's `if (pactId)` branch and no client sends a
 * pactId. Stats are now derived from the pact's date window plus the habit's
 * cadence, so these tests pin the window and denominator math.
 */
describe('pactMemberStats', () => {
    describe('getPactStatsWindow', () => {
        it('returns null for a pact that has not started (no startDate)', () => {
            expect(getPactStatsWindow({ startDate: null, endDate: null }, '2026-08-03')).to.equal(null);
            expect(getPactStatsWindow(undefined, '2026-08-03')).to.equal(null);
        });

        it('returns null for a pact scheduled to start in the future', () => {
            const result = getPactStatsWindow({
                startDate: '2026-09-01',
                endDate: '2026-10-01',
            }, '2026-08-03');
            expect(result).to.equal(null);
        });

        it('clamps an in-flight pact to today so unelapsed days are not counted as misses', () => {
            const result = getPactStatsWindow({
                startDate: '2026-08-01',
                endDate: '2026-08-31',
            }, '2026-08-03');
            expect(result).to.deep.equal({ startDate: '2026-08-01', endDate: '2026-08-03' });
        });

        it('keeps the pact endDate once the pact is over', () => {
            const result = getPactStatsWindow({
                startDate: '2026-07-01',
                endDate: '2026-07-31',
            }, '2026-08-03');
            expect(result).to.deep.equal({ startDate: '2026-07-01', endDate: '2026-07-31' });
        });

        it('measures through today when endDate is missing', () => {
            const result = getPactStatsWindow({ startDate: '2026-08-01' }, '2026-08-03');
            expect(result).to.deep.equal({ startDate: '2026-08-01', endDate: '2026-08-03' });
        });

        it('counts the first day of a pact that started today', () => {
            const result = getPactStatsWindow({
                startDate: '2026-08-03',
                endDate: '2026-09-02',
            }, '2026-08-03');
            expect(result).to.deep.equal({ startDate: '2026-08-03', endDate: '2026-08-03' });
        });
    });

    describe('countScheduledCheckins', () => {
        it('counts every day for a daily habit, inclusive of both ends', () => {
            expect(countScheduledCheckins('2026-08-01', '2026-08-03', { frequencyType: 'daily' })).to.equal(3);
            expect(countScheduledCheckins('2026-08-01', '2026-08-01', { frequencyType: 'daily' })).to.equal(1);
        });

        it('defaults to daily when the goal has no cadence', () => {
            expect(countScheduledCheckins('2026-08-01', '2026-08-07', null)).to.equal(7);
        });

        it('counts only target weekdays for a fixed-day weekly habit', () => {
            // 2026-08-03 is a Monday; Mon/Wed/Fri over a full week is 3.
            const result = countScheduledCheckins('2026-08-03', '2026-08-09', {
                frequencyType: 'weekly',
                targetDaysOfWeek: [1, 3, 5],
            });
            expect(result).to.equal(3);
        });

        it('counts only the target weekdays that have elapsed in a partial week', () => {
            // Mon 2026-08-03 through Wed 2026-08-05 covers Mon and Wed.
            const result = countScheduledCheckins('2026-08-03', '2026-08-05', {
                frequencyType: 'weekly',
                targetDaysOfWeek: [1, 3, 5],
            });
            expect(result).to.equal(2);
        });

        it('prorates an X-times-per-week habit by whole weeks', () => {
            expect(countScheduledCheckins('2026-08-01', '2026-08-14', {
                frequencyType: 'weekly',
                frequencyCount: 3,
            })).to.equal(6);
        });

        it('never schedules more X-per-week check-ins than there are days', () => {
            expect(countScheduledCheckins('2026-08-01', '2026-08-02', {
                frequencyType: 'weekly',
                frequencyCount: 5,
            })).to.equal(2);
        });

        it('returns 0 for an inverted range', () => {
            expect(countScheduledCheckins('2026-08-05', '2026-08-01', { frequencyType: 'daily' })).to.equal(0);
        });

        it('honours an explicit weekday schedule on a custom goal, not just a weekly one', () => {
            // The migration documents targetDaysOfWeek as "for custom schedules",
            // and nothing server-side pairs it with a particular frequencyType.
            // Keying the weekday branch on frequencyType === 'weekly' scored this
            // goal against all 7 days, capping a perfectly-kept 3x/week habit at a
            // 43% completion rate. Mon 2026-08-03 through Sun 2026-08-09.
            expect(countScheduledCheckins('2026-08-03', '2026-08-09', {
                frequencyType: 'custom',
                targetDaysOfWeek: [1, 3, 5],
            })).to.equal(3);
        });

        it('prorates a custom X-times-per-week goal instead of demanding one a day', () => {
            expect(countScheduledCheckins('2026-08-01', '2026-08-14', {
                frequencyType: 'custom',
                frequencyCount: 3,
            })).to.equal(6);
        });

        it('agrees with isHabitDueToday on which days a fixed-schedule habit is scored', () => {
            // The two must not drift: this is the denominator of the completion
            // rate, isHabitDueToday decides whether the habit is nudged, and a
            // habit reminded on a cadence it is not scored against reads to the
            // user as the app moving the goalposts.
            const goal = { frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] };
            // 2026-08-03 (Mon) .. 2026-08-09 (Sun), counted independently.
            const dueDays = [
                '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
                '2026-08-07', '2026-08-08', '2026-08-09',
            ].filter((day) => isHabitDueToday(goal, day)).length;

            expect(countScheduledCheckins('2026-08-03', '2026-08-09', goal)).to.equal(dueDays);
        });
    });

    describe('buildPactMemberStats', () => {
        it('reports a real completion rate rather than the always-100% counter ratio', () => {
            const stats = buildPactMemberStats({
                scheduledCount: 10,
                completedCheckins: 7,
                streak: { currentStreak: 3, longestStreak: 5 },
            });
            expect(stats).to.deep.equal({
                totalCheckins: 10,
                completedCheckins: 7,
                currentStreak: 3,
                longestStreak: 5,
                completionRate: 70,
                checkedInToday: false,
            });
        });

        it('rounds the completion rate to two decimals to fit the decimal(5,2) column', () => {
            const stats = buildPactMemberStats({ scheduledCount: 3, completedCheckins: 1 });
            expect(stats.completionRate).to.equal(33.33);
        });

        it('never reports above 100% when a user out-paces the cadence', () => {
            const stats = buildPactMemberStats({ scheduledCount: 3, completedCheckins: 7 });
            expect(stats.totalCheckins).to.equal(7);
            expect(stats.completionRate).to.equal(100);
        });

        // The pact card renders this to show who has and has not shown up
        // today. It defaults to false so a caller that has not resolved it —
        // the zeroed pending-pact path — cannot accidentally imply a member
        // checked in.
        it('defaults checkedInToday to false and carries it through when given', () => {
            expect(buildPactMemberStats({ scheduledCount: 1, completedCheckins: 1 }).checkedInToday).to.equal(false);
            expect(buildPactMemberStats({
                scheduledCount: 1,
                completedCheckins: 1,
                checkedInToday: true,
            }).checkedInToday).to.equal(true);
        });

        it('zeroes out cleanly when nothing is scheduled yet', () => {
            const stats = buildPactMemberStats({ scheduledCount: 0, completedCheckins: 0 });
            expect(stats).to.deep.equal({
                totalCheckins: 0,
                completedCheckins: 0,
                currentStreak: 0,
                longestStreak: 0,
                completionRate: 0,
                checkedInToday: false,
            });
        });

        it('coerces streak values that Postgres may hand back as strings', () => {
            const stats = buildPactMemberStats({
                scheduledCount: 4,
                completedCheckins: 4,
                streak: { currentStreak: '4', longestStreak: '9' },
            });
            expect(stats.currentStreak).to.equal(4);
            expect(stats.longestStreak).to.equal(9);
        });

        it('treats a missing streak row as a zero streak', () => {
            const stats = buildPactMemberStats({ scheduledCount: 2, completedCheckins: 1, streak: null });
            expect(stats.currentStreak).to.equal(0);
            expect(stats.longestStreak).to.equal(0);
            expect(stats.completionRate).to.equal(50);
        });
    });
});
