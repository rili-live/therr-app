import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import runDailyHabitsDigest from '../../src/handlers/habitsDigest';

/**
 * The pact loop's two cadence-blind notifications.
 *
 * `partnerMissedDay` and the pact-driven `streakAtRisk` had no cadence gate at all — the
 * reminder pass was the only place in the digest that honoured `frequencyType`. For a pact on a
 * "4x per week" habit that meant, on each of the three off days:
 *
 *   - every member was told their partner had "missed" a day the habit never asked for, and
 *   - every member was warned their streak was on the line when it was not.
 *
 * The first is the more corrosive of the two, because it is both wrong and sent to somebody
 * else. These tests pin both gates, and pin that a daily pact is completely unaffected.
 *
 * The clock is pinned: every assertion here depends on which weekday "today" is and on how much
 * of the Monday–Sunday week has already elapsed, so a real clock would make the suite pass or
 * fail depending on the day it runs.
 */

// A Saturday. Monday of this week is 2026-09-14, so Mon–Thu are all strictly before "yesterday"
// (Friday) — which lets a 4x/week quota be fully met without contradicting the fixture below,
// where nobody checked in yesterday or today.
const RUN_AT = new Date('2026-09-19T14:00:00.000Z');
const MONDAY = '2026-09-14';
const TUESDAY = '2026-09-15';
const WEDNESDAY = '2026-09-16';
const THURSDAY = '2026-09-17';

const PACT_ID = 'pact-1';
const HABIT_GOAL_ID = 'habit-goal-1';
const MEMBER_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const MEMBER_B = 'bbbbbbbb-0000-4000-8000-00000000000b';

interface IEnqueueCall {
    userId: string;
    type: string;
    dedupeKey: string;
}

const buildFakeQueue = () => {
    const calls: IEnqueueCall[] = [];
    sinon.stub(Store.notificationQueue, 'enqueue').callsFake((_brand: any, args: any) => {
        calls.push({ userId: args.userId, type: args.type, dedupeKey: args.dedupeKey });
        return Promise.resolve({ id: `row-${calls.length}` } as any);
    });
    return {
        calls,
        typesSent: () => Array.from(new Set(calls.map((c) => c.type))).sort(),
    };
};

/**
 * @param goal the habit goal row, which is where cadence lives
 * @param completedDates the days both members completed this week (neither checked in yesterday
 *        or today, which is what makes the two notifications candidates at all)
 */
const stubDigestReads = (goal: Record<string, any>, completedDates: string[]) => {
    process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED = 'false';

    sinon.stub(Store.pacts, 'getExpiredPacts').resolves([] as any);
    sinon.stub(Store.pacts, 'expire').resolves({} as any);
    sinon.stub(Store.pacts, 'get').resolves([{
        id: PACT_ID,
        habitGoalId: HABIT_GOAL_ID,
        status: 'active',
        // Well outside the 3-day warning window, so pactExpiring stays out of the way.
        endDate: new Date(RUN_AT.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
    }] as any);

    sinon.stub(Store.pactMembers, 'getByPactId').resolves([MEMBER_A, MEMBER_B].map((userId) => ({
        userId,
        status: 'active',
        joinedAt: '2026-01-01T00:00:00.000Z',
    }))) as any;

    sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Morning run', ...goal } as any);

    // Nobody checked in yesterday or today — the precondition for both notifications.
    sinon.stub(Store.habitCheckins, 'getByUserAndDate').resolves([] as any);
    // The week's tally behind the cadence decision.
    sinon.stub(Store.habitCheckins, 'getByUserAndDateRange').resolves(
        completedDates.map((scheduledDate) => ({ status: 'completed', scheduledDate })) as any,
    );

    // A live streak, so streakAtRisk is a candidate on cadence grounds alone.
    sinon.stub(Store.streaks, 'getByUserAndHabit').resolves({ isActive: true, currentStreak: 5 } as any);
    sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Alex' }] as any);
    sinon.stub(Store.users, 'getHabitReminderPreferences').resolves({} as any);
    sinon.stub(Store.userHabits, 'getActiveForReminders').resolves([] as any);
};

const runDigest = async () => {
    let body: any;
    const res: any = {
        status: () => ({ send: (payload: any) => { body = payload; return payload; } }),
    };
    await runDailyHabitsDigest(
        { headers: { 'x-brand-variation': 'habits', 'x-localecode': 'en-us' } } as any,
        res,
        (() => undefined) as any,
    );
    return body;
};

describe('Habits digest — cadence gates on the pact loop', () => {
    let clock: sinon.SinonFakeTimers;
    let queue: ReturnType<typeof buildFakeQueue>;

    beforeEach(() => {
        clock = sinon.useFakeTimers({ now: RUN_AT.getTime(), toFake: ['Date'] });
        queue = buildFakeQueue();
    });

    afterEach(() => {
        clock.restore();
        sinon.restore();
    });

    it('does not accuse a partner of missing a day their 4x/week habit never asked for', async () => {
        // Four check-ins Mon–Thu: the week's target is already met, so Friday was optional and
        // Saturday is optional too. Before the gate this queued a partnerMissedDay about Friday
        // to every other member.
        stubDigestReads(
            { frequencyType: 'weekly', frequencyCount: 4 },
            [MONDAY, TUESDAY, WEDNESDAY, THURSDAY],
        );

        const counters = await runDigest();

        expect(counters.partnerMissedSent).to.equal(0);
        expect(counters.errors).to.equal(0);
    });

    it('does not warn that a streak is at risk on a day the quota is already discharged', async () => {
        stubDigestReads(
            { frequencyType: 'weekly', frequencyCount: 4 },
            [MONDAY, TUESDAY, WEDNESDAY, THURSDAY],
        );

        const counters = await runDigest();

        expect(counters.streakAtRiskSent).to.equal(0);
        expect(queue.typesSent()).to.deep.equal([]);
    });

    it('still warns, and still reports the miss, once the week is behind', async () => {
        // Only Monday done against a target of 4. By Friday three days remained and three were
        // owed, so Friday WAS required — which is what the miss notification is about — and
        // Saturday is required too. The gate must not be a blanket silence.
        stubDigestReads({ frequencyType: 'weekly', frequencyCount: 4 }, [MONDAY]);

        const counters = await runDigest();

        expect(counters.streakAtRiskSent).to.equal(2);
        expect(counters.partnerMissedSent).to.equal(2);
    });

    it('leaves a daily pact exactly as it was', async () => {
        // The regression that matters most: nearly every pact in production is daily, and for
        // those `isRequiredOn` is unconditionally true, so both notifications must still fire.
        stubDigestReads({ frequencyType: 'daily' }, []);

        const counters = await runDigest();

        expect(counters.streakAtRiskSent).to.equal(2);
        // Two members, each missing yesterday, each reported to the one other member.
        expect(counters.partnerMissedSent).to.equal(2);
    });

    it('follows a fixed weekday schedule rather than a count', async () => {
        // Mon/Wed/Fri. Saturday is not one of their days, so no streak is at risk today — but
        // Friday was, and they skipped it, so the miss is real and worth reporting. The two
        // gates pointing in opposite directions on the same run is the useful part.
        stubDigestReads({ frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] }, [MONDAY, WEDNESDAY]);

        const counters = await runDigest();

        expect(counters.streakAtRiskSent).to.equal(0);
        expect(counters.partnerMissedSent).to.equal(2);
    });
});
