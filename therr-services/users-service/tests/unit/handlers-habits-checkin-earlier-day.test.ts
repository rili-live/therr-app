import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { createCheckin } from '../../src/handlers/habitCheckins';

/**
 * `POST /habits/checkins` for a day *before* the per-habit streak's last completion.
 *
 * The streak-credit path used to be guarded only by "is this the streak's last completed
 * date". That recognises a re-save of the latest day and nothing else, so two ordinary
 * situations ran the whole credit path for a day the streak had already moved past:
 *
 *   - re-saving an older check-in (a note added to yesterday after checking in today, or a
 *     retried request that lands after the next day's check-in) — the row was already
 *     credited, and it was credited again: +1 streak, and pact `totalCheckins` inflated;
 *   - a first completion for an earlier day (a backdated or queued check-in).
 *
 * Both also wrote that earlier day to `lastCompletedDate`, moving it backwards. The next real
 * check-in then measured its gap from the earlier day, found "missed" days that had in fact
 * been checked in, and spent a freeze or reset the streak.
 */

const USER_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const GOAL_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const PACT_ID = 'cccccccc-0000-4000-8000-00000000000c';
const STREAK_ID = 'dddddddd-0000-4000-8000-00000000000d';

const shiftDays = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

// The test user's zone is UTC, so the server's "today" for them is the UTC date.
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = shiftDays(TODAY, -1);
const TWO_DAYS_AGO = shiftDays(TODAY, -2);

const buildRes = () => {
    const captured: { statusCode?: number; body?: any } = {};
    return {
        captured,
        res: {
            status: (statusCode: number) => {
                captured.statusCode = statusCode;
                return { send: (payload: any) => { captured.body = payload; return payload; } };
            },
        } as any,
    };
};

const callHandler = async (scheduledDate: string) => {
    const { captured, res } = buildRes();
    await createCheckin({
        headers: { 'x-userid': USER_ID, 'x-localecode': 'en-us', 'x-brand-variation': BrandVariations.HABITS },
        body: { habitGoalId: GOAL_ID, status: 'completed', scheduledDate },
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('createCheckin — a day before the streak\'s last completion', () => {
    let incrementStreak: sinon.SinonStub;
    let resetStreak: sinon.SinonStub;
    let useGraceDay: sinon.SinonStub;
    let recordCompletion: sinon.SinonStub;
    let recordMilestone: sinon.SinonStub;
    let incrementCheckinStats: sinon.SinonStub;
    let markContributed: sinon.SinonStub;
    let updatePactStreak: sinon.SinonStub;
    let createPactStreakDay: sinon.SinonStub;

    const setup = ({
        checkinDate,
        contributedToStreak,
        streak,
        pacts = [] as any[],
    }: {
        checkinDate: string;
        contributedToStreak: boolean;
        streak: Record<string, any>;
        pacts?: any[];
    }) => {
        sinon.stub(Store.habitGoals, 'getById').resolves({ id: GOAL_ID, goalType: 'build_good', frequencyType: 'daily' } as any);
        sinon.stub(Store.pacts, 'getActiveByUserAndHabitGoal').resolves(pacts);
        sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves({ id: 'uh-1', habitGoalId: GOAL_ID, status: 'active' } as any);
        sinon.stub(Store.userHabits, 'getOrCreate').resolves({ id: 'uh-1' } as any);
        sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').resolves({} as any);
        sinon.stub(Store.users, 'getUserById').resolves([{ id: USER_ID, settingsTimezone: 'UTC' }] as any);
        sinon.stub(Store.users, 'findUser').resolves([] as any);
        sinon.stub(Store.habitCheckins, 'createOrUpdate').resolves({
            id: 'checkin-1',
            userId: USER_ID,
            habitGoalId: GOAL_ID,
            scheduledDate: checkinDate,
            localDate: checkinDate,
            status: 'completed',
            contributedToStreak,
        } as any);
        markContributed = sinon.stub(Store.habitCheckins, 'update').resolves({} as any);
        sinon.stub(Store.habitCheckins, 'getByUserAndDateRange').resolves([]);
        sinon.stub(Store.habitCheckins, 'countCompletedActiveMembersForPact').resolves(2);

        sinon.stub(Store.streaks, 'getOrCreate').resolves({ id: STREAK_ID, ...streak } as any);
        sinon.stub(Store.streaks, 'getById').resolves({ id: STREAK_ID, ...streak } as any);
        incrementStreak = sinon.stub(Store.streaks, 'incrementStreak').resolves({} as any);
        resetStreak = sinon.stub(Store.streaks, 'resetStreak').resolves({} as any);
        useGraceDay = sinon.stub(Store.streaks, 'useGraceDay').resolves({} as any);
        recordCompletion = sinon.stub(Store.streaks, 'recordCompletion').resolves({} as any);
        recordMilestone = sinon.stub(Store.streaks, 'recordMilestone').resolves({} as any);
        sinon.stub(Store.streaks, 'recordMissed').resolves({} as any);
        sinon.stub(Store.streaks, 'recordGraceUsed').resolves({} as any);

        sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves({ id: 'member-1', status: 'active' } as any);
        sinon.stub(Store.pactMembers, 'getByPactId').resolves([] as any);
        sinon.stub(Store.pactMembers, 'getByPactIds').resolves([] as any);
        sinon.stub(Store.pactMembers, 'countActiveByPactId').resolves(2);
        incrementCheckinStats = sinon.stub(Store.pactMembers, 'incrementCheckinStats').resolves({} as any);
        sinon.stub(Store.pactMembers, 'updateCompletionRate').resolves({} as any);
        sinon.stub(Store.pactStreakDays, 'countCoveredDatesForPacts').resolves(0);
        createPactStreakDay = sinon.stub(Store.pactStreakDays, 'create').resolves({ id: 'psd-1' } as any);
        updatePactStreak = sinon.stub(Store.pacts, 'updatePactStreak').resolves({} as any);

        // Everything after the per-habit streak — XP, achievements, the app-level daily streak —
        // is best-effort and swallows its own failures. Failing them fast keeps this test on the
        // decisions it is about rather than modelling the daily-streak ledger.
        sinon.stub(Store.userDailyStreaks, 'getOrCreate').rejects(new Error('not under test'));
        sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([] as any);
    };

    afterEach(() => {
        sinon.restore();
    });

    it('does not re-credit an older check-in that is saved again after a later day', async () => {
        setup({
            checkinDate: YESTERDAY,
            contributedToStreak: true,
            streak: {
                currentStreak: 7, longestStreak: 7, lastCompletedDate: TODAY, gracePeriodDays: 2, graceDaysUsed: 0,
            },
        });

        const captured = await callHandler(YESTERDAY);

        expect(captured.statusCode).to.equal(201);
        expect(incrementStreak.called, 'credited a check-in the streak already counted').to.equal(false);
        expect(recordCompletion.called).to.equal(false);
        expect(incrementCheckinStats.called, 'inflated pact check-in stats').to.equal(false);
        expect(useGraceDay.called).to.equal(false);
        expect(resetStreak.called).to.equal(false);
    });

    it('counts a first completion for an earlier day without moving the streak backwards', async () => {
        setup({
            checkinDate: TWO_DAYS_AGO,
            contributedToStreak: false,
            // Sitting exactly on a milestone: an earlier day must not re-announce it.
            streak: {
                currentStreak: 7, longestStreak: 7, lastCompletedDate: TODAY, gracePeriodDays: 2, graceDaysUsed: 0,
            },
        });

        const captured = await callHandler(TWO_DAYS_AGO);

        expect(captured.statusCode).to.equal(201);
        expect(incrementStreak.called, 'wrote an earlier day as the streak\'s last completion').to.equal(false);
        expect(recordCompletion.called).to.equal(false);
        expect(recordMilestone.called, 're-fired the milestone for an unchanged streak').to.equal(false);
        expect(useGraceDay.called).to.equal(false);
        expect(resetStreak.called).to.equal(false);
        // Still a real check-in: marked so a later re-save is recognised as already counted.
        expect(markContributed.calledWith('checkin-1', { contributedToStreak: true })).to.equal(true);
    });

    it('records an earlier pact day in the ledger without moving the pact streak backwards', async () => {
        setup({
            checkinDate: TWO_DAYS_AGO,
            contributedToStreak: false,
            streak: {
                currentStreak: 3, longestStreak: 3, lastCompletedDate: TODAY, gracePeriodDays: 1, graceDaysUsed: 0,
            },
            pacts: [{
                id: PACT_ID,
                habitGoalId: GOAL_ID,
                status: 'active',
                currentPactStreak: 3,
                longestPactStreak: 3,
                lastPactStreakDate: TODAY,
            }],
        });

        const captured = await callHandler(TWO_DAYS_AGO);

        expect(captured.statusCode).to.equal(201);
        expect(createPactStreakDay.calledOnce, 'the day the group won is still recorded').to.equal(true);
        expect(updatePactStreak.called, 'moved lastPactStreakDate backwards').to.equal(false);
        // A first completion is still a check-in for the pact's stats.
        expect(incrementCheckinStats.calledOnce).to.equal(true);
    });

    it('still credits the next day as normal (control)', async () => {
        setup({
            checkinDate: TODAY,
            contributedToStreak: false,
            streak: {
                currentStreak: 4, longestStreak: 4, lastCompletedDate: YESTERDAY, gracePeriodDays: 1, graceDaysUsed: 0,
            },
        });

        const captured = await callHandler(TODAY);

        expect(captured.statusCode).to.equal(201);
        expect(incrementStreak.calledOnceWith(STREAK_ID, TODAY)).to.equal(true);
        expect(recordCompletion.calledOnce).to.equal(true);
    });
});
