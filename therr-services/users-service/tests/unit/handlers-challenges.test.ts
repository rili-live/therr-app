import { expect } from 'chai';
import sinon from 'sinon';
import { PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    cancelChallenge,
    createChallenge,
    getChallengeByToken,
    joinChallenge,
    leaveChallenge,
} from '../../src/handlers/challenges';
import { MAX_ACTIVE_CHALLENGES_PER_CREATOR } from '../../src/utilities/challengeStandings';

const CREATOR = 'aaaaaaaa-0000-4000-8000-00000000000c';
const JOINER = 'aaaaaaaa-0000-4000-8000-00000000000j';
const CHALLENGE_ID = 'challenge-1';
const GOAL_ID = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const TOKEN = 'AbCdEf123456';

const detail = (overrides: any = {}) => ({
    id: CHALLENGE_ID,
    creatorUserId: CREATOR,
    habitGoalId: GOAL_ID,
    title: null,
    joinToken: TOKEN,
    startDate: '2026-10-20',
    endDate: '2026-11-18',
    maxMembers: 50,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    goalName: 'Run',
    goalEmoji: '🏃',
    goalAmountUnit: null,
    creatorUserName: 'creator_name',
    creatorFirstName: 'Casey',
    activeMemberCount: 1,
    ...overrides,
});

const call = async (handler: any, {
    userId = JOINER,
    params = { token: TOKEN },
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
            ...(userId ? { 'x-userid': userId, 'x-username': userId === CREATOR ? 'creator_name' : 'joiner_name' } : {}),
            'x-localecode': 'en-us',
            'x-brand-variation': 'habits',
        },
        params,
        body,
        query,
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('challenges — endpoints', () => {
    let enqueue: sinon.SinonStub;

    beforeEach(() => {
        // resolveWeekBounds reads the user's zone; none saved falls back to the service zone.
        sinon.stub(Store.users, 'getUserById').resolves([{ id: JOINER, settingsTimezone: 'UTC' }] as any);
        enqueue = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'queued' } as any);
        sinon.stub(Store.challenges, 'getStandings').resolves([]);
    });

    afterEach(() => sinon.restore());

    describe('POST /habits/challenges', () => {
        it('refuses a habit the creator does not track', async () => {
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves(undefined);
            const create = sinon.stub(Store.challenges, 'create');

            const out = await call(createChallenge, { userId: CREATOR, body: { habitGoalId: GOAL_ID } });

            expect(out.statusCode).to.equal(400);
            expect(create.called).to.equal(false);
        });

        it('refuses a duration a pact would not allow', async () => {
            const out = await call(createChallenge, { userId: CREATOR, body: { habitGoalId: GOAL_ID, durationDays: 75 } });
            expect(out.statusCode).to.equal(400);
        });

        it('caps running challenges per creator', async () => {
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves({ id: 'uh', status: 'active' } as any);
            sinon.stub(Store.challenges, 'getRunningForMemberAndGoal').resolves(undefined);
            sinon.stub(Store.challenges, 'countActiveCreatedBy').resolves(MAX_ACTIVE_CHALLENGES_PER_CREATOR);
            const create = sinon.stub(Store.challenges, 'create');

            const out = await call(createChallenge, { userId: CREATOR, body: { habitGoalId: GOAL_ID } });

            expect(out.statusCode).to.equal(400);
            expect(create.called).to.equal(false);
        });

        it('hands back the running challenge on this habit instead of starting a second one', async () => {
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves({ id: 'uh', status: 'active' } as any);
            // A friend's challenge the creator joined counts too: one board per habit.
            sinon.stub(Store.challenges, 'getRunningForMemberAndGoal').resolves(detail({ creatorUserId: JOINER }) as any);
            const count = sinon.stub(Store.challenges, 'countActiveCreatedBy');
            const create = sinon.stub(Store.challenges, 'create');

            const out = await call(createChallenge, { userId: CREATOR, body: { habitGoalId: GOAL_ID } });

            expect(out.statusCode).to.equal(409);
            expect(out.body.error).to.equal('challenge-already-running');
            expect(out.body.challenge.joinToken).to.equal(TOKEN);
            expect(out.body.challenge.viewer.isCreator).to.equal(false);
            expect(create.called).to.equal(false);
            // Checked before the cap, so the answer is the existing link, not "too many".
            expect(count.called).to.equal(false);
        });

        it('creates a 30-day challenge by default and puts the creator on the board', async () => {
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves({ id: 'uh', status: 'active' } as any);
            sinon.stub(Store.challenges, 'getRunningForMemberAndGoal').resolves(undefined);
            sinon.stub(Store.challenges, 'countActiveCreatedBy').resolves(0);
            const create = sinon.stub(Store.challenges, 'create').resolves({ id: CHALLENGE_ID });
            const addMember = sinon.stub(Store.challenges, 'upsertActiveMember').resolves({ member: {} as any, wasJustJoined: true });
            sinon.stub(Store.challenges, 'getDetailById').resolves(detail() as any);

            const out = await call(createChallenge, { userId: CREATOR, body: { habitGoalId: GOAL_ID, title: '  October miles  ' } });

            expect(out.statusCode).to.equal(201);
            const params = create.firstCall.args[0];
            expect(params.title).to.equal('October miles');
            expect(params.joinToken).to.match(/^[A-Za-z0-9]{12}$/);
            // 30 days inclusive of the start.
            const span = (Date.parse(params.endDate) - Date.parse(params.startDate)) / 86400000;
            expect(span).to.equal(29);
            expect(addMember.calledWith(CHALLENGE_ID, CREATOR)).to.equal(true);
        });
    });

    describe('GET /habits/challenges/by-token/:token', () => {
        it('404s a malformed token without reading the database', async () => {
            const read = sinon.stub(Store.challenges, 'getDetailByToken');
            const out = await call(getChallengeByToken, { userId: null, params: { token: 'x' } });
            expect(out.statusCode).to.equal(404);
            expect(read.called).to.equal(false);
        });

        it('404s a cancelled challenge', async () => {
            sinon.stub(Store.challenges, 'getDetailByToken').resolves(detail({ status: 'cancelled' }) as any);
            const out = await call(getChallengeByToken, { userId: null });
            expect(out.statusCode).to.equal(404);
        });

        it('serves a signed-out visitor, with no user ids in the standings', async () => {
            sinon.restore();
            sinon.stub(Store.challenges, 'getDetailByToken').resolves(detail() as any);
            sinon.stub(Store.challenges, 'getStandings').resolves([{
                userId: CREATOR,
                userName: 'creator_name',
                firstName: 'Casey',
                joinedAt: new Date(),
                checkinDays: 3,
                totalAmount: 0,
                lastCheckinDate: '2026-10-22',
            }]);

            const out = await call(getChallengeByToken, { userId: null });

            expect(out.statusCode).to.equal(200);
            expect(out.body.viewer).to.equal(null);
            expect(out.body.title).to.equal('Run');
            expect(out.body.standings[0]).to.deep.include({
                rank: 1, userName: 'creator_name', displayName: 'Casey', checkinDays: 3,
            });
            expect(JSON.stringify(out.body.standings)).to.not.include(CREATOR);
        });
    });

    describe('POST /habits/challenges/by-token/:token/join', () => {
        const stubJoinable = ({
            challenge = detail(), member = undefined, tracking = undefined, activeHabitCount = 0,
        }: any = {}) => {
            sinon.stub(Store.challenges, 'getDetailByToken').resolves(challenge);
            sinon.stub(Store.challenges, 'getDetailById').resolves(challenge);
            sinon.stub(Store.challenges, 'getMember').resolves(member);
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves(tracking);
            sinon.stub(Store.users, 'findUser').resolves([{ accessLevels: [] }] as any);
            sinon.stub(Store.userHabits, 'countActiveByUser').resolves(activeHabitCount);
            sinon.stub(Store.userHabits, 'countStartedSinceByUser').resolves(0);
            sinon.stub(Store.userHabits, 'getOrCreate').resolves({ id: 'uh', status: 'active' } as any);
            sinon.stub(Store.streaks, 'getOrCreate').resolves({} as any);
        };

        it('starts the habit, joins, and tells the creator once', async () => {
            stubJoinable();
            sinon.stub(Store.challenges, 'upsertActiveMember').resolves({ member: {} as any, wasJustJoined: true });

            const out = await call(joinChallenge);

            expect(out.statusCode).to.equal(201);
            expect(enqueue.calledOnce).to.equal(true);
            const [, args] = enqueue.firstCall.args;
            expect(args.userId).to.equal(CREATOR);
            expect(args.type).to.equal(PushNotifications.Types.challengeJoined);
            expect(args.dedupeKey).to.equal(`challenge-joined:${CHALLENGE_ID}:${JOINER}`);
        });

        it('is a quiet no-op for someone already in', async () => {
            stubJoinable({ member: { status: 'active' } });
            const getOrCreate = Store.userHabits.getOrCreate as sinon.SinonStub;
            sinon.stub(Store.challenges, 'upsertActiveMember').resolves({ member: {} as any, wasJustJoined: false });

            const out = await call(joinChallenge);

            expect(out.statusCode).to.equal(200);
            expect(getOrCreate.called).to.equal(false);
            expect(enqueue.called).to.equal(false);
        });

        it('takes a habit slot like any other start (402 at the free cap)', async () => {
            stubJoinable({ activeHabitCount: 99 });
            const upsert = sinon.stub(Store.challenges, 'upsertActiveMember');

            const out = await call(joinChallenge);

            expect(out.statusCode).to.equal(402);
            expect(upsert.called).to.equal(false);
        });

        it('costs no slot for a habit already tracked', async () => {
            stubJoinable({ tracking: { status: 'active' }, activeHabitCount: 99 });
            sinon.stub(Store.challenges, 'upsertActiveMember').resolves({ member: {} as any, wasJustJoined: true });

            const out = await call(joinChallenge);

            expect(out.statusCode).to.equal(201);
        });

        it('refuses a full or ended challenge', async () => {
            stubJoinable({ challenge: detail({ activeMemberCount: 50 }) });
            expect((await call(joinChallenge)).statusCode).to.equal(400);

            sinon.restore();
            sinon.stub(Store.users, 'getUserById').resolves([{ id: JOINER, settingsTimezone: 'UTC' }] as any);
            stubJoinable({ challenge: detail({ startDate: '2020-01-01', endDate: '2020-01-07' }) });
            expect((await call(joinChallenge)).statusCode).to.equal(400);
        });

        it('does not notify the creator about themselves', async () => {
            stubJoinable({ tracking: { status: 'active' } });
            sinon.stub(Store.challenges, 'upsertActiveMember').resolves({ member: {} as any, wasJustJoined: true });

            await call(joinChallenge, { userId: CREATOR });

            expect(enqueue.called).to.equal(false);
        });
    });

    describe('leave and cancel', () => {
        it('lets a member leave but not the creator', async () => {
            sinon.stub(Store.challenges, 'getDetailById').resolves(detail() as any);
            const setMemberStatus = sinon.stub(Store.challenges, 'setMemberStatus').resolves({} as any);

            expect((await call(leaveChallenge, { userId: CREATOR, params: { id: CHALLENGE_ID } })).statusCode).to.equal(400);
            expect((await call(leaveChallenge, { params: { id: CHALLENGE_ID } })).statusCode).to.equal(200);
            expect(setMemberStatus.calledOnceWith(CHALLENGE_ID, JOINER, 'left')).to.equal(true);
        });

        it('lets only the creator cancel', async () => {
            sinon.stub(Store.challenges, 'getDetailById').resolves(detail() as any);
            const setStatus = sinon.stub(Store.challenges, 'setStatus').resolves({} as any);

            expect((await call(cancelChallenge, { params: { id: CHALLENGE_ID } })).statusCode).to.equal(403);
            expect((await call(cancelChallenge, { userId: CREATOR, params: { id: CHALLENGE_ID } })).statusCode).to.equal(200);
            expect(setStatus.calledOnceWith(CHALLENGE_ID, 'cancelled')).to.equal(true);
        });
    });
});
