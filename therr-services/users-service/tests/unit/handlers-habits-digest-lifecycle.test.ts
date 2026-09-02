import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import runDailyHabitsDigest from '../../src/handlers/habitsDigest';
import { getTodayDateString } from '../../src/utilities/streakHelpers';

/**
 * Habits digest — the lifecycle engine's integration surface.
 *
 * The engine itself is unit-tested in habitPhaseEngine.test.ts. What is tested
 * here is everything the pure function cannot see: that the flag really gates
 * it, that a decision to taper actually suppresses the push, that persistence
 * follows *delivery* rather than intent, and that a user pursuing one habit
 * through two pacts is treated as one habit.
 *
 * The last two are the ones worth the file. Advancing a user's maintenance
 * stage after a failed enqueue silently consumes a check-in nobody ever
 * received, and double-processing a two-pact habit writes `lastComebackAt`
 * twice — neither shows up as an error anywhere, and both are invisible in
 * production until someone asks why a user stopped hearing from us.
 */

const TODAY = getTodayDateString();
const HABIT_GOAL_ID = 'habit-goal-1';
const OTHER_GOAL_ID = 'habit-goal-2';
const PACT_ID = 'pact-1';
const SECOND_PACT_ID = 'pact-2';
const USER = 'aaaaaaaa-0000-4000-8000-00000000000a';

/**
 * UTC end to end, deliberately. `TODAY` comes from `getTodayDateString`, which
 * is `toISOString()`-based, and the engine's `daysBetween` parses at UTC
 * midnight — so formatting these fixtures through `normalizeDateString` (which
 * renders the *local* calendar date) put every fixture a day early on any host
 * west of UTC once the clock passed local evening. The suite then failed only
 * after ~19:00 CDT, and never in CI, which runs UTC.
 */
const daysBefore = (days: number): string => new Date(
    Date.parse(`${TODAY}T00:00:00.000Z`) - (days * 24 * 60 * 60 * 1000),
).toISOString().slice(0, 10);

interface IEnqueueCall {
    userId: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, any>;
}

/** Mirrors the real ON CONFLICT DO NOTHING behaviour of the queue. */
const buildFakeQueue = (failTypes: string[] = []) => {
    const inserted = new Set<string>();
    const calls: IEnqueueCall[] = [];

    sinon.stub(Store.notificationQueue, 'enqueue').callsFake((brand: any, args: any) => {
        calls.push({
            userId: args.userId, type: args.type, dedupeKey: args.dedupeKey, payload: args.payload || {},
        });
        if (failTypes.includes(args.type)) {
            return Promise.reject(new Error('write pool exhausted'));
        }
        const constraintKey = `${brand}|${args.userId}|${args.dedupeKey}`;
        if (inserted.has(constraintKey)) return Promise.resolve(undefined);
        inserted.add(constraintKey);
        return Promise.resolve({ id: `row-${inserted.size}` } as any);
    });

    return {
        calls,
        typesQueued: () => calls.map((c) => c.type),
        ofType: (type: string) => calls.filter((c) => c.type === type),
    };
};

interface IPhaseFixture {
    phase?: string;
    establishedAt?: string | null;
    maintenanceStage?: number;
    lastComebackAt?: string | null;
}

interface IScenario {
    phase?: IPhaseFixture | null;
    firstCheckinDaysAgo?: number;
    shortWindowCompletions?: number;
    longWindowCompletions?: number;
    checkedInToday?: boolean;
    pacts?: { id: string; habitGoalId: string }[];
}

const phaseWrites: { id: string; update: Record<string, any> }[] = [];
const stageAdvances: { id: string; stage: number }[] = [];

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

    const {
        phase = null,
        firstCheckinDaysAgo = 40,
        shortWindowCompletions = 13,
        longWindowCompletions = 26,
        checkedInToday = false,
        pacts = [{ id: PACT_ID, habitGoalId: HABIT_GOAL_ID }],
    } = scenario;

    sinon.stub(Store.pacts, 'get').resolves(pacts.map((p) => ({
        id: p.id, habitGoalId: p.habitGoalId, status: 'active', endDate: null,
    })) as any);

    sinon.stub(Store.pactMembers, 'getByPactId').resolves([{
        userId: USER, status: 'active', joinedAt: '2026-01-01T00:00:00.000Z',
    }] as any);

    sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Morning run' } as any);
    sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Alex' }] as any);

    // No stored timezone or quiet hours — the default for every user in
    // production today, which sends both slots through the America/Chicago
    // fallback and keeps delivery exactly where it was before per-user
    // scheduling landed. See localReminderSchedule.test.ts for the zones.
    sinon.stub(Store.users, 'getHabitReminderPreferences').resolves({} as any);

    sinon.stub(Store.habitCheckins, 'getByUserAndDate')
        .callsFake((_u: any, date: any) => Promise.resolve(
            (checkedInToday && date === TODAY) ? [{ status: 'completed' }] as any : [],
        ));

    sinon.stub(Store.habitCheckins, 'getFirstCompletedDates').callsFake((pairs: any) => Promise.resolve(
        pairs.reduce((acc: any, p: any) => {
            acc[`${p.userId}:${p.habitGoalId}`] = daysBefore(firstCheckinDaysAgo - 1);
            return acc;
        }, {}),
    ));

    sinon.stub(Store.habitCheckins, 'getCompletedCountsForWindows').callsFake((targets: any) => Promise.resolve(
        targets.reduce((acc: any, t: any) => {
            acc[t.key] = t.key.startsWith('s:') ? shortWindowCompletions : longWindowCompletions;
            return acc;
        }, {}),
    ));

    sinon.stub(Store.habitPhases, 'getByUserHabitPairs').callsFake((pairs: any) => Promise.resolve(
        phase
            ? pairs.reduce((acc: any, p: any) => {
                acc[`${p.userId}:${p.habitGoalId}`] = {
                    id: `phase-${p.habitGoalId}`,
                    userId: p.userId,
                    habitGoalId: p.habitGoalId,
                    phase: phase.phase || 'forming',
                    establishedAt: phase.establishedAt ?? null,
                    automaticityAt: null,
                    maintenanceStage: phase.maintenanceStage ?? 0,
                    lapsedAt: null,
                    lastComebackAt: phase.lastComebackAt ?? null,
                };
                return acc;
            }, {})
            : {},
    ));

    sinon.stub(Store.habitPhases, 'getOrCreate')
        .callsFake((userId: any, habitGoalId: any) => Promise.resolve({ id: `phase-${habitGoalId}`, userId, habitGoalId } as any));
    sinon.stub(Store.habitPhases, 'update').callsFake((id: any, update: any) => {
        phaseWrites.push({ id, update });
        return Promise.resolve({ id } as any);
    });
    sinon.stub(Store.habitPhases, 'advanceMaintenanceStage').callsFake((id: any, stage: any) => {
        stageAdvances.push({ id, stage });
        return Promise.resolve(1);
    });

    // Reminder pass off for this fixture: the lifecycle assertions here are
    // about the pact-driven path, and a second source of pairs would change the
    // counts without changing what is under test.
    sinon.stub(Store.userHabits, 'getActiveForReminders').resolves([] as any);

    sinon.stub(Store.streaks, 'getByUserAndHabit').resolves({ isActive: true, currentStreak: 30 } as any);
    sinon.stub(Store.streaks, 'getByUserHabitPairs').resolves([
        { userId: USER, habitGoalId: HABIT_GOAL_ID, longestStreak: 42 },
        { userId: USER, habitGoalId: OTHER_GOAL_ID, longestStreak: 42 },
    ] as any);
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

describe('Habits digest — lifecycle engine', () => {
    const originalFlag = process.env.HABIT_PHASE_ENGINE_ENABLED;

    beforeEach(() => {
        phaseWrites.length = 0;
        stageAdvances.length = 0;
        process.env.HABIT_PHASE_ENGINE_ENABLED = 'true';
    });

    afterEach(() => {
        sinon.restore();
        process.env.HABIT_PHASE_ENGINE_ENABLED = originalFlag;
    });

    describe('the feature flag', () => {
        it('leaves the digest completely unchanged when off', async () => {
            process.env.HABIT_PHASE_ENGINE_ENABLED = 'false';
            const queue = buildFakeQueue();
            stubDigest();

            const counters = await runDigest();

            // The pre-existing behaviour: a live streak with no check-in today
            // gets nudged, every day, exactly as before this feature existed.
            expect(queue.typesQueued()).to.deep.equal(['streak-at-risk']);
            expect(counters.phasesEvaluated).to.equal(0);
            expect(counters.nudgesTapered).to.equal(0);
            expect(phaseWrites).to.have.length(0);
        });

        it('evaluates phases when on', async () => {
            buildFakeQueue();
            stubDigest();

            const counters = await runDigest();

            expect(counters.phasesEvaluated).to.equal(1);
        });
    });

    describe('establishing a habit', () => {
        it('celebrates the taper and suppresses the nudge on the same run', async () => {
            const queue = buildFakeQueue();
            stubDigest({ firstCheckinDaysAgo: 21, shortWindowCompletions: 13 });

            const counters = await runDigest();

            expect(queue.typesQueued()).to.deep.equal(['habit-established']);
            expect(counters.habitEstablishedSent).to.equal(1);
            // The milestone copy says we are easing off; sending the reminder it
            // disowns in the same breath would make that a lie.
            expect(counters.streakAtRiskSent).to.equal(0);
        });

        it('records the taper date as the maintenance anchor', async () => {
            buildFakeQueue();
            stubDigest({ firstCheckinDaysAgo: 21, shortWindowCompletions: 13 });

            await runDigest();

            expect(phaseWrites).to.have.length(1);
            expect(phaseWrites[0].update).to.include({
                phase: 'established',
                establishedAt: TODAY,
                maintenanceStage: 0,
            });
        });

        it('persists the consistency number the email will quote', async () => {
            // Cross-repo contract: therr-messaging-automator reads
            // `lastConsistencyPercent` off this row rather than recomputing it
            // from habits.habit_checkins. If this stops being written, the
            // maintenance email quietly starts quoting 0%.
            buildFakeQueue();
            stubDigest({ firstCheckinDaysAgo: 21, shortWindowCompletions: 13 });

            await runDigest();

            expect(phaseWrites[0].update.lastConsistencyPercent).to.equal(93);
        });

        it('carries the consistency that earned it into the payload', async () => {
            const queue = buildFakeQueue();
            stubDigest({ firstCheckinDaysAgo: 21, shortWindowCompletions: 14 });

            await runDigest();

            const [call] = queue.ofType('habit-established');
            expect(call.payload).to.include({ consistencyPercent: 100, dayCount: 21 });
        });

        it('does not establish a habit that is consistent but too young', async () => {
            const queue = buildFakeQueue();
            stubDigest({ firstCheckinDaysAgo: 20, shortWindowCompletions: 14 });

            await runDigest();

            expect(queue.typesQueued()).to.deep.equal(['streak-at-risk']);
            expect(phaseWrites).to.have.length(0);
        });
    });

    describe('the taper', () => {
        it('suppresses the nudge on an off-cadence day and counts it', async () => {
            const queue = buildFakeQueue();
            // Established 10 days ago: 10 % 3 !== 0, so today is not a nudge day.
            stubDigest({
                phase: { phase: 'established', establishedAt: daysBefore(10) },
                firstCheckinDaysAgo: 31,
                shortWindowCompletions: 12,
            });

            const counters = await runDigest();

            expect(queue.typesQueued()).to.deep.equal([]);
            expect(counters.nudgesTapered).to.equal(1);
            expect(counters.streakAtRiskSent).to.equal(0);
        });

        it('still nudges on an on-cadence day', async () => {
            const queue = buildFakeQueue();
            stubDigest({
                phase: { phase: 'established', establishedAt: daysBefore(9) },
                firstCheckinDaysAgo: 31,
                shortWindowCompletions: 12,
            });

            const counters = await runDigest();

            expect(queue.typesQueued()).to.deep.equal(['streak-at-risk']);
            expect(counters.nudgesTapered).to.equal(0);
        });

        it('stops nudging entirely once maintaining', async () => {
            const queue = buildFakeQueue();
            stubDigest({
                phase: { phase: 'maintaining', establishedAt: daysBefore(100), maintenanceStage: 90 },
                firstCheckinDaysAgo: 200,
                shortWindowCompletions: 13,
            });

            const counters = await runDigest();

            expect(queue.typesQueued()).to.deep.equal([]);
            expect(counters.nudgesTapered).to.equal(1);
        });
    });

    describe('maintenance check-ins', () => {
        it('queues the 30-day check-in and advances the stage', async () => {
            const queue = buildFakeQueue();
            const establishedAt = daysBefore(30);
            stubDigest({
                phase: { phase: 'established', establishedAt },
                firstCheckinDaysAgo: 51,
                shortWindowCompletions: 13,
            });

            const counters = await runDigest();

            expect(counters.maintenanceCheckInSent).to.equal(1);
            expect(queue.ofType('habit-maintenance-check-in')[0].dedupeKey)
                .to.equal(`habit-maintenance:${HABIT_GOAL_ID}:${establishedAt}:30`);
            expect(stageAdvances).to.deep.equal([{ id: `phase-${HABIT_GOAL_ID}`, stage: 30 }]);
        });

        it('is idempotent across two runs in the same day', async () => {
            const queue = buildFakeQueue();
            stubDigest({
                phase: { phase: 'established', establishedAt: daysBefore(30) },
                firstCheckinDaysAgo: 51,
                shortWindowCompletions: 13,
            });

            const first = await runDigest();
            const second = await runDigest();

            expect(first.maintenanceCheckInSent).to.equal(1);
            // Second run collides on the dedupe key and queues nothing new.
            expect(second.maintenanceCheckInSent).to.equal(0);
            expect(second.deduped).to.be.greaterThan(0);
            expect(queue.ofType('habit-maintenance-check-in')).to.have.length(2); // two attempts, one insert
        });

        it('does NOT advance the stage when the enqueue fails', async () => {
            // The invariant that matters most here: advancing on failure would
            // consume the user's one 30-day check-in without sending it, and
            // nothing downstream would ever notice.
            const queue = buildFakeQueue(['habit-maintenance-check-in']);
            stubDigest({
                phase: { phase: 'established', establishedAt: daysBefore(30) },
                firstCheckinDaysAgo: 51,
                shortWindowCompletions: 13,
            });

            const counters = await runDigest();

            expect(queue.ofType('habit-maintenance-check-in')).to.have.length(1);
            expect(counters.maintenanceCheckInSent).to.equal(0);
            expect(counters.errors).to.be.greaterThan(0);
            expect(stageAdvances).to.have.length(0);
        });
    });

    describe('lapse and comeback', () => {
        it('offers a comeback citing the user\'s best streak, not their failure', async () => {
            const queue = buildFakeQueue();
            stubDigest({
                phase: { phase: 'established', establishedAt: daysBefore(40) },
                firstCheckinDaysAgo: 61,
                shortWindowCompletions: 4, // 28% — well under the lapse bar
            });

            const counters = await runDigest();

            expect(counters.comebackSent).to.equal(1);
            expect(queue.ofType('habit-comeback')[0].payload).to.include({ bestStreakCount: 42 });
            // No nudge alongside it — the habit is lapsed, there is no streak to save.
            expect(counters.streakAtRiskSent).to.equal(0);
        });

        it('records the lapse and the comeback timestamp', async () => {
            buildFakeQueue();
            stubDigest({
                phase: { phase: 'established', establishedAt: daysBefore(40) },
                firstCheckinDaysAgo: 61,
                shortWindowCompletions: 4,
            });

            await runDigest();

            const updates = phaseWrites.map((w) => w.update);
            expect(updates.some((u) => u.phase === 'lapsed' && u.lapsedAt === TODAY)).to.equal(true);
            expect(updates.some((u) => u.lastComebackAt === TODAY)).to.equal(true);
        });

        it('does not re-offer a comeback inside the monthly window', async () => {
            const queue = buildFakeQueue();
            stubDigest({
                phase: { phase: 'lapsed', establishedAt: daysBefore(90), lastComebackAt: daysBefore(5) },
                firstCheckinDaysAgo: 120,
                shortWindowCompletions: 1,
            });

            const counters = await runDigest();

            expect(queue.ofType('habit-comeback')).to.have.length(0);
            expect(counters.comebackSent).to.equal(0);
        });
    });

    describe('one habit, two pacts', () => {
        it('produces a single lifecycle notification and a single phase write', async () => {
            // The lifecycle belongs to the habit, not the pact. Without the
            // per-run guard this queues one milestone per pact — the dedupe key
            // would stop the second *push*, but `lastComebackAt` and the
            // maintenance stage would still be written twice.
            const queue = buildFakeQueue();
            stubDigest({
                firstCheckinDaysAgo: 21,
                shortWindowCompletions: 13,
                pacts: [
                    { id: PACT_ID, habitGoalId: HABIT_GOAL_ID },
                    { id: SECOND_PACT_ID, habitGoalId: HABIT_GOAL_ID },
                ],
            });

            const counters = await runDigest();

            expect(counters.phasesEvaluated).to.equal(1);
            expect(queue.ofType('habit-established')).to.have.length(1);
            expect(phaseWrites).to.have.length(1);
        });

        it('treats two different habits as two lifecycles', async () => {
            const queue = buildFakeQueue();
            stubDigest({
                firstCheckinDaysAgo: 21,
                shortWindowCompletions: 13,
                pacts: [
                    { id: PACT_ID, habitGoalId: HABIT_GOAL_ID },
                    { id: SECOND_PACT_ID, habitGoalId: OTHER_GOAL_ID },
                ],
            });

            const counters = await runDigest();

            expect(counters.phasesEvaluated).to.equal(2);
            expect(queue.ofType('habit-established')).to.have.length(2);
        });
    });

    describe('the trailing windows', () => {
        // Regression: the window bounds were parsed as UTC midnight but
        // formatted as a *local* calendar date, so on any host west of UTC the
        // start dates came back a day early — 15- and 29-day windows counted
        // against 14- and 28-day denominators. That silently lowers the
        // establish gate, which is the one gate that spends the user's daily
        // reminders. The TZ is forced here so the test fails on the old code
        // regardless of the ambient timezone (CI runs UTC, where the bug is
        // invisible).
        const originalTz = process.env.TZ;

        afterEach(() => {
            if (originalTz === undefined) {
                delete process.env.TZ;
            } else {
                process.env.TZ = originalTz;
            }
        });

        ['UTC', 'America/Chicago', 'Asia/Tokyo'].forEach((tz) => {
            it(`spans exactly 14 and 28 days in ${tz}`, async () => {
                process.env.TZ = tz;
                buildFakeQueue();
                stubDigest();

                await runDigest();

                const targets = (Store.habitCheckins.getCompletedCountsForWindows as any).firstCall.args[0];
                const short = targets.find((t: any) => t.key.startsWith('s:'));
                const long = targets.find((t: any) => t.key.startsWith('l:'));

                // Inclusive bounds, so a 14-day window starts 13 days back.
                expect(short.startDate).to.equal(daysBefore(13));
                expect(short.endDate).to.equal(TODAY);
                expect(long.startDate).to.equal(daysBefore(27));
                expect(long.endDate).to.equal(TODAY);
            });
        });
    });

    describe('resilience', () => {
        it('falls back to un-tapered nudging when the lifecycle read fails', async () => {
            // Safe direction for a failure: over-remind rather than go silent on
            // someone who still needs the support.
            const queue = buildFakeQueue();
            stubDigest();
            (Store.habitPhases.getByUserHabitPairs as any).restore();
            sinon.stub(Store.habitPhases, 'getByUserHabitPairs').rejects(new Error('read pool down'));

            const counters = await runDigest();

            expect(queue.typesQueued()).to.deep.equal(['streak-at-risk']);
            expect(counters.phasesEvaluated).to.equal(0);
            expect(counters.nudgesTapered).to.equal(0);
        });
    });
});
