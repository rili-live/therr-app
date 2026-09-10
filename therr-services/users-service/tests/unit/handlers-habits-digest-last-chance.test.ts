import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import runDailyHabitsDigest from '../../src/handlers/habitsDigest';

/**
 * Habits digest — per-user local scheduling and the evening "last chance" nudge.
 *
 * Two things land together here and only make sense together.
 *
 * The digest is poked once a day by a single Cloud Scheduler job at 14:00 UTC,
 * and every row it queued said `scheduledFor = now()`. So the comment it has
 * always carried — "run it in the evening" — was true in America/Chicago and
 * nowhere else: Berlin got its *morning* nudge at 16:00 and Auckland got
 * "check in before midnight" at 02:00, six hours after the midnight in
 * question. That is what `scheduledFor` and `settingsTimezone` fix.
 *
 * Having fixed it, a second slot becomes possible without a second scheduler
 * job (the free tier is 3 and all 3 are spoken for): the same run queues an
 * evening reminder for the user's own local evening. The reason that is not
 * simply "one more push per day" is the set of gates asserted below — a live
 * streak, the user's preferences, room in their local day, and a send-time
 * freshness check — and every one of them is a case where the correct output is
 * *no notification*. Those are the tests that matter most here.
 *
 * The clock is pinned. Every assertion about a delivery time is otherwise a
 * function of when the suite happens to run, which is the worst kind of flake:
 * it reads as a regression.
 */

// 14:00 UTC on a summer Wednesday — the hour the habits Cloud Scheduler job
// actually fires. 09:00 CDT, which is the fallback zone for a user with no
// stored timezone (i.e. everyone, until the mobile half ships).
const RUN_AT = new Date('2026-07-15T14:00:00.000Z');
const TODAY = '2026-07-15';

const USER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const GOAL = 'goal-1';

interface IEnqueueCall {
    userId: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, any>;
    scheduledFor?: Date;
}

/** Records `scheduledFor` too, which the other digest fakes have no reason to. */
const buildFakeQueue = () => {
    const inserted = new Set<string>();
    const calls: IEnqueueCall[] = [];

    sinon.stub(Store.notificationQueue, 'enqueue').callsFake((brand: any, args: any) => {
        calls.push({
            userId: args.userId,
            type: args.type,
            dedupeKey: args.dedupeKey,
            payload: args.payload || {},
            scheduledFor: args.scheduledFor,
        });
        const constraintKey = `${brand}|${args.userId}|${args.dedupeKey}`;
        if (inserted.has(constraintKey)) return Promise.resolve(undefined);
        inserted.add(constraintKey);
        return Promise.resolve({ id: `row-${inserted.size}` } as any);
    });

    return {
        calls,
        ofType: (type: string) => calls.filter((call) => call.type === type),
    };
};

const habitRow = (overrides: Record<string, any> = {}) => ({
    userId: USER,
    habitGoalId: GOAL,
    goalName: 'Morning run',
    frequencyType: 'daily',
    frequencyCount: 1,
    targetDaysOfWeek: null,
    // A live streak by default: without one there is nothing to lose, and the
    // evening escalation is deliberately not sent.
    currentStreak: 12,
    streakIsActive: true,
    gracePeriodDays: 0,
    graceDaysUsed: 0,
    lastCompletedDate: null,
    completedToday: false,
    activePactId: null,
    ...overrides,
});

const stubDigest = (preferences: Record<string, any> = {}, habits = [habitRow()]) => {
    sinon.stub(Store.pacts, 'getExpiredPacts').resolves([] as any);
    sinon.stub(Store.pacts, 'expire').resolves({} as any);
    sinon.stub(Store.pacts, 'get').resolves([] as any);
    sinon.stub(Store.pactMembers, 'getByPactId').resolves([] as any);
    sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Morning run' } as any);
    sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Alex' }] as any);
    sinon.stub(Store.habitCheckins, 'getByUserAndDate').resolves([] as any);
    sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(null as any);
    sinon.stub(Store.userHabits, 'getActiveForReminders').resolves(habits as any);

    sinon.stub(Store.users, 'getHabitReminderPreferences')
        .resolves(Object.keys(preferences).length ? { [USER]: { id: USER, ...preferences } } : {} as any);
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

/** The wall-clock hour a queued row lands on, in the given zone. */
const localHourOf = (timeZone: string, at?: Date): number => {
    if (!at) throw new Error('expected a scheduledFor');
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, hour12: false, hour: '2-digit', minute: '2-digit',
    }).formatToParts(at);
    const lookup: Record<string, number> = {};
    parts.forEach((part) => { if (part.type !== 'literal') lookup[part.type] = Number(part.value); });
    return (lookup.hour === 24 ? 0 : lookup.hour) + lookup.minute / 60;
};

describe('Habits digest — local scheduling and the last-chance nudge', () => {
    let queue: ReturnType<typeof buildFakeQueue>;
    let clock: sinon.SinonFakeTimers;
    const originalFlag = process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED;

    beforeEach(() => {
        // `toFake: ['Date']` only. Faking timers as well would stall the
        // handler's own promise chain, and nothing here depends on them.
        clock = sinon.useFakeTimers({ now: RUN_AT.getTime(), toFake: ['Date'] });
        delete process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED;
        delete process.env.HABIT_PHASE_ENGINE_ENABLED;
        queue = buildFakeQueue();
    });

    afterEach(() => {
        clock.restore();
        sinon.restore();
        if (originalFlag === undefined) {
            delete process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED;
        } else {
            process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED = originalFlag;
        }
    });

    describe('per-user local delivery times', () => {
        it('schedules the morning nudge for the user\'s local morning instead of the digest\'s hour', () => {
            stubDigest({ settingsTimezone: 'Europe/Berlin' });

            return runDigest().then(() => {
                const [morning] = queue.ofType('streak-at-risk');
                // 14:00 UTC is 16:00 in Berlin — 08:00 has gone, so the rule is
                // "as soon as possible", not "tomorrow": deferring a full day
                // would make the streak count stale before it was ever sent.
                expect(localHourOf('Europe/Berlin', morning.scheduledFor)).to.equal(16);
            });
        });

        it('waits for the end of quiet hours rather than pushing at 02:00 local', () => {
            stubDigest({ settingsTimezone: 'Pacific/Auckland' });

            return runDigest().then(() => {
                const [morning] = queue.ofType('streak-at-risk');
                // This is the case the feature exists for. Before it, this row
                // said `scheduledFor = now()` and the user was woken up.
                expect(localHourOf('Pacific/Auckland', morning.scheduledFor)).to.equal(8);
            });
        });

        it('falls back to the digest\'s own zone for a user with no stored timezone', () => {
            stubDigest();

            return runDigest().then((counters) => {
                const [morning] = queue.ofType('streak-at-risk');
                // 09:00 CDT — exactly where this notification landed before any
                // of this existed. A user we know nothing about must not move.
                expect(localHourOf('America/Chicago', morning.scheduledFor)).to.equal(9);
                expect(counters.usersWithoutTimezone).to.equal(1);
            });
        });
    });

    describe('the evening last-chance nudge', () => {
        it('queues one for the user\'s local evening, carrying what the send-time gate needs', () => {
            stubDigest({ settingsTimezone: 'America/Chicago' });

            return runDigest().then((counters) => {
                const lastChance = queue.ofType('evening-check-in');
                expect(lastChance).to.have.length(1);
                expect(localHourOf('America/Chicago', lastChance[0].scheduledFor)).to.equal(19.5);
                expect(counters.lastChanceSent).to.equal(1);

                // Stamped with the goals it covers and the local date it lands
                // on, which is what lets the worker drop it if the user checks
                // in between now and this evening.
                expect(lastChance[0].payload.habitGoalIds).to.deep.equal([GOAL]);
                expect(lastChance[0].payload.checkinDate).to.equal(TODAY);
                // Copy needs the streak it is about to lose, not just a name.
                expect(lastChance[0].payload.streakCount).to.equal(12);
            });
        });

        it('keys on the digest run, so a second run of the day queues nothing', () => {
            stubDigest({ settingsTimezone: 'America/Chicago' });

            return runDigest()
                .then(() => runDigest())
                .then((secondRun) => {
                    expect(queue.ofType('evening-check-in')).to.have.length(2);
                    expect(queue.ofType('evening-check-in')[0].dedupeKey).to.equal(`last-chance:${TODAY}`);
                    // Both attempts, one insert: the UNIQUE constraint absorbed
                    // the repeat, which is what makes a manual re-run safe.
                    expect(secondRun.lastChanceSent).to.equal(0);
                    expect(secondRun.deduped).to.be.greaterThan(0);
                });
        });

        it('sends nothing extra to a user with no live streak', () => {
            // The gate that keeps this from being a second generic reminder.
            // Loss aversion is the whole justification for a second push in a
            // day; someone at zero has nothing to lose and gets one nudge.
            stubDigest(
                { settingsTimezone: 'America/Chicago' },
                [habitRow({ currentStreak: 0, streakIsActive: false })],
            );

            return runDigest().then((counters) => {
                expect(queue.ofType('daily-habit-reminder')).to.have.length(1);
                expect(queue.ofType('evening-check-in')).to.have.length(0);
                expect(counters.lastChanceSkippedNoStreak).to.equal(1);
                expect(counters.lastChanceSent).to.equal(0);
            });
        });

        it('sends nothing extra once the user\'s local day is over', () => {
            // Tokyo is at 23:00 when the digest runs. "Check in before
            // midnight", delivered tomorrow morning, is worse than silence.
            stubDigest({ settingsTimezone: 'Asia/Tokyo' });

            return runDigest().then((counters) => {
                expect(queue.ofType('evening-check-in')).to.have.length(0);
                expect(counters.lastChanceNotScheduled).to.equal(1);
                // The morning nudge still goes out, at the next hour the user
                // has agreed to hear from us.
                expect(queue.ofType('streak-at-risk')).to.have.length(1);
            });
        });

        it('respects settingsPushStreakAlerts without silencing the ordinary reminder', () => {
            // The narrower of the two columns: "fewer of these", not "none".
            stubDigest({ settingsTimezone: 'America/Chicago', settingsPushStreakAlerts: false });

            return runDigest().then((counters) => {
                expect(queue.ofType('streak-at-risk')).to.have.length(1);
                expect(queue.ofType('evening-check-in')).to.have.length(0);
                expect(counters.lastChanceMutedByPreference).to.equal(1);
            });
        });

        it('respects settingsPushHabitReminders by sending neither slot', () => {
            // Both columns have been real, defaulted-true and completely unread
            // since the habits schema landed — a settings surface that did
            // nothing. This is the first code that honours them.
            stubDigest({ settingsTimezone: 'America/Chicago', settingsPushHabitReminders: false });

            return runDigest().then((counters) => {
                expect(queue.calls).to.have.length(0);
                expect(counters.remindersMutedByPreference).to.equal(1);
                expect(counters.streakAtRiskSent).to.equal(0);
            });
        });

        it('is disabled entirely by HABIT_LAST_CHANCE_REMINDERS_ENABLED=false', () => {
            // The one lever that reverses the volume increase without a deploy.
            process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED = 'false';
            stubDigest({ settingsTimezone: 'America/Chicago' });

            return runDigest().then((counters) => {
                expect(queue.ofType('evening-check-in')).to.have.length(0);
                expect(counters.lastChanceSent).to.equal(0);
                // Local scheduling of the morning slot is untouched by the flag.
                expect(queue.ofType('streak-at-risk')).to.have.length(1);
            });
        });

        it('keeps the morning nudge working when the preferences read fails', () => {
            // Degrade, never abort: an empty map means the fallback zone and
            // the default quiet hours, which is what every run before this did.
            sinon.stub(Store.pacts, 'getExpiredPacts').resolves([] as any);
            sinon.stub(Store.pacts, 'expire').resolves({} as any);
            sinon.stub(Store.pacts, 'get').resolves([] as any);
            sinon.stub(Store.pactMembers, 'getByPactId').resolves([] as any);
            sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Morning run' } as any);
            sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Alex' }] as any);
            sinon.stub(Store.habitCheckins, 'getByUserAndDate').resolves([] as any);
            sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(null as any);
            sinon.stub(Store.userHabits, 'getActiveForReminders').resolves([habitRow()] as any);
            sinon.stub(Store.users, 'getHabitReminderPreferences').rejects(new Error('read pool exhausted'));

            return runDigest().then((counters) => {
                expect(queue.ofType('streak-at-risk')).to.have.length(1);
                expect(localHourOf('America/Chicago', queue.ofType('streak-at-risk')[0].scheduledFor)).to.equal(9);
                // Counted as a fault, not folded into `deduped` — a degraded
                // run and a healthy one must not look alike.
                expect(counters.errors).to.equal(1);
            });
        });
    });
});
