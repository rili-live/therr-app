import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { isDailyStreakAtStakeToday } from '../../src/utilities/dailyStreak';
import { getIsAtStakeToday, IDailyStreakView } from '../../src/handlers/helpers/dailyStreak';

/**
 * `isAtStakeToday` on GET /habits/daily-streak/me feeds the Friends with Habits home-screen
 * streak widget's evening warning. It must agree with the verdict tonight's evaluator will write:
 * a rest day is never at stake, so it goes through the evaluator's own required-dates rule
 * rather than "nothing logged yet today", which would warn a weekly-quota user on a day that
 * costs them nothing.
 */
describe('Daily streak — isDailyStreakAtStakeToday', () => {
    it('is at stake only with a live streak, today unsettled, and today required', () => {
        expect(isDailyStreakAtStakeToday({ currentStreak: 5, todayStatus: 'pending', isTodayRequired: true })).to.equal(true);
        expect(isDailyStreakAtStakeToday({ currentStreak: 5, todayStatus: 'upheld', isTodayRequired: true })).to.equal(false);
        expect(isDailyStreakAtStakeToday({ currentStreak: 5, todayStatus: 'pending', isTodayRequired: false })).to.equal(false);
        expect(isDailyStreakAtStakeToday({ currentStreak: 0, todayStatus: 'pending', isTodayRequired: true })).to.equal(false);
    });

    it('treats a missing status for today as unsettled', () => {
        expect(isDailyStreakAtStakeToday({ currentStreak: 2, todayStatus: undefined, isTodayRequired: true })).to.equal(true);
    });
});

describe('Daily streak — getIsAtStakeToday', () => {
    const userId = 'user-1';
    // A Thursday: Thu–Sun is four days, so a 4x/week habit with nothing done yet needs today and
    // a 3x/week one does not.
    const today = '2026-10-01';
    const startedAt = new Date('2026-09-01T00:00:00Z');

    let cadences: sinon.SinonStub;
    let completions: sinon.SinonStub;

    const view = (currentStreak: number, todayStatus: string): IDailyStreakView => ({
        currentStreak,
        longestStreak: currentStreak,
        today,
        week: [
            {
                date: '2026-09-30', dow: 2, status: 'upheld', isToday: false,
            },
            {
                date: today, dow: 3, status: todayStatus as any, isToday: true,
            },
        ],
        pendingCelebration: null,
    });

    const habit = (fields: Partial<{ frequencyType: string; frequencyCount: number; targetDaysOfWeek: number[] }>) => ({
        habitGoalId: `goal-${Math.random()}`,
        startedAt,
        frequencyType: 'daily',
        frequencyCount: null,
        targetDaysOfWeek: null,
        cadenceEffectiveFrom: null,
        ...fields,
    });

    beforeEach(() => {
        cadences = sinon.stub(Store.userHabits, 'getActiveCadencesByUser');
        completions = sinon.stub(Store.habitCheckins, 'getCompletedHabitLocalDates').resolves([]);
    });

    afterEach(() => sinon.restore());

    it('is at stake on an unsettled day a daily habit requires', async () => {
        cadences.resolves([habit({ frequencyType: 'daily' })]);
        expect(await getIsAtStakeToday(userId, view(5, 'pending'))).to.equal(true);
    });

    it('is not at stake on a day only a weekly quota with room to spare covers', async () => {
        cadences.resolves([habit({ frequencyType: 'weekly', frequencyCount: 3 })]);
        expect(await getIsAtStakeToday(userId, view(5, 'pending'))).to.equal(false);
    });

    it('is at stake once a weekly quota has no later day left to meet it', async () => {
        cadences.resolves([habit({ frequencyType: 'weekly', frequencyCount: 4 })]);
        expect(await getIsAtStakeToday(userId, view(5, 'pending'))).to.equal(true);
    });

    it('follows fixed weekdays (0 = Sunday, so Thursday is 4)', async () => {
        cadences.resolves([habit({ frequencyType: 'weekly', targetDaysOfWeek: [1, 3] })]);
        expect(await getIsAtStakeToday(userId, view(5, 'pending'))).to.equal(false);

        cadences.resolves([habit({ frequencyType: 'weekly', targetDaysOfWeek: [4] })]);
        expect(await getIsAtStakeToday(userId, view(5, 'pending'))).to.equal(true);
    });

    it('skips the cadence read when today is already upheld or there is no streak', async () => {
        cadences.resolves([habit({ frequencyType: 'daily' })]);

        expect(await getIsAtStakeToday(userId, view(5, 'upheld'))).to.equal(false);
        expect(await getIsAtStakeToday(userId, view(0, 'pending'))).to.equal(false);
        expect(cadences.called).to.equal(false);
        expect(completions.called).to.equal(false);
    });

    it('rejects when the cadence read fails, for the summary to catch', async () => {
        cadences.rejects(new Error('db down'));

        let caught: Error | undefined;
        await getIsAtStakeToday(userId, view(5, 'pending')).catch((err) => { caught = err; });
        expect(caught?.message).to.equal('db down');
    });
});
