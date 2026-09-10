import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import runDailyHabitsDigest, { DIGEST_MAX_HABITS } from '../../src/handlers/habitsDigest';
import { getTodayDateString } from '../../src/utilities/streakHelpers';

/**
 * Habits digest — the daily reminder pass.
 *
 * The digest reached users only through `habits.pacts`, and only warned them
 * when a live streak was on the line. Two cohorts therefore received nothing at
 * all, indefinitely: someone tracking a habit solo, and someone whose streak
 * sits at zero. That is not a tuning problem — it is the reason a tester can
 * install the app, use it for a week and never see a push.
 *
 * These tests pin the four decisions that make the fix a reminder rather than
 * spam: reach the silent cohorts, stay off a habit that is not due today,
 * respect the lifecycle taper, and never follow a `streakAtRisk` with a generic
 * "get your streak going" for the same habit on the same day.
 */

const TODAY = getTodayDateString();
const SOLO_USER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PACT_USER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const SOLO_GOAL = 'goal-solo';
const PACT_GOAL = 'goal-pact';
const PACT_ID = 'pact-1';

interface IEnqueueCall {
    userId: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, any>;
}

const buildFakeQueue = () => {
    const inserted = new Set<string>();
    const calls: IEnqueueCall[] = [];

    sinon.stub(Store.notificationQueue, 'enqueue').callsFake((brand: any, args: any) => {
        calls.push({
            userId: args.userId, type: args.type, dedupeKey: args.dedupeKey, payload: args.payload || {},
        });
        const constraintKey = `${brand}|${args.userId}|${args.dedupeKey}`;
        if (inserted.has(constraintKey)) return Promise.resolve(undefined);
        inserted.add(constraintKey);
        return Promise.resolve({ id: `row-${inserted.size}` } as any);
    });

    return {
        calls,
        ofType: (type: string) => calls.filter((c) => c.type === type),
    };
};

const soloHabit = (overrides: Record<string, any> = {}) => ({
    userId: SOLO_USER,
    habitGoalId: SOLO_GOAL,
    goalName: 'Morning run',
    frequencyType: 'daily',
    frequencyCount: 1,
    targetDaysOfWeek: null,
    currentStreak: 0,
    streakIsActive: false,
    gracePeriodDays: 0,
    graceDaysUsed: 0,
    lastCompletedDate: null,
    completedToday: false,
    activePactId: null,
    ...overrides,
});

interface IScenario {
    habits?: Record<string, any>[];
    /** Active pacts the pact loop will walk. Empty by default. */
    pacts?: { id: string; habitGoalId: string; memberUserId: string }[];
    /** Streak the pact loop's per-member lookup returns. */
    pactStreak?: Record<string, any> | null;
}

const phaseWrites: { id: string; update: Record<string, any> }[] = [];

const stubDigest = (scenario: IScenario = {}) => {
    // The evening "last chance" slot is off for these suites. Whether it
    // produces a row depends on the wall-clock time in the recipient's zone, so
    // leaving it on would make every count below pass in the morning and fail
    // after 19:30 — the worst kind of flake, because it reads as a real
    // regression. It has its own file, which pins the clock:
    // handlers-habits-digest-last-chance.test.ts.
    //
    // Set here, per test, rather than in a mocha root hook: root hooks are
    // global across every file in the run, so one would fight the last-chance
    // suite's own setup depending on file order.
    process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED = 'false';

    const { habits = [soloHabit()], pacts = [], pactStreak = null } = scenario;

    sinon.stub(Store.pacts, 'getExpiredPacts').resolves([] as any);
    sinon.stub(Store.pacts, 'expire').resolves({} as any);
    sinon.stub(Store.pacts, 'get').resolves(pacts.map((p) => ({
        id: p.id, habitGoalId: p.habitGoalId, status: 'active', endDate: null,
    })) as any);
    sinon.stub(Store.pactMembers, 'getByPactId').callsFake((pactId: any) => Promise.resolve(
        pacts.filter((p) => p.id === pactId).map((p) => ({
            userId: p.memberUserId, status: 'active', joinedAt: '2026-01-01T00:00:00.000Z',
        })) as any,
    ));

    sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Evening reading' } as any);
    sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Alex' }] as any);

    // No stored timezone or quiet hours — the default for every user in
    // production today, which sends both slots through the America/Chicago
    // fallback and keeps delivery exactly where it was before per-user
    // scheduling landed. See localReminderSchedule.test.ts for the zones.
    sinon.stub(Store.users, 'getHabitReminderPreferences').resolves({} as any);
    // Nobody has checked in on either day, so the pact loop's own gates are open
    // and any suppression seen in these tests comes from the reminder pass.
    sinon.stub(Store.habitCheckins, 'getByUserAndDate').resolves([] as any);
    sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(pactStreak as any);

    sinon.stub(Store.userHabits, 'getActiveForReminders').resolves(habits as any);

    // Lifecycle reads. Inert unless HABIT_PHASE_ENGINE_ENABLED is set, but the
    // handler calls them either way once the flag is on, so they are stubbed
    // here rather than per test.
    sinon.stub(Store.habitPhases, 'getByUserHabitPairs').resolves({} as any);
    sinon.stub(Store.habitPhases, 'getOrCreate')
        .callsFake((userId: any, habitGoalId: any) => Promise.resolve({ id: `phase-${habitGoalId}`, userId, habitGoalId } as any));
    sinon.stub(Store.habitPhases, 'update').callsFake((id: any, update: any) => {
        phaseWrites.push({ id, update });
        return Promise.resolve({ id } as any);
    });
    sinon.stub(Store.habitPhases, 'advanceMaintenanceStage').resolves(1 as any);
    sinon.stub(Store.streaks, 'getByUserHabitPairs').resolves([] as any);
    sinon.stub(Store.habitCheckins, 'getFirstCompletedDates').callsFake((pairs: any) => Promise.resolve(
        pairs.reduce((acc: any, p: any) => {
            // 30 days of history — past the 21-day establish floor.
            acc[`${p.userId}:${p.habitGoalId}`] = new Date(
                Date.parse(`${TODAY}T00:00:00.000Z`) - (29 * 24 * 60 * 60 * 1000),
            ).toISOString().slice(0, 10);
            return acc;
        }, {}),
    ));
    sinon.stub(Store.habitCheckins, 'getCompletedCountsForWindows').callsFake((targets: any) => Promise.resolve(
        // 14/14 and 28/28 — clears both consistency gates.
        targets.reduce((acc: any, t: any) => {
            acc[t.key] = t.key.startsWith('s:') ? 14 : 28;
            return acc;
        }, {}),
    ));
};

const runDigest = async () => {
    let body: any;
    const res: any = { status: () => ({ send: (payload: any) => { body = payload; return payload; } }) };
    await runDailyHabitsDigest(
        { headers: { 'x-brand-variation': 'habits', 'x-localecode': 'en-us' } } as any,
        res,
        (() => undefined) as any,
    );
    return body;
};

describe('Habits digest — daily reminder pass', () => {
    let queue: ReturnType<typeof buildFakeQueue>;

    beforeEach(() => {
        delete process.env.HABIT_DAILY_REMINDERS_ENABLED;
        delete process.env.HABIT_PHASE_ENGINE_ENABLED;
        phaseWrites.length = 0;
        queue = buildFakeQueue();
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_DAILY_REMINDERS_ENABLED;
        delete process.env.HABIT_PHASE_ENGINE_ENABLED;
    });

    it('reminds a user tracking a habit with no pact at all — the cohort that previously got nothing', async () => {
        stubDigest();

        const counters = await runDigest();

        const reminders = queue.ofType('daily-habit-reminder');
        expect(reminders).to.have.length(1);
        expect(reminders[0].userId).to.equal(SOLO_USER);
        expect(reminders[0].payload.habitName).to.equal('Morning run');
        // The row outlives the request, so send-time locale travels with it.
        expect(reminders[0].payload.locale).to.equal('en-us');
        expect(counters.dailyRemindersSent).to.equal(1);
        expect(counters.habitsEvaluated).to.equal(1);
        expect(counters.errors).to.equal(0);
    });

    it('reminds a user whose streak is at zero, which streakAtRisk deliberately never does', async () => {
        stubDigest({
            habits: [soloHabit({ currentStreak: 0, streakIsActive: false })],
        });

        await runDigest();

        expect(queue.ofType('daily-habit-reminder')).to.have.length(1);
        expect(queue.ofType('streak-at-risk')).to.have.length(0);
    });

    it('sends the streak-aware message instead when a solo habit has a live streak', async () => {
        stubDigest({
            habits: [soloHabit({
                currentStreak: 12, streakIsActive: true, gracePeriodDays: 2, graceDaysUsed: 1,
            })],
        });

        await runDigest();

        expect(queue.ofType('daily-habit-reminder')).to.have.length(0);
        const atRisk = queue.ofType('streak-at-risk');
        expect(atRisk).to.have.length(1);
        expect(atRisk[0].payload.streakCount).to.equal(12);
        // Names the safety net the app actually holds, rather than overstating
        // the threat — same rule the pact-backed path follows.
        expect(atRisk[0].payload.freezesRemaining).to.equal(1);
    });

    it('writes a period-stamped dedupe key, so a second run of the day queues nothing', async () => {
        stubDigest();

        const first = await runDigest();
        const second = await runDigest();

        // One key per user per day, not per habit: the roll-up is what stops a
        // user with four habits receiving four near-identical pushes.
        expect(queue.ofType('daily-habit-reminder')[0].dedupeKey)
            .to.equal(`checkin-nudge:${TODAY}`);
        expect(first.dailyRemindersSent).to.equal(1);
        // Attempted again, inserted nothing — which is what makes a manual
        // re-run or an overlapping scheduler firing safe.
        expect(second.dailyRemindersSent).to.equal(0);
        expect(second.deduped).to.equal(1);
    });

    it('stays quiet on a day the habit is not scheduled', async () => {
        // Target only the weekday *after* today, so today is always an off day.
        const tomorrowDow = (new Date(`${TODAY}T00:00:00.000Z`).getUTCDay() + 1) % 7;
        stubDigest({
            habits: [soloHabit({ frequencyType: 'weekly', targetDaysOfWeek: [tomorrowDow] })],
        });

        const counters = await runDigest();

        expect(queue.ofType('daily-habit-reminder')).to.have.length(0);
        expect(counters.remindersNotDue).to.equal(1);
    });

    it('stays quiet on a habit already checked in today', async () => {
        stubDigest({ habits: [soloHabit({ completedToday: true })] });

        const counters = await runDigest();

        expect(queue.calls).to.have.length(0);
        expect(counters.dailyRemindersSent).to.equal(0);
        // Read and considered, not silently absent — the distinction that tells
        // "nothing to do" apart from "the pass never ran".
        expect(counters.habitsEvaluated).to.equal(1);
    });

    it('does not follow a pact streak warning with a generic reminder for the same habit', async () => {
        stubDigest({
            pacts: [{ id: PACT_ID, habitGoalId: PACT_GOAL, memberUserId: PACT_USER }],
            pactStreak: { isActive: true, currentStreak: 9 },
            habits: [soloHabit({
                userId: PACT_USER,
                habitGoalId: PACT_GOAL,
                currentStreak: 9,
                streakIsActive: true,
                activePactId: PACT_ID,
            })],
        });

        await runDigest();

        // Exactly one message about this habit today, and it is the stronger one.
        expect(queue.ofType('streak-at-risk')).to.have.length(1);
        expect(queue.ofType('streak-at-risk')[0].dedupeKey).to.equal(`checkin-nudge:${TODAY}`);
        expect(queue.ofType('daily-habit-reminder')).to.have.length(0);
        // The habit reached the accumulator through the pact loop, so the row
        // carries the pact id — the deep link target the reminder pass alone
        // could not supply.
        expect(queue.ofType('streak-at-risk')[0].payload.pactId).to.equal(PACT_ID);
        expect(queue.ofType('streak-at-risk')[0].payload.habitCount).to.equal(1);
    });

    it('evaluates the lifecycle of a solo habit even on a day it was checked in', async () => {
        // The day a habit crosses the establish gate is usually a day the user
        // checked in. Gating the lifecycle on `completedToday` — the way the
        // reminder itself is gated — would withhold the milestone from exactly
        // the run that earned it, and leave habits.habit_phases un-advanced
        // with it. Solo habits reach the engine through no other path.
        process.env.HABIT_PHASE_ENGINE_ENABLED = 'true';
        stubDigest({ habits: [soloHabit({ completedToday: true })] });

        await runDigest();

        expect(queue.ofType('habit-established')).to.have.length(1);
        expect(queue.ofType('daily-habit-reminder')).to.have.length(0);
        expect(phaseWrites).to.have.length(1);
    });

    it('respects the taper: an established habit stops getting the daily nudge', async () => {
        process.env.HABIT_PHASE_ENGINE_ENABLED = 'true';
        stubDigest({ habits: [soloHabit()] });

        const counters = await runDigest();

        // The phase engine's whole purpose is to reduce send volume as a habit
        // sticks. A reminder pass that ignored it would add a new daily message
        // on top of the taper and quietly undo it.
        expect(counters.nudgesTapered).to.be.greaterThan(0);
        expect(queue.ofType('daily-habit-reminder')).to.have.length(0);
    });

    it('queues nothing when the kill switch is set', async () => {
        process.env.HABIT_DAILY_REMINDERS_ENABLED = 'false';
        stubDigest();

        const counters = await runDigest();

        expect(queue.calls).to.have.length(0);
        expect(counters.habitsEvaluated).to.equal(0);
    });

    it('does not raise the cap flag on an ordinary run', async () => {
        stubDigest({ habits: [soloHabit()] });

        const counters = await runDigest();

        expect(counters.habitsCapped).to.equal(false);
        expect(counters.pactsCapped).to.equal(false);
    });

    it('flags the run when the habit read comes back at the limit', async () => {
        // The query orders by startedAt ASC, so a full page means the habits that
        // fell off the end are the most recently started — new users, exactly who
        // the reminder pass exists to retain. Without this flag that tail goes dark
        // silently: counters keep rising, nothing errors, the run looks healthy.
        const habits = Array.from({ length: DIGEST_MAX_HABITS }, (_, i) => soloHabit({
            userId: `user-${i}`,
            habitGoalId: `goal-${i}`,
        }));
        stubDigest({ habits });

        const counters = await runDigest();

        expect(counters.habitsEvaluated).to.equal(DIGEST_MAX_HABITS);
        expect(counters.habitsCapped).to.equal(true);
    });
});
