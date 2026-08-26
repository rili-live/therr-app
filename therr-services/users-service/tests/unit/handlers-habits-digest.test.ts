import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import runDailyHabitsDigest from '../../src/handlers/habitsDigest';
import { getTodayDateString, normalizeDateString } from '../../src/utilities/streakHelpers';

/**
 * Habits daily digest — dedup, proven by running it twice.
 *
 * The digest used to send inline, which made "at most once per day" a property
 * of there being exactly one Cloud Scheduler job rather than of the code — a
 * convention root CLAUDE.md had to carry as a standing warning. It now queues
 * through `enqueueNotification`, so the guarantee is the UNIQUE
 * (brandVariation, userId, dedupeKey) constraint on `main.notificationQueue`.
 *
 * That only holds if every dedupe key the handler writes is stamped with the
 * period it belongs to and with everything else that makes the notification
 * distinct. Both are easy to get wrong in a way nothing else notices: a key
 * containing `Date.now()` silently disables dedup, and a key that omits the
 * member who missed silently *over*-dedupes, swallowing a real second
 * notification. So these tests run the real handler twice against a fake queue
 * that enforces the same constraint Postgres does, and assert on the keys.
 */

const TODAY = getTodayDateString();
const YESTERDAY = normalizeDateString(new Date(Date.now() - (24 * 60 * 60 * 1000)));

const PACT_ID = 'pact-1';
const HABIT_GOAL_ID = 'habit-goal-1';
// A slips, B slips, C is up to date. Three members is the minimum that
// distinguishes a per-slipping-member key from a per-pact one: C must receive a
// notification about A *and* one about B.
const MEMBER_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const MEMBER_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const MEMBER_C = 'cccccccc-0000-4000-8000-00000000000c';

interface IEnqueueCall {
    brand: string;
    userId: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, any>;
}

/**
 * Stands in for NotificationQueueStore.enqueue, including the part that
 * matters: ON CONFLICT DO NOTHING against (brandVariation, userId, dedupeKey),
 * which returns no row for a duplicate. `calls` records every *attempt* so a
 * second run can be told apart from a run that decided to notify nothing.
 */
const buildFakeQueue = () => {
    const inserted = new Set<string>();
    const calls: IEnqueueCall[] = [];

    const stub = sinon.stub(Store.notificationQueue, 'enqueue')
        .callsFake((brand: any, args: any) => {
            calls.push({
                brand: String(brand),
                userId: args.userId,
                type: args.type,
                dedupeKey: args.dedupeKey,
                payload: args.payload || {},
            });
            const constraintKey = `${brand}|${args.userId}|${args.dedupeKey}`;
            if (inserted.has(constraintKey)) {
                return Promise.resolve(undefined);
            }
            inserted.add(constraintKey);
            return Promise.resolve({ id: `row-${inserted.size}` } as any);
        });

    return {
        stub,
        calls,
        insertedCount: () => inserted.size,
        callsSince: (index: number) => calls.slice(index),
    };
};

const stubDigestReads = () => {
    // The expiry sweep runs before the active-pact read. Nothing is past its
    // endDate in this fixture, so the sweep is a no-op here — it has its own
    // tests below.
    sinon.stub(Store.pacts, 'getExpiredPacts').resolves([] as any);
    sinon.stub(Store.pacts, 'expire').resolves({} as any);

    sinon.stub(Store.pacts, 'get').resolves([{
        id: PACT_ID,
        habitGoalId: HABIT_GOAL_ID,
        status: 'active',
        // Inside the 3-day warning window, so pactExpiring fires too.
        endDate: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString(),
    }] as any);

    sinon.stub(Store.pactMembers, 'getByPactId').resolves([MEMBER_A, MEMBER_B, MEMBER_C].map((userId) => ({
        userId,
        status: 'active',
        // Well before yesterday, so nobody is exempted as a brand-new member.
        joinedAt: '2026-01-01T00:00:00.000Z',
    }))) as any;

    sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Morning run' } as any);

    // A and B checked in on neither day; C is current on both.
    sinon.stub(Store.habitCheckins, 'getByUserAndDate')
        .callsFake((userId: any) => Promise.resolve(
            userId === MEMBER_C ? [{ status: 'completed' }] as any : [],
        ));

    sinon.stub(Store.streaks, 'getByUserAndHabit')
        .resolves({ isActive: true, currentStreak: 5 } as any);

    sinon.stub(Store.users, 'findUser').resolves([{ firstName: 'Alex' }] as any);

    // The daily-reminder pass reads its own spine off habits.user_habits. This
    // fixture is about the pact-driven half, so it contributes nothing —
    // handlers-habits-digest-reminders.test.ts covers the pass itself.
    sinon.stub(Store.userHabits, 'getActiveForReminders').resolves([] as any);
};

const runDigest = async (headers: Record<string, string> = { 'x-brand-variation': 'habits', 'x-localecode': 'en-us' }) => {
    let body: any;
    const res: any = {
        status: () => ({ send: (payload: any) => { body = payload; return payload; } }),
    };
    await runDailyHabitsDigest({ headers } as any, res, (() => undefined) as any);
    return body;
};

describe('Habits digest — queues instead of sending', () => {
    let queue: ReturnType<typeof buildFakeQueue>;

    beforeEach(() => {
        queue = buildFakeQueue();
        stubDigestReads();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('queues every notification the run decides on, under the habits brand', async () => {
        const counters = await runDigest();

        // 3 x pactExpiring + 2 x streakAtRisk (C checked in today) + 4 x
        // partnerMissedDay (A and B each missed; two other members apiece).
        expect(queue.insertedCount()).to.equal(9);
        expect(counters.pactExpiringSent).to.equal(3);
        expect(counters.streakAtRiskSent).to.equal(2);
        expect(counters.partnerMissedSent).to.equal(4);
        expect(counters.deduped).to.equal(0);
        expect(counters.errors).to.equal(0);

        queue.calls.forEach((call) => {
            expect(call.brand, call.dedupeKey).to.equal(BrandVariations.HABITS);
        });
    });

    it('writes period-stamped dedupe keys with no time-varying component', async () => {
        await runDigest();

        const keysByType = queue.calls.reduce((acc: Record<string, string[]>, call) => {
            acc[call.type] = (acc[call.type] || []).concat(call.dedupeKey);
            return acc;
        }, {});

        expect(keysByType['pact-expiring']).to.deep.equal(Array(3).fill(`pact-expiring:${PACT_ID}:${TODAY}`));
        expect(keysByType['streak-at-risk']).to.deep.equal(Array(2).fill(`streak-at-risk:${PACT_ID}:${TODAY}`));
        // Keyed on who slipped, not on who hears about it — the recipient is
        // already half of the unique constraint.
        expect(new Set(keysByType['partner-missed-day'])).to.deep.equal(new Set([
            `partner-missed-day:${PACT_ID}:${MEMBER_A}:${YESTERDAY}`,
            `partner-missed-day:${PACT_ID}:${MEMBER_B}:${YESTERDAY}`,
        ]));

        // A key carrying a clock reading would be unique on every run, which
        // turns dedup off without failing anything else.
        queue.calls.forEach((call) => {
            expect(call.dedupeKey, call.dedupeKey).to.match(/^[a-z-]+:[\w-]+(:[\w-]+)?:\d{4}-\d{2}-\d{2}$/);
        });
    });

    it('tells the member who is current about both partners who slipped', async () => {
        await runDigest();

        const forMemberC = queue.calls.filter((call) => call.userId === MEMBER_C && call.type === 'partner-missed-day');
        // Two distinct notifications, not one — a key that omitted the slipping
        // member would collapse these into a single row.
        expect(forMemberC).to.have.length(2);
        expect(new Set(forMemberC.map((call) => call.dedupeKey)).size).to.equal(2);
    });

    it('carries the copy variables and the locale the worker needs on the payload', async () => {
        await runDigest();

        const streakRow = queue.calls.find((call) => call.type === 'streak-at-risk') as IEnqueueCall;
        expect(streakRow.payload.habitName).to.equal('Morning run');
        expect(streakRow.payload.streakCount).to.equal(5);
        expect(streakRow.payload.pactId).to.equal(PACT_ID);
        // The row outlives the request, so the send-time locale has to travel with it.
        expect(streakRow.payload.locale).to.equal('en-us');
    });

    it('files under habits when the trigger sends no brand header, never under an empty brand', async () => {
        // The queue column has no default and the worker only claims known
        // brands, so a row written under '' would sit pending forever.
        await runDigest({ 'x-localecode': 'en-us' });

        expect(queue.calls.length).to.be.greaterThan(0);
        queue.calls.forEach((call) => {
            expect(call.brand).to.equal(BrandVariations.HABITS);
        });
    });
});

describe('Habits digest — running it twice is a no-op', () => {
    let queue: ReturnType<typeof buildFakeQueue>;

    beforeEach(() => {
        queue = buildFakeQueue();
        stubDigestReads();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('inserts nothing on the second run and reports every decision as deduped', async () => {
        const first = await runDigest();
        const callsAfterFirst = queue.calls.length;

        const second = await runDigest();

        // The handler still evaluates everything — dedup is the queue's job, not
        // a short-circuit here — so it attempts the same 9 enqueues again.
        expect(queue.callsSince(callsAfterFirst)).to.have.length(9);
        // And every one of them conflicts.
        expect(queue.insertedCount()).to.equal(9);

        expect(second.pactExpiringSent).to.equal(0);
        expect(second.streakAtRiskSent).to.equal(0);
        expect(second.partnerMissedSent).to.equal(0);
        expect(second.deduped).to.equal(9);
        expect(second.errors).to.equal(0);

        // Same work decided on both times; only the disposition differs.
        expect(first.pactsEvaluated).to.equal(second.pactsEvaluated);
    });

    it('sweeps pacts whose window has passed into expired', async () => {
        sinon.restore();
        buildFakeQueue();
        stubDigestReads();
        (Store.pacts.getExpiredPacts as any).restore();
        (Store.pacts.expire as any).restore();
        sinon.stub(Store.pacts, 'getExpiredPacts').resolves([
            { id: 'stale-1' }, { id: 'stale-2' },
        ] as any);
        const expire = sinon.stub(Store.pacts, 'expire').resolves({} as any);

        const counters = await runDigest();

        expect(counters.pactsExpired).to.equal(2);
        expect(expire.callCount).to.equal(2);
        expect(counters.errors).to.equal(0);
    });

    // The sweep runs before the active-pact read specifically so a pact cannot
    // be warned that it expires in zero days on the same run that ends it.
    it('sweeps before reading the active set', async () => {
        sinon.restore();
        buildFakeQueue();
        stubDigestReads();
        (Store.pacts.expire as any).restore();
        const expire = sinon.stub(Store.pacts, 'expire').resolves({} as any);

        await runDigest();

        // `get` is the active-pact read; both are stubs on the same object, so
        // sinon's call ordering is the real execution order.
        expect((Store.pacts.getExpiredPacts as any).calledBefore(Store.pacts.get as any)).to.equal(true);
        expect(expire.called).to.equal(false);
    });

    // A pact left un-swept is exactly the behaviour every run before this one
    // had — worth a wasted read, never worth failing the digest over.
    it('counts a failed sweep as an error and still runs the digest', async () => {
        sinon.restore();
        const failQueue = buildFakeQueue();
        stubDigestReads();
        (Store.pacts.getExpiredPacts as any).restore();
        sinon.stub(Store.pacts, 'getExpiredPacts').rejects(new Error('read pool exhausted'));

        const counters = await runDigest();

        expect(counters.pactsExpired).to.equal(0);
        expect(counters.errors).to.equal(1);
        // The notifications still went out.
        expect(failQueue.insertedCount()).to.equal(9);
    });

    it('reports a broken queue as errors, never as dedup', async () => {
        // The distinction matters because it is the only one available remotely:
        // therr-messaging-automator reads "all *Sent zero + deduped > 0" as "already
        // ran today". If a failing enqueue counted as a dedup, a missing
        // main.notificationQueue table — the exact state before the migration runs —
        // would report as a healthy re-run while notifying nobody.
        queue.stub.restore();
        sinon.stub(Store.notificationQueue, 'enqueue').rejects(new Error('relation "notificationQueue" does not exist'));

        const counters = await runDigest();

        expect(counters.deduped).to.equal(0);
        expect(counters.errors).to.equal(9);
        expect(counters.pactExpiringSent).to.equal(0);
        expect(counters.streakAtRiskSent).to.equal(0);
        expect(counters.partnerMissedSent).to.equal(0);
    });

    it('files under habits even when the caller sends another brand header', async () => {
        await runDigest();
        const callsAfterFirst = queue.calls.length;

        await runDigest({ 'x-brand-variation': 'therr', 'x-localecode': 'en-us' });

        // The habits schema carries no brandVariation column — it belongs to
        // Friends with Habits outright — so there is no such thing as another
        // brand's copy of these pacts. Honouring the header would file the same
        // habit reminders in the therr partition of main.notificationQueue, where
        // brandVariation leads the UNIQUE constraint: they would dedupe against
        // the wrong keys and be claimed by the wrong app's worker.
        //
        // So the second run must behave exactly like any other re-run of the day:
        // same brand, same keys, nothing inserted.
        const secondRunCalls = queue.callsSince(callsAfterFirst);
        expect(secondRunCalls).to.have.length(9);
        secondRunCalls.forEach((call) => {
            expect(call.brand, call.dedupeKey).to.equal(BrandVariations.HABITS);
        });
        expect(queue.insertedCount()).to.equal(9);

        // (That brandVariation leads the dedupe constraint at all is asserted
        // where it lives, in notificationQueueStore.test.ts.)
    });
});
