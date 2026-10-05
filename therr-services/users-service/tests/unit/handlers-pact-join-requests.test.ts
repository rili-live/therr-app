import { expect } from 'chai';
import sinon from 'sinon';
import { HABITS_FREE_HABIT_LIMIT, Notifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    approveJoinRequest,
    declineJoinRequest,
    getOpenPacts,
    requestToJoinPact,
    setPactOpen,
} from '../../src/handlers/pactJoinRequests';
import { MAX_OPEN_PACT_MEMBERS, MAX_PENDING_JOIN_REQUESTS_PER_USER } from '../../src/utilities/openPacts';

/**
 * Open pacts — the endpoints. The matching and joinability rules are pinned in openPacts.test.ts;
 * these cover who may do what, and what each path writes.
 */

const CREATOR = 'aaaaaaaa-0000-4000-8000-00000000000c';
const REQUESTER = 'aaaaaaaa-0000-4000-8000-00000000000r';
const PACT_ID = 'pact-1';
const REQUEST_ID = 'request-1';
const HABIT_GOAL_ID = 'goal-1';

const openPact = (overrides: any = {}) => ({
    id: PACT_ID,
    creatorUserId: CREATOR,
    habitGoalId: HABIT_GOAL_ID,
    status: 'active',
    isOpen: true,
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    durationDays: 30,
    ...overrides,
});

const call = async (handler: any, {
    userId = REQUESTER,
    params = { id: PACT_ID },
    body = {},
    query = {},
}: any = {}) => {
    const captured: { statusCode?: number; body?: any } = {};
    const res = {
        status: (statusCode: number) => {
            captured.statusCode = statusCode;
            return { send: (payload: any) => { captured.body = payload; return payload; } };
        },
    } as any;
    await handler({
        headers: {
            'x-userid': userId,
            'x-username': userId === CREATOR ? 'creator_name' : 'requester_name',
            'x-localecode': 'en-us',
            'x-brand-variation': 'habits',
        },
        params,
        body,
        query,
    } as any, res, (() => undefined) as any);
    return captured;
};

/** Capacity: a free account under its limit. findUser also serves the push lookup, which an
 * unclaimed row short-circuits — so no internal HTTP call is made. */
const stubCapacity = (activeHabitCount = 0) => {
    sinon.stub(Store.users, 'findUser').resolves([{ accessLevels: [], isUnclaimed: true }] as any);
    sinon.stub(Store.userHabits, 'countActiveByUser').resolves(activeHabitCount);
    sinon.stub(Store.userHabits, 'countStartedSinceByUser').resolves(0);
};

describe('open pacts — endpoints', () => {
    afterEach(() => sinon.restore());

    describe('POST /habits/pacts/:id/join-requests', () => {
        let createPending: sinon.SinonStub;
        let createNotification: sinon.SinonStub;

        const stub = ({
            pact = openPact(),
            member = undefined,
            existing = undefined,
            seats = 2,
            pendingCount = 0,
            activeHabitCount = 0,
        }: any = {}) => {
            sinon.stub(Store.pacts, 'getById').resolves(pact);
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member);
            sinon.stub(Store.pactJoinRequests, 'getPendingByPactAndRequester').resolves(existing);
            sinon.stub(Store.pacts, 'countSeats').resolves(seats);
            sinon.stub(Store.pactJoinRequests, 'countPendingByRequester').resolves(pendingCount);
            sinon.stub(Store.habitGoals, 'getById').resolves({ id: HABIT_GOAL_ID, name: 'Read' });
            createPending = sinon.stub(Store.pactJoinRequests, 'createPending')
                .resolves({
                    id: REQUEST_ID, pactId: PACT_ID, requesterUserId: REQUESTER, status: 'pending',
                } as any);
            createNotification = sinon.stub(Store.notifications, 'createNotification').resolves({} as any);
            stubCapacity(activeHabitCount);
        };

        it('records the request and tells the creator in-app', async () => {
            stub();
            const result = await call(requestToJoinPact);
            await new Promise((resolve) => { setImmediate(resolve); });

            expect(result.statusCode).to.equal(201);
            expect(createPending.firstCall.args).to.deep.equal([PACT_ID, REQUESTER]);
            const [brand, notification] = createNotification.firstCall.args;
            expect(brand).to.equal('habits');
            expect(notification).to.include({
                userId: CREATOR,
                type: Notifications.Types.PACT_JOIN_REQUEST,
                associationId: PACT_ID,
            });
            expect(notification.messageParams).to.include({ fromUserName: 'requester_name', habitName: 'Read' });
        });

        it('refuses a pact that is not open', async () => {
            stub({ pact: openPact({ isOpen: false }) });
            const result = await call(requestToJoinPact);

            expect(result.statusCode).to.equal(400);
            expect(createPending.called).to.equal(false);
        });

        it('refuses a pact whose cycle has ended, whatever its flag says', async () => {
            stub({ pact: openPact({ endDate: new Date(Date.now() - 1000) }) });
            const result = await call(requestToJoinPact);

            expect(result.statusCode).to.equal(400);
        });

        it('refuses the creator and anyone already in or invited', async () => {
            stub();
            expect((await call(requestToJoinPact, { userId: CREATOR })).statusCode).to.equal(400);

            sinon.restore();
            stub({ member: { status: 'pending' } });
            expect((await call(requestToJoinPact)).statusCode).to.equal(400);
            expect(createPending.called).to.equal(false);
        });

        it('returns the request already waiting, without notifying the creator again', async () => {
            const existing = { id: REQUEST_ID, status: 'pending' };
            stub({ existing });
            const result = await call(requestToJoinPact);

            expect(result.statusCode).to.equal(200);
            expect(result.body).to.equal(existing);
            expect(createPending.called).to.equal(false);
            expect(createNotification.called).to.equal(false);
        });

        it('refuses a full pact', async () => {
            stub({ seats: MAX_OPEN_PACT_MEMBERS });
            const result = await call(requestToJoinPact);

            expect(result.statusCode).to.equal(400);
            expect(createPending.called).to.equal(false);
        });

        it('caps how many requests one person can have waiting', async () => {
            stub({ pendingCount: MAX_PENDING_JOIN_REQUESTS_PER_USER });
            const result = await call(requestToJoinPact);

            expect(result.statusCode).to.equal(400);
            expect(createPending.called).to.equal(false);
        });

        it('sends a requester at the free-tier limit to the paywall before asking', async () => {
            stub({ activeHabitCount: HABITS_FREE_HABIT_LIMIT });
            const result = await call(requestToJoinPact);

            expect(result.statusCode).to.equal(402);
            expect(result.body).to.include({ upgradeRequired: true });
            expect(createPending.called).to.equal(false);
        });
    });

    describe('PUT /habits/pacts/:id/open', () => {
        it('lets the creator open a running pact', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(openPact({ isOpen: false, status: 'pending', endDate: null }));
            const setOpen = sinon.stub(Store.pacts, 'setOpen').resolves({ id: PACT_ID, isOpen: true });

            const result = await call(setPactOpen, { userId: CREATOR, body: { isOpen: true } });

            expect(result.statusCode).to.equal(200);
            expect(setOpen.firstCall.args).to.deep.equal([PACT_ID, true]);
        });

        it('refuses anyone but the creator', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(openPact());
            const setOpen = sinon.stub(Store.pacts, 'setOpen');

            const result = await call(setPactOpen, { userId: REQUESTER, body: { isOpen: false } });

            expect(result.statusCode).to.equal(403);
            expect(setOpen.called).to.equal(false);
        });

        it('refuses to open a finished pact, but always allows closing one', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(openPact({ status: 'completed' }));
            const setOpen = sinon.stub(Store.pacts, 'setOpen').resolves({});

            expect((await call(setPactOpen, { userId: CREATOR, body: { isOpen: true } })).statusCode).to.equal(400);
            expect((await call(setPactOpen, { userId: CREATOR, body: { isOpen: false } })).statusCode).to.equal(200);
            expect(setOpen.callCount).to.equal(1);
        });

        it('requires a boolean', async () => {
            const result = await call(setPactOpen, { userId: CREATOR, body: { isOpen: 'yes' } });
            expect(result.statusCode).to.equal(400);
        });
    });

    describe('GET /habits/pacts/open', () => {
        it('matches on the habit of the goal it is given', async () => {
            sinon.stub(Store.habitGoals, 'getById').resolves({
                id: HABIT_GOAL_ID, name: '  Leer  Más ', sourceTemplateKey: 'read',
            });
            const getOpenPactsStub = sinon.stub(Store.pacts, 'getOpenPacts').resolves([]);

            const result = await call(getOpenPacts, { query: { habitGoalId: HABIT_GOAL_ID } });

            expect(result.statusCode).to.equal(200);
            expect(result.body).to.deep.equal({ pacts: [] });
            expect(getOpenPactsStub.firstCall.args).to.deep.equal([
                REQUESTER,
                { templateKey: 'read', normalizedName: 'leer más' },
            ]);
        });

        it('lists every open pact when no habit is given', async () => {
            const getOpenPactsStub = sinon.stub(Store.pacts, 'getOpenPacts').resolves([]);

            await call(getOpenPacts);

            expect(getOpenPactsStub.firstCall.args).to.deep.equal([REQUESTER, undefined]);
        });
    });

    describe('PUT /habits/pacts/:id/join-requests/:requestId/approve', () => {
        const params = { id: PACT_ID, requestId: REQUEST_ID };
        let resolvePending: sinon.SinonStub;
        let createMember: sinon.SinonStub;
        let activatePact: sinon.SinonStub;
        let activateMember: sinon.SinonStub;

        const stub = ({
            pact = openPact({ status: 'pending', endDate: null }),
            request = {
                id: REQUEST_ID, pactId: PACT_ID, requesterUserId: REQUESTER, status: 'pending',
            },
            member = undefined,
            seats = 1,
            activeHabitCount = 0,
            claimed = true,
        }: any = {}) => {
            sinon.stub(Store.pacts, 'getById').resolves(pact);
            sinon.stub(Store.pactJoinRequests, 'getById').resolves(request);
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member);
            sinon.stub(Store.pacts, 'countSeats').resolves(seats);
            resolvePending = sinon.stub(Store.pactJoinRequests, 'resolvePending')
                .resolves(claimed ? { ...request, status: 'approved' } : undefined);
            createMember = sinon.stub(Store.pactMembers, 'create').resolves({} as any);
            activatePact = sinon.stub(Store.pacts, 'activate').resolves({ ...pact, status: 'active' });
            activateMember = sinon.stub(Store.pactMembers, 'activate').resolves({} as any);
            sinon.stub(Store.streaks, 'getOrCreate').resolves({} as any);
            sinon.stub(Store.userHabits, 'getOrCreate').resolves({} as any);
            sinon.stub(Store.userHabits, 'reviveArchivedByHabit').resolves(undefined as any);
            sinon.stub(Store.habitGoals, 'getById').resolves({ id: HABIT_GOAL_ID, name: 'Read' });
            // ensureCompletedUserConnection — fire and forget; let it fail quietly.
            sinon.stub(Store.userConnections, 'getUserConnections').rejects(new Error('not under test'));
            stubCapacity(activeHabitCount);
        };

        it('makes the requester a member and starts a pact nobody had joined yet', async () => {
            stub();
            const result = await call(approveJoinRequest, { userId: CREATOR, params });

            expect(result.statusCode).to.equal(200);
            expect(resolvePending.firstCall.args).to.deep.equal([REQUEST_ID, 'approved']);
            expect(createMember.firstCall.args[0]).to.include({
                pactId: PACT_ID, userId: REQUESTER, role: 'partner',
            });
            expect(activatePact.calledOnceWith(PACT_ID)).to.equal(true);
            const activatedUsers = activateMember.getCalls().map((c) => c.args[1]);
            expect(activatedUsers).to.have.members([REQUESTER, CREATOR]);
        });

        it('refuses anyone but the creator', async () => {
            stub();
            const result = await call(approveJoinRequest, { userId: REQUESTER, params });

            expect(result.statusCode).to.equal(403);
            expect(resolvePending.called).to.equal(false);
        });

        it('refuses when the pact filled up after the request was sent', async () => {
            stub({ seats: MAX_OPEN_PACT_MEMBERS });
            const result = await call(approveJoinRequest, { userId: CREATOR, params });

            expect(result.statusCode).to.equal(400);
            expect(resolvePending.called).to.equal(false);
        });

        it('keeps the request waiting when the requester has no free habit slot', async () => {
            stub({ activeHabitCount: HABITS_FREE_HABIT_LIMIT });
            const result = await call(approveJoinRequest, { userId: CREATOR, params });

            expect(result.statusCode).to.equal(409);
            expect(resolvePending.called).to.equal(false);
            expect(createMember.called).to.equal(false);
        });

        it('joins nobody when a racing answer already resolved the request', async () => {
            stub({ claimed: false });
            const result = await call(approveJoinRequest, { userId: CREATOR, params });

            expect(result.statusCode).to.equal(404);
            expect(createMember.called).to.equal(false);
        });

        it('puts the request back to pending when joining fails', async () => {
            stub();
            activateMember.rejects(new Error('db down'));
            const revert = sinon.stub(Store.pactJoinRequests, 'revertApproval').resolves(undefined);

            const result = await call(approveJoinRequest, { userId: CREATOR, params });

            expect(result.statusCode).to.equal(500);
            expect(revert.calledOnceWith(REQUEST_ID)).to.equal(true);
        });

        it('refuses a request that belongs to another pact', async () => {
            stub({
                request: {
                    id: REQUEST_ID, pactId: 'other-pact', requesterUserId: REQUESTER, status: 'pending',
                },
            });
            const result = await call(approveJoinRequest, { userId: CREATOR, params });

            expect(result.statusCode).to.equal(404);
            expect(resolvePending.called).to.equal(false);
        });
    });

    describe('PUT /habits/pacts/:id/join-requests/:requestId/decline', () => {
        it('declines without making anyone a member', async () => {
            sinon.stub(Store.pacts, 'getById').resolves(openPact());
            sinon.stub(Store.pactJoinRequests, 'getById').resolves({
                id: REQUEST_ID, pactId: PACT_ID, requesterUserId: REQUESTER, status: 'pending',
            } as any);
            const resolvePending = sinon.stub(Store.pactJoinRequests, 'resolvePending').resolves({ status: 'declined' } as any);
            const createMember = sinon.stub(Store.pactMembers, 'create');

            const result = await call(declineJoinRequest, { userId: CREATOR, params: { id: PACT_ID, requestId: REQUEST_ID } });

            expect(result.statusCode).to.equal(200);
            expect(resolvePending.firstCall.args).to.deep.equal([REQUEST_ID, 'declined']);
            expect(createMember.called).to.equal(false);
        });
    });
});
