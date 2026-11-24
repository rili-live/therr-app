import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, HABITS_FREE_HABIT_LIMIT, PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { runOpenPactHandoffPass } from '../../src/handlers/helpers/openPactHandoff';
import { MAX_OPEN_PACT_MEMBERS } from '../../src/utilities/openPacts';

describe('open pacts — the handoff pass', () => {
    const NOW = new Date('2026-11-23T14:00:00Z');
    const context = { brandVariation: BrandVariations.HABITS };

    const PACT_ID = 'b7c2d1e0-0000-4000-8000-000000000002';
    const HABIT_GOAL_ID = 'c8d3e2f1-0000-4000-8000-000000000003';
    const CREATOR = 'a0000000-0000-4000-8000-00000000000c';
    const FIRST = 'a0000000-0000-4000-8000-000000000001';
    const SECOND = 'a0000000-0000-4000-8000-000000000002';
    const THIRD = 'a0000000-0000-4000-8000-000000000003';

    const candidate = (overrides: any = {}) => ({
        pactId: PACT_ID,
        creatorUserId: CREATOR,
        habitGoalName: 'Read',
        creatorLastActiveAt: new Date('2026-11-01T00:00:00Z'),
        creatorIsSoftDeleted: false,
        ...overrides,
    });

    const pendingPact = (overrides: any = {}) => ({
        id: PACT_ID,
        creatorUserId: CREATOR,
        habitGoalId: HABIT_GOAL_ID,
        status: 'pending',
        isOpen: true,
        endDate: null,
        ...overrides,
    });

    const joinRequest = (id: string, requesterUserId: string, requesterUserName: string) => ({
        id, pactId: PACT_ID, requesterUserId, requesterUserName, status: 'pending',
    });

    let queuePush: sinon.SinonStub;
    let readCandidates: sinon.SinonStub;
    let resolvePending: sinon.SinonStub;
    let revertApproval: sinon.SinonStub;
    let transferCreator: sinon.SinonStub;
    let updateMember: sinon.SinonStub;
    let createMember: sinon.SinonStub;
    let activatePact: sinon.SinonStub;
    let expireStale: sinon.SinonStub;

    const stub = ({
        candidates = [candidate()],
        pact = pendingPact(),
        requests = [joinRequest('req-1', FIRST, 'first'), joinRequest('req-2', SECOND, 'second')],
        seats = 1,
        members = { [CREATOR]: { status: 'active', role: 'creator' } } as Record<string, any>,
        atCapacity = [] as string[],
        transferred = true,
    }: any = {}) => {
        readCandidates = sinon.stub(Store.pactJoinRequests, 'getPactsAwaitingHandoff').resolves(candidates);
        sinon.stub(Store.pacts, 'getById').resolves(pact);
        sinon.stub(Store.pactJoinRequests, 'getPendingByPact').resolves(requests);
        sinon.stub(Store.pacts, 'countSeats').resolves(seats);
        sinon.stub(Store.pactMembers, 'getByPactAndUser').callsFake(async (_pactId: string, userId: string) => members[userId]);
        resolvePending = sinon.stub(Store.pactJoinRequests, 'resolvePending')
            .callsFake(async (id: string, status: string) => ({ id, status } as any));
        revertApproval = sinon.stub(Store.pactJoinRequests, 'revertApproval').resolves(undefined);
        transferCreator = sinon.stub(Store.pacts, 'transferCreator')
            .callsFake(async (_id: string, _from: string, to: string) => (transferred ? { ...pact, creatorUserId: to } : undefined));
        updateMember = sinon.stub(Store.pactMembers, 'updateByPactAndUser').resolves({} as any);
        createMember = sinon.stub(Store.pactMembers, 'create').resolves({} as any);
        activatePact = sinon.stub(Store.pacts, 'activate').callsFake(async () => ({ ...pact, status: 'active' }));
        sinon.stub(Store.pactMembers, 'activate').resolves({} as any);
        sinon.stub(Store.streaks, 'getOrCreate').resolves({} as any);
        sinon.stub(Store.userHabits, 'getOrCreate').resolves({} as any);
        sinon.stub(Store.userHabits, 'reviveArchivedByHabit').resolves(undefined as any);
        sinon.stub(Store.userConnections, 'getUserConnections').rejects(new Error('not under test'));
        sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([] as any);
        // Capacity: a free account, at its limit when listed in `atCapacity`.
        sinon.stub(Store.users, 'findUser').resolves([{ accessLevels: [], isUnclaimed: true }] as any);
        sinon.stub(Store.userHabits, 'countActiveByUser')
            .callsFake(async (userId: string) => (atCapacity.includes(userId) ? HABITS_FREE_HABIT_LIMIT : 0));
        sinon.stub(Store.userHabits, 'countStartedSinceByUser').resolves(0);
        expireStale = sinon.stub(Store.pactJoinRequests, 'expireStale').resolves(['old-1', 'old-2']);
        queuePush = sinon.stub().resolves('queued');
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABIT_OPEN_PACT_HANDOFF_ENABLED;
    });

    it('looks for requests 2 days old on creators quiet for 7, on running pacts', async () => {
        stub({ candidates: [] });
        await runOpenPactHandoffPass(queuePush, context, NOW);

        const [requestBefore, inactiveBefore, statuses] = readCandidates.firstCall.args;
        expect(requestBefore.toISOString()).to.equal('2026-11-21T14:00:00.000Z');
        expect(inactiveBefore.toISOString()).to.equal('2026-11-16T14:00:00.000Z');
        expect(statuses).to.deep.equal(['pending', 'active']);
    });

    it('makes the longest-waiting requester the host and lets the others in under them', async () => {
        stub();
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({
            pactsEvaluated: 1, pactsHandedOff: 1, requestersApproved: 2, handoffErrors: 0,
        });
        expect(transferCreator.calledOnceWith(PACT_ID, CREATOR, FIRST)).to.equal(true);
        // The host's request is claimed before the pact moves, so a racing cancel resolves once.
        expect(resolvePending.firstCall.args).to.deep.equal(['req-1', 'approved']);
        expect(resolvePending.firstCall.calledBefore(transferCreator.firstCall)).to.equal(true);

        // The quiet creator leaves; the host takes a creator's seat.
        expect(updateMember.calledWith(PACT_ID, CREATOR, sinon.match({ role: 'partner', status: 'left' }))).to.equal(true);
        expect(createMember.firstCall.args[0]).to.include({
            pactId: PACT_ID, userId: FIRST, role: 'creator', status: 'active',
        });
        expect(createMember.secondCall.args[0]).to.include({
            pactId: PACT_ID, userId: SECOND, role: 'partner',
        });
        // The second requester is the pact's first partner, so the pact starts.
        expect(activatePact.calledOnceWith(PACT_ID)).to.equal(true);
    });

    it('tells the host the pact is theirs and the others who hosts it, once per request', async () => {
        stub();
        await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(queuePush.callCount).to.equal(2);
        const [hostTo, hostType, hostKey, hostExtras] = queuePush.firstCall.args;
        expect(hostTo).to.equal(FIRST);
        expect(hostType).to.equal(PushNotifications.Types.pactJoinApproved);
        expect(hostKey).to.equal('open-pact-handoff:req-1');
        expect(hostExtras).to.deep.include({ pactId: PACT_ID, habitName: 'Read', pactJoinApprovedReason: 'handoffHost' });

        const [joinerTo, , joinerKey, joinerExtras] = queuePush.secondCall.args;
        expect(joinerTo).to.equal(SECOND);
        expect(joinerKey).to.equal('open-pact-handoff:req-2');
        expect(joinerExtras.pactJoinApprovedReason).to.equal('handoff');
        expect(joinerExtras.fromUser).to.deep.equal({ id: FIRST, userName: 'first' });
    });

    it('hands a pact with one requester to them and leaves it open for the next', async () => {
        stub({ requests: [joinRequest('req-1', FIRST, 'first')] });
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({ pactsHandedOff: 1, requestersApproved: 1 });
        expect(transferCreator.calledOnce).to.equal(true);
        // Nobody joined, so the pact still waits for its first partner — under its new host.
        expect(activatePact.called).to.equal(false);
    });

    it('skips a requester at their habit limit and makes the next one the host', async () => {
        stub({ atCapacity: [FIRST] });
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({ requestersAtCapacity: 1, pactsHandedOff: 1, requestersApproved: 1 });
        expect(transferCreator.calledOnceWith(PACT_ID, CREATOR, SECOND)).to.equal(true);
        // Their request stays pending for the new host to answer.
        expect(resolvePending.calledWith('req-1')).to.equal(false);
    });

    it('hands nothing off when nobody waiting can be let in', async () => {
        stub({ atCapacity: [FIRST, SECOND] });
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({ pactsNoEligibleRequester: 1, pactsHandedOff: 0 });
        expect(transferCreator.called).to.equal(false);
        expect(queuePush.called).to.equal(false);
    });

    it('lets in no more people than there are seats, counting the one the creator frees', async () => {
        const many = [FIRST, SECOND, THIRD].map((userId, i) => joinRequest(`req-${i + 1}`, userId, `u${i + 1}`));
        // Full but for the creator's seat: only the host fits.
        stub({ requests: many, seats: MAX_OPEN_PACT_MEMBERS });
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({ pactsHandedOff: 1, requestersApproved: 1 });
        expect(resolvePending.callCount).to.equal(1);
    });

    it('leaves a pact alone when its creator came back or closed it since the read', async () => {
        stub({ pact: pendingPact({ isOpen: false }) });
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({ pactsSkippedChanged: 1, pactsHandedOff: 0 });
        expect(resolvePending.called).to.equal(false);
    });

    it('puts the host request back when another run moved the pact first', async () => {
        stub({ transferred: false });
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters).to.include({ pactsSkippedChanged: 1, pactsHandedOff: 0 });
        expect(revertApproval.calledOnceWith('req-1')).to.equal(true);
        expect(updateMember.called).to.equal(false);
        expect(queuePush.called).to.equal(false);
    });

    it('expires stale requests after the handoff, 14 days back', async () => {
        stub();
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(counters.requestsExpired).to.equal(2);
        const [createdBefore, statuses] = expireStale.firstCall.args;
        expect(createdBefore.toISOString()).to.equal('2026-11-09T14:00:00.000Z');
        expect(statuses).to.deep.equal(['pending', 'active']);
        expect(expireStale.calledAfter(transferCreator)).to.equal(true);
    });

    it('still expires stale requests with the handoff switched off', async () => {
        stub();
        process.env.HABIT_OPEN_PACT_HANDOFF_ENABLED = 'false';
        const counters = await runOpenPactHandoffPass(queuePush, context, NOW);

        expect(readCandidates.called).to.equal(false);
        expect(transferCreator.called).to.equal(false);
        expect(counters.requestsExpired).to.equal(2);
    });
});
