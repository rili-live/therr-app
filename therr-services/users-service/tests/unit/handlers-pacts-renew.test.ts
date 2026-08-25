import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { renewPact } from '../../src/handlers/pacts';
import { isPactRenewable, selectRenewalInvitees } from '../../src/utilities/pactHelpers';

/**
 * Pact renewal — the fixed-cycle restart (docs/WORK_IN_PROGRESS.md § 2.6.3).
 *
 * The RCT meta-analysis behind this work measured a Hedges' g of 0.42 that
 * decayed to 0.15 at 12–24 week follow-up: gamified effects are real and they
 * fade, so the intervention has to be renewed on a cycle. Pacts already had the
 * cycle; nothing closed it.
 *
 * Three properties carry the whole feature, and each fails silently if broken:
 *
 *   1. The streak survives. `habits.streaks` is keyed (userId, habitGoalId) and
 *      never on pactId, so a renewal that touched it would take the user's
 *      strongest reason to keep going away on a day they did nothing wrong.
 *   2. Exactly one live pact per habit. Two parallel pacts on one goal get the
 *      check-in path crediting the same check-in twice.
 *   3. Partners are re-invited, not re-enrolled. A pact is a mutual commitment
 *      for a fixed number of days; one member tapping renew must not sign the
 *      others up for another 30.
 *
 * The eligibility and carry-over rules are exercised directly through the pure
 * helpers the handler uses, and the handler itself is driven against stubbed
 * stores so the assertions cover the code that actually runs.
 */

const RENEWER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PARTNER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const SECOND_PARTNER = 'cccccccc-0000-4000-8000-00000000000c';
const PACT_ID = 'pact-1';
const HABIT_GOAL_ID = 'habit-goal-1';

const DAY_MS = 24 * 60 * 60 * 1000;
const yesterday = () => new Date(Date.now() - DAY_MS);
const tomorrow = () => new Date(Date.now() + DAY_MS);

describe('Pact renewal — eligibility', () => {
    it('allows renewing a completed or expired pact', () => {
        expect(isPactRenewable({ status: 'completed', endDate: yesterday() })).to.equal(true);
        expect(isPactRenewable({ status: 'expired', endDate: yesterday() })).to.equal(true);
    });

    // The sweep runs nightly. A user who finishes a pact and opens the app the
    // same evening must not be told their finished pact is "still running".
    it('allows renewing an active pact whose window has already passed', () => {
        expect(isPactRenewable({ status: 'active', endDate: yesterday() })).to.equal(true);
    });

    it('refuses to renew a pact that is still running', () => {
        expect(isPactRenewable({ status: 'active', endDate: tomorrow() })).to.equal(false);
    });

    it('refuses to renew a pending or abandoned pact', () => {
        expect(isPactRenewable({ status: 'pending', endDate: null })).to.equal(false);
        expect(isPactRenewable({ status: 'abandoned', endDate: yesterday() })).to.equal(false);
    });

    it('refuses to renew nothing', () => {
        expect(isPactRenewable(null)).to.equal(false);
        expect(isPactRenewable(undefined)).to.equal(false);
    });
});

describe('Pact renewal — who carries over', () => {
    it('carries over the members who were actually in the last cycle', () => {
        const invitees = selectRenewalInvitees([
            { userId: RENEWER, status: 'active' },
            { userId: PARTNER, status: 'active' },
            { userId: SECOND_PARTNER, status: 'completed' },
        ], RENEWER);
        expect(invitees).to.deep.equal([PARTNER, SECOND_PARTNER]);
    });

    // Re-inviting these would turn a renewal into a fresh round of asking
    // people who already said no, or who never answered the first time.
    it('leaves behind members who left, were removed, or never accepted', () => {
        const invitees = selectRenewalInvitees([
            { userId: PARTNER, status: 'left' },
            { userId: SECOND_PARTNER, status: 'removed' },
            { userId: 'dddddddd-0000-4000-8000-00000000000d', status: 'pending' },
        ], RENEWER);
        expect(invitees).to.deep.equal([]);
    });

    it('never invites the renewer, who joins as the new creator', () => {
        const invitees = selectRenewalInvitees([{ userId: RENEWER, status: 'active' }], RENEWER);
        expect(invitees).to.deep.equal([]);
    });

    it('dedupes a user appearing twice in the member list', () => {
        const invitees = selectRenewalInvitees([
            { userId: PARTNER, status: 'active' },
            { userId: PARTNER, status: 'completed' },
        ], RENEWER);
        expect(invitees).to.deep.equal([PARTNER]);
    });
});

describe('Pact renewal — handler', () => {
    let createdPact: any;
    let createdMembers: any[];
    let bulkMembers: any[];

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

    const stubStores = ({
        pact,
        members,
        livePacts = [],
    }: { pact: any; members: any[]; livePacts?: any[] }) => {
        sinon.stub(Store.pacts, 'getById').resolves(pact);
        sinon.stub(Store.pactMembers, 'getByPactId')
            .onFirstCall().resolves(members)
            .onSecondCall()
            .resolves(members);
        sinon.stub(Store.pacts, 'getActiveByUserAndHabitGoal').resolves(livePacts as any);
        sinon.stub(Store.habitGoals, 'getById').resolves({ id: HABIT_GOAL_ID, name: 'Morning run' } as any);
        sinon.stub(Store.habitGoals, 'incrementUsageCount').resolves({} as any);
        sinon.stub(Store.pacts, 'create').callsFake((params: any) => {
            createdPact = { id: 'pact-2', status: 'pending', ...params };
            return Promise.resolve(createdPact);
        });
        sinon.stub(Store.pacts, 'activate').callsFake(() => {
            createdPact = { ...createdPact, status: 'active' };
            return Promise.resolve(createdPact);
        });
        sinon.stub(Store.pacts, 'expire').resolves({} as any);
        sinon.stub(Store.pactMembers, 'create').callsFake((params: any) => {
            createdMembers.push(params);
            return Promise.resolve({ id: `member-${createdMembers.length}`, ...params });
        });
        sinon.stub(Store.pactMembers, 'createBulk').callsFake((rows: any[]) => {
            bulkMembers = rows;
            return Promise.resolve(rows.map((row, i) => ({ id: `bulk-${i}`, ...row })));
        });
        sinon.stub(Store.userHabits, 'getOrCreate').resolves({} as any);
        sinon.stub(Store.users, 'findUser').resolves([] as any);
    };

    const endedPact = (overrides: any = {}) => ({
        id: PACT_ID,
        creatorUserId: RENEWER,
        partnerUserId: PARTNER,
        habitGoalId: HABIT_GOAL_ID,
        pactType: 'accountability',
        status: 'expired',
        durationDays: 30,
        endDate: yesterday(),
        consequenceType: null,
        consequenceDetails: null,
        ...overrides,
    });

    const run = async (pactId = PACT_ID, body: any = {}) => {
        const { captured, res } = buildRes();
        await renewPact({
            headers: { 'x-userid': RENEWER, 'x-localecode': 'en-us', 'x-brand-variation': 'habits' },
            params: { id: pactId },
            body,
        } as any, res, (() => undefined) as any);
        return captured;
    };

    beforeEach(() => {
        createdPact = undefined;
        createdMembers = [];
        bulkMembers = [];
    });

    afterEach(() => {
        sinon.restore();
    });

    it('creates a new pact on the same habit goal and never touches the streak', async () => {
        // Every way the streak row could be moved or ended. The renewal must
        // reach for none of them: the streak is keyed (userId, habitGoalId), so
        // carrying across the cycle boundary is what happens when nothing acts.
        const streakWrites = [
            sinon.stub(Store.streaks, 'resetStreak').resolves({} as any),
            sinon.stub(Store.streaks, 'update').resolves({} as any),
            sinon.stub(Store.streaks, 'deactivate').resolves({} as any),
        ];
        stubStores({
            pact: endedPact(),
            members: [
                { userId: RENEWER, status: 'active', role: 'creator' },
                { userId: PARTNER, status: 'active', role: 'partner' },
            ],
        });

        const { statusCode } = await run();

        expect(statusCode).to.equal(201);
        expect(createdPact.habitGoalId).to.equal(HABIT_GOAL_ID);
        expect(createdPact.creatorUserId).to.equal(RENEWER);
        // Inherits the length of the cycle being renewed.
        expect(createdPact.durationDays).to.equal(30);
        streakWrites.forEach((write) => expect(write.called).to.equal(false));
    });

    it('re-invites the previous partner as pending rather than re-enrolling them', async () => {
        stubStores({
            pact: endedPact(),
            members: [
                { userId: RENEWER, status: 'active', role: 'creator' },
                { userId: PARTNER, status: 'active', role: 'partner' },
            ],
        });

        await run();

        expect(createdMembers).to.have.length(1);
        expect(createdMembers[0]).to.include({ userId: RENEWER, role: 'creator', status: 'active' });
        expect(bulkMembers).to.have.length(1);
        expect(bulkMembers[0]).to.include({ userId: PARTNER, role: 'partner', status: 'pending' });
        // Pending invites mean the pact activates on the first acceptance, the
        // same path every other pact follows.
        expect(createdPact.status).to.equal('pending');
    });

    it('activates immediately when nobody is left to accept', async () => {
        stubStores({
            pact: endedPact({ partnerUserId: null }),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
        });

        await run();

        expect(bulkMembers).to.have.length(0);
        // Otherwise it would sit pending forever with no acceptance coming.
        expect(createdPact.status).to.equal('active');
    });

    it('refuses when the user already has a live pact for that habit', async () => {
        stubStores({
            pact: endedPact(),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
            livePacts: [{ id: 'pact-live' }],
        });

        const { statusCode } = await run();

        expect(statusCode).to.equal(409);
        expect(createdPact).to.equal(undefined);
    });

    it('refuses to renew a pact that is still running', async () => {
        stubStores({
            pact: endedPact({ status: 'active', endDate: tomorrow() }),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
        });

        const { statusCode } = await run();

        expect(statusCode).to.equal(409);
        expect(createdPact).to.equal(undefined);
    });

    it('refuses a renewal from someone who was never in the pact', async () => {
        stubStores({
            pact: endedPact({ creatorUserId: PARTNER, partnerUserId: SECOND_PARTNER }),
            members: [
                { userId: PARTNER, status: 'active', role: 'creator' },
                { userId: SECOND_PARTNER, status: 'active', role: 'partner' },
            ],
        });

        const { statusCode } = await run();

        expect(statusCode).to.equal(403);
        expect(createdPact).to.equal(undefined);
    });

    it('404s on a pact that does not exist', async () => {
        sinon.stub(Store.pacts, 'getById').resolves(undefined as any);

        const { statusCode } = await run('missing');

        expect(statusCode).to.equal(404);
    });

    // The new pact exists before the old one is closed: a failure closing the
    // old cycle must never leave the user with neither an old pact nor a new one.
    it('closes out an active-but-past-due pact it renewed', async () => {
        stubStores({
            pact: endedPact({ status: 'active', endDate: yesterday() }),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
        });

        await run();

        expect((Store.pacts.expire as any).calledWith(PACT_ID)).to.equal(true);
        expect(createdPact).to.not.equal(undefined);
    });

    // The live-pact guard reads `getActiveByUserAndHabitGoal`, which filters on
    // status alone — so a past-due pact the nightly sweep has not reached yet
    // comes back as "active", including the one being renewed. Counting it made
    // renewing before the sweep return 409, killing the exact same-evening path
    // isPactRenewable was written to allow.
    it('renews a past-due pact the nightly sweep has not closed yet', async () => {
        const pastDue = endedPact({ status: 'active', endDate: yesterday() });
        stubStores({
            pact: pastDue,
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
            // What the real store returns here: the pact being renewed itself.
            livePacts: [pastDue],
        });

        const { statusCode } = await run();

        expect(statusCode).to.equal(201);
        expect(createdPact).to.not.equal(undefined);
    });

    it('still refuses when another cycle on that habit is genuinely running', async () => {
        stubStores({
            pact: endedPact(),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
            livePacts: [{ id: 'pact-live', status: 'active', endDate: tomorrow() }],
        });

        const { statusCode } = await run();

        expect(statusCode).to.equal(409);
        expect(createdPact).to.equal(undefined);
    });

    it('takes a caller-supplied duration over the previous cycle length', async () => {
        stubStores({
            pact: endedPact({ durationDays: 30 }),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
        });

        await run(PACT_ID, { durationDays: 90 });

        expect(createdPact.durationDays).to.equal(90);
    });

    it('rejects a duration the pact rules do not allow', async () => {
        stubStores({
            pact: endedPact(),
            members: [{ userId: RENEWER, status: 'active', role: 'creator' }],
        });

        const { statusCode } = await run(PACT_ID, { durationDays: 17 });

        expect(statusCode).to.equal(400);
        expect(createdPact).to.equal(undefined);
    });
});
