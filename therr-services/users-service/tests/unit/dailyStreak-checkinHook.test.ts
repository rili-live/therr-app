import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { onCheckinCompleted } from '../../src/handlers/helpers/dailyStreak';

/**
 * The check-in hook must re-open (rewind) a day the evaluator has already finalized before
 * crediting it, rather than letting the live apply overwrite the ledger row. Yesterday is the
 * obvious case; today is one too whenever the scheduled pass judged the user's day in a zone
 * ahead of their real one (no saved `settingsTimezone`, device west of the America/Chicago
 * fallback): that pass marks today `frozen`/`missed` at ~22:00 local, and the user's
 * subsequent check-in must refund the freeze and undo the reset, not paper over them.
 */
describe('Daily streak — onCheckinCompleted rewinds finalized days', () => {
    const userId = 'user-1';
    const today = '2026-09-10';
    const yesterday = '2026-09-09';
    // THERR does not earn the dailyStreak class, so achievement awards no-op without a store.
    const headers = {
        'x-platform': 'mobile',
        'x-brand-variation': 'therr',
        'x-localecode': 'en-us',
        'x-userid': userId,
    } as any;

    let state: any;
    let deleteOnOrAfter: sinon.SinonStub;
    let refundGraceDay: sinon.SinonStub;
    let upsertMany: sinon.SinonStub;

    const yesterdayRow = {
        userId, localDate: yesterday, status: 'upheld', freezeHabitGoalId: null, streakAfter: 5,
    };

    const setup = (initialState: Partial<any>, todayRow?: any) => {
        state = {
            userId,
            currentStreak: 5,
            longestStreak: 5,
            lastUpheldDate: yesterday,
            lastEvaluatedDate: yesterday,
            lastCelebratedDate: null,
            consecutivePerfectWeeks: 0,
            lastResetFromStreak: 0,
            ...initialState,
        };
        sinon.stub(Store.userDailyStreaks, 'getOrCreate').callsFake(async () => ({ ...state }));
        sinon.stub(Store.userDailyStreaks, 'update').callsFake(async (_id, params) => {
            state = { ...state, ...params };
            return { ...state };
        });
        sinon.stub(Store.habitCheckins, 'countCompletedOnLocalDate').resolves(1);
        sinon.stub(Store.habitCheckins, 'getEarliestCompletedLocalDate').resolves(yesterday);
        sinon.stub(Store.habitCheckins, 'getCompletedLocalDates').resolves(new Set<string>());
        // The cadence reads behind rest days. They are not caught in production (a failure must
        // not excuse misses as rest), so an unstubbed one reaches the real database.
        sinon.stub(Store.habitCheckins, 'getCompletedHabitLocalDates').resolves([]);
        sinon.stub(Store.userHabits, 'getActiveCadencesByUser').resolves([]);
        sinon.stub(Store.streaks, 'getByUserId').resolves([]);
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves({ id: 'streak-1' });
        sinon.stub(Store.streaks, 'useGraceDay').resolves({});
        refundGraceDay = sinon.stub(Store.streaks, 'refundGraceDay').resolves({});
        sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        sinon.stub(Store.dailyStreakDays, 'getRange').callsFake(async (_id, start, end) => (
            start === yesterday && end === yesterday ? [yesterdayRow as any] : []
        ));
        sinon.stub(Store.dailyStreakDays, 'getLatestBefore').resolves(yesterdayRow as any);
        sinon.stub(Store.dailyStreakDays, 'getLatestUpheldBefore').resolves(yesterdayRow as any);
        deleteOnOrAfter = sinon.stub(Store.dailyStreakDays, 'deleteOnOrAfter').resolves(todayRow ? [todayRow] : []);
        upsertMany = sinon.stub(Store.dailyStreakDays, 'upsertMany').resolves();
    };

    afterEach(() => {
        sinon.restore();
    });

    it('re-opens today and refunds the freeze when the scheduled pass already finalized it as frozen', async () => {
        setup(
            { lastEvaluatedDate: today, lastUpheldDate: yesterday },
            {
                userId, localDate: today, status: 'frozen', freezeHabitGoalId: 'goal-1', streakAfter: 5,
            },
        );

        const result = await onCheckinCompleted({
            userId, localDate: today, today, headers,
        });

        expect(deleteOnOrAfter.calledOnceWith(userId, today)).to.equal(true);
        expect(refundGraceDay.calledOnceWith('streak-1')).to.equal(true);
        // The re-derived day is upheld, continuing yesterday's finalized streak.
        const upheldToday = upsertMany.getCalls()
            .flatMap((call) => call.args[0])
            .find((day: any) => day.localDate === today);
        expect(upheldToday?.status).to.equal('upheld');
        expect(upheldToday?.streakAfter).to.equal(6);
        expect(result?.currentStreak).to.equal(6);
        expect(result?.lastUpheldDate).to.equal(today);
    });

    it('does not rewind a today that is not finalized yet (the common path)', async () => {
        setup({ lastEvaluatedDate: yesterday, lastUpheldDate: yesterday });

        const result = await onCheckinCompleted({
            userId, localDate: today, today, headers,
        });

        expect(deleteOnOrAfter.called).to.equal(false);
        expect(refundGraceDay.called).to.equal(false);
        expect(result?.currentStreak).to.equal(6);
    });

    it('always rewinds a backdated check-in for yesterday', async () => {
        setup({ lastEvaluatedDate: yesterday, lastUpheldDate: yesterday });

        await onCheckinCompleted({
            userId, localDate: yesterday, today, headers,
        });

        expect(deleteOnOrAfter.calledOnceWith(userId, yesterday)).to.equal(true);
    });
});
