import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, HABITS_FREE_HABIT_LIMIT } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { createCheckin } from '../../src/handlers/habitCheckins';

/**
 * `POST /habits/checkins` and the free-tier habit cap.
 *
 * A check-in on a goal with no tracking row creates one, and that row takes a
 * habit slot. The pact wizard writes the goal before the pact, so a pact refused
 * at the cap left an untracked goal that the dashboard still offered a check-in
 * on — and checking in started a habit the cap never saw. In production that is
 * how a free account reached 7 active habits against a limit of 5.
 *
 * Only the gate is under test. Past it the handler writes the check-in, which
 * these stubs do not model, so the tracking-row write is stubbed to reject with
 * a sentinel and "reached getOrCreate" is read off that.
 */

const USER_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const GOAL_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const PASSED_GATE = new Error('passed the capacity gate');

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

const callHandler = async (bodyOverrides: Record<string, any> = {}) => {
    const { captured, res } = buildRes();
    let error: any;
    try {
        await createCheckin({
            headers: { 'x-userid': USER_ID, 'x-localecode': 'en-us', 'x-brand-variation': BrandVariations.HABITS },
            body: { habitGoalId: GOAL_ID, status: 'completed', ...bodyOverrides },
        } as any, res, (() => undefined) as any);
    } catch (err) {
        error = err;
    }
    return { captured, error };
};

describe('createCheckin — free-tier habit cap', () => {
    let getActivePactsStub: sinon.SinonStub;
    let getByUserAndHabitStub: sinon.SinonStub;
    let countActiveStub: sinon.SinonStub;
    let getOrCreateStub: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(Store.habitGoals, 'getById').resolves({ id: GOAL_ID, goalType: 'build_good' } as any);
        getActivePactsStub = sinon.stub(Store.pacts, 'getActiveByUserAndHabitGoal').resolves([]);
        getByUserAndHabitStub = sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves(undefined);
        sinon.stub(Store.users, 'findUser').resolves([{ accessLevels: [] }] as any);
        countActiveStub = sinon.stub(Store.userHabits, 'countActiveByUser').resolves(HABITS_FREE_HABIT_LIMIT);
        sinon.stub(Store.userHabits, 'countStartedSinceByUser').resolves(0);
        getOrCreateStub = sinon.stub(Store.userHabits, 'getOrCreate').rejects(PASSED_GATE);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('answers 402 instead of starting an untracked habit at the cap', async () => {
        const { captured } = await callHandler();

        expect(captured.statusCode).to.equal(402);
        expect(captured.body.error).to.equal('habit-limit-reached');
        expect(getOrCreateStub.called, 'created a tracking row past the cap').to.equal(false);
    });

    it('lets the check-in start tracking while under the cap', async () => {
        countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT - 1);

        const { captured, error } = await callHandler();

        expect(captured.statusCode).to.not.equal(402);
        expect(error).to.equal(PASSED_GATE);
    });

    it('does not gate a habit that is already tracked', async () => {
        getByUserAndHabitStub.resolves({ id: 'uh-1', status: 'active' } as any);

        const { captured, error } = await callHandler();

        expect(captured.statusCode).to.not.equal(402);
        expect(error).to.equal(PASSED_GATE);
        expect(countActiveStub.called, 'counted a habit that already holds its slot').to.equal(false);
    });

    it('does not gate a check-in on a goal backing an active pact', async () => {
        getActivePactsStub.resolves([{ id: 'pact-1', habitGoalId: GOAL_ID, status: 'active' }] as any);

        const { captured, error } = await callHandler();

        expect(captured.statusCode).to.not.equal(402);
        expect(error).to.equal(PASSED_GATE);
        expect(getByUserAndHabitStub.called).to.equal(false);
    });

    // Regression: an explicit `pactId` is only checked for participation, so
    // exempting on "any pact resolved" let a pact the user was ever in switch
    // the cap off for every untracked goal.
    describe('with an explicit pactId', () => {
        const stubRequestedPact = (pact: Record<string, any>) => {
            sinon.stub(Store.pacts, 'getById').resolves({ id: 'pact-1', creatorUserId: USER_ID, ...pact } as any);
            sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(undefined);
        };

        it('still gates when the pact has ended', async () => {
            stubRequestedPact({ habitGoalId: GOAL_ID, status: 'expired' });

            const { captured } = await callHandler({ pactId: 'pact-1' });

            expect(captured.statusCode).to.equal(402);
            expect(getOrCreateStub.called, 'created a tracking row past the cap').to.equal(false);
        });

        it('still gates when the pact backs a different goal', async () => {
            stubRequestedPact({ habitGoalId: 'cccccccc-0000-4000-8000-00000000000c', status: 'active' });

            const { captured } = await callHandler({ pactId: 'pact-1' });

            expect(captured.statusCode).to.equal(402);
            expect(getOrCreateStub.called, 'created a tracking row past the cap').to.equal(false);
        });

        it('does not gate when the pact is active and backs this goal', async () => {
            stubRequestedPact({ habitGoalId: GOAL_ID, status: 'active' });

            const { captured, error } = await callHandler({ pactId: 'pact-1' });

            expect(captured.statusCode).to.not.equal(402);
            expect(error).to.equal(PASSED_GATE);
        });
    });
});
