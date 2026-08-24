import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, HABITS_FREE_HABIT_LIMIT, HABITS_SOLO_UNLOCK_INVITE_COUNT } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { createUserHabit, restoreUserHabit, archiveUserHabit } from '../../src/handlers/userHabits';

/**
 * Personal ("solo") habits.
 *
 * Three rules matter and none is obvious from the code alone:
 *   1. Starting one unlocks at HABITS_SOLO_UNLOCK_INVITE_COUNT distinct people
 *      invited — invites *sent*, not accepted, so a friend who never installs
 *      the app cannot strand the inviter.
 *   2. The denial carries the progress numbers, because the requirement only
 *      works as a growth lever if the client can show how close the user is.
 *   3. Starting one consumes a free-tier slot exactly like a pact does, and the
 *      unlock is checked before the cap — being short of invites is not a
 *      paywall, and must not be answered with one.
 */
const makeRes = () => {
    const res: any = {
        statusCode: undefined,
        body: undefined,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(payload: any) {
            res.body = payload;
            return res;
        },
    };
    return res;
};

const makeReq = (overrides: any = {}) => ({
    headers: {
        'x-userid': 'user-1',
        'x-localecode': 'en-us',
        'x-brand-variation': BrandVariations.HABITS,
        ...(overrides.headers || {}),
    },
    body: { habitGoalId: 'goal-1', ...(overrides.body || {}) },
    params: overrides.params || {},
    query: overrides.query || {},
});

describe('Solo habits', () => {
    let countInvitedStub: sinon.SinonStub;
    let findUserStub: sinon.SinonStub;
    let countActiveStub: sinon.SinonStub;
    let getOrCreateStub: sinon.SinonStub;
    let setStatusStub: sinon.SinonStub;
    let getByUserAndHabitStub: sinon.SinonStub;

    beforeEach(() => {
        countInvitedStub = sinon.stub(Store.pactMembers, 'countDistinctInvitedByCreator')
            .resolves(HABITS_SOLO_UNLOCK_INVITE_COUNT);
        findUserStub = sinon.stub(Store.users, 'findUser').resolves([{ accessLevels: [] }]);
        countActiveStub = sinon.stub(Store.userHabits, 'countActiveByUser').resolves(0);
        // Default: the caller is not tracking this habit yet, so a start is a
        // genuinely new habit and the cap applies.
        getByUserAndHabitStub = sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves(undefined);
        getOrCreateStub = sinon.stub(Store.userHabits, 'getOrCreate').resolves({
            id: 'uh-1', userId: 'user-1', habitGoalId: 'goal-1', status: 'active',
        } as any);
        setStatusStub = sinon.stub(Store.userHabits, 'setStatus').resolves({
            id: 'uh-1', userId: 'user-1', habitGoalId: 'goal-1', status: 'active',
        } as any);
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves([
            { id: 'uh-1', habitGoalId: 'goal-1', goalName: 'Meditate' } as any,
        ]);
        sinon.stub(Store.habitGoals, 'getById').resolves({ id: 'goal-1', name: 'Meditate' } as any);
        sinon.stub(Store.streaks, 'getOrCreate').resolves({} as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('the invite unlock', () => {
        it('blocks a user who has never invited anyone', async () => {
            countInvitedStub.resolves(0);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(403);
            expect(res.body.error).to.equal('solo-locked');
            expect(getOrCreateStub.called).to.equal(false);
        });

        it('blocks a user who is one invite short', async () => {
            // The boundary is the whole rule. An off-by-one here either gives
            // the feature away a friend early or moves the goalposts after the
            // user has done what the UI told them to.
            countInvitedStub.resolves(HABITS_SOLO_UNLOCK_INVITE_COUNT - 1);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(403);
            expect(getOrCreateStub.called).to.equal(false);
        });

        it('unlocks exactly at the threshold', async () => {
            countInvitedStub.resolves(HABITS_SOLO_UNLOCK_INVITE_COUNT);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(201);
            expect(getOrCreateStub.calledOnce).to.equal(true);
        });

        it('unlocks on invites SENT, without waiting for anyone to accept', async () => {
            // The dead end this avoids: gating on acceptance makes the user's
            // own progress depend on a friend who may never install the app.
            // The stub counts partner rows in any status by construction.
            countInvitedStub.resolves(HABITS_SOLO_UNLOCK_INVITE_COUNT);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(201);
        });

        it('returns the progress numbers on the denial', async () => {
            // The client draws "invite N more friends" from this response, so a
            // bare 403 would force a second round trip to say anything useful.
            countInvitedStub.resolves(1);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.body.invitedCount).to.equal(1);
            expect(res.body.requiredCount).to.equal(HABITS_SOLO_UNLOCK_INVITE_COUNT);
        });

        it('counts people, not invitations', async () => {
            // Guards the store method the gate reads. Counting membership rows
            // would let one friend invited to three pacts clear a bar that
            // exists to put the app in front of three people.
            countInvitedStub.resolves(0);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(403);
            expect(countInvitedStub.calledOnceWithExactly('user-1')).to.equal(true);
        });

        it('fails CLOSED when eligibility cannot be determined', async () => {
            // Unlike the habit cap: wrongly allowing solo habits skips the
            // onboarding the growth loop depends on and cannot be undone.
            countInvitedStub.rejects(new Error('connection terminated'));

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(403);
            expect(getOrCreateStub.called).to.equal(false);
        });

        it('answers 403, not 402, when locked AND at the habit cap', async () => {
            // Order matters. Being short of invites is not a paywall, and
            // selling a habit slot to someone who could unlock the feature for
            // free by inviting a friend is the wrong answer to give.
            countInvitedStub.resolves(0);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(403);
            expect(res.body.error).to.equal('solo-locked');
        });
    });

    describe('the free-tier cap', () => {
        it('denies a start when the user is at the limit', async () => {
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(402);
            expect(res.body.error).to.equal('habit-limit-reached');
            expect(getOrCreateStub.called).to.equal(false);
        });

        it('checks capacity BEFORE writing the tracking row', async () => {
            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            // Otherwise the new habit would be counted against its own limit.
            expect(countActiveStub.calledBefore(getOrCreateStub)).to.equal(true);
        });

        it('gates a restore the same way as a start', async () => {
            sinon.stub(Store.userHabits, 'getById').resolves({
                id: 'uh-1', userId: 'user-1', status: 'archived',
            } as any);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const res = makeRes();
            await restoreUserHabit(makeReq({ params: { id: 'uh-1' } }) as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(402);
            expect(setStatusStub.called).to.equal(false);
        });

        it('lets an entitled user past the limit', async () => {
            findUserStub.resolves([{ accessLevels: ['user.habits.lifetime'] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT + 5);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(201);
        });

        it('does not charge a slot for a habit already tracked actively', async () => {
            // The active row already occupies its slot, so re-starting it consumes
            // nothing. Charging for it puts a paywall in front of a no-op.
            getByUserAndHabitStub.resolves({
                id: 'uh-1', userId: 'user-1', habitGoalId: 'goal-1', status: 'active',
            } as any);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(201);
            expect(countActiveStub.called).to.equal(false);
        });

        it('still charges a slot when re-starting an archived habit', async () => {
            // Restoring an archived habit does take a slot back, so the cap has to
            // apply on this path even though the tracking row already exists.
            getByUserAndHabitStub.resolves({
                id: 'uh-1', userId: 'user-1', habitGoalId: 'goal-1', status: 'archived',
            } as any);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const res = makeRes();
            await createUserHabit(makeReq() as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(402);
            expect(res.body.error).to.equal('habit-limit-reached');
        });

        it('applies the cap to an inline goal, which cannot already be tracked', async () => {
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const res = makeRes();
            await createUserHabit(
                makeReq({ body: { habitGoalId: undefined, goal: { name: 'Stretch' } } }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.statusCode).to.equal(402);
            expect(getByUserAndHabitStub.called).to.equal(false);
        });
    });

    describe('archiving', () => {
        it('archives a habit the caller owns', async () => {
            setStatusStub.resolves({ id: 'uh-1', userId: 'user-1', status: 'archived' } as any);

            const res = makeRes();
            await archiveUserHabit(makeReq({ params: { id: 'uh-1' } }) as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(200);
            expect(setStatusStub.firstCall.args[2]).to.equal('archived');
        });

        it('404s on a habit belonging to someone else', async () => {
            setStatusStub.resolves(undefined);
            sinon.stub(Store.userHabits, 'getById').resolves({
                id: 'uh-1', userId: 'someone-else', status: 'active',
            } as any);

            const res = makeRes();
            await archiveUserHabit(makeReq({ params: { id: 'uh-1' } }) as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(404);
        });

        it('treats a repeat archive as a no-op rather than an error', async () => {
            setStatusStub.resolves(undefined);
            sinon.stub(Store.userHabits, 'getById').resolves({
                id: 'uh-1', userId: 'user-1', status: 'archived',
            } as any);

            const res = makeRes();
            await archiveUserHabit(makeReq({ params: { id: 'uh-1' } }) as any, res, (() => {}) as any);

            expect(res.statusCode).to.equal(200);
        });
    });
});
