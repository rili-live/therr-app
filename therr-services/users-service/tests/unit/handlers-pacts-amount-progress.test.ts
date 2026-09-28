import { expect } from 'chai';
import sinon from 'sinon';
import { HabitGoalTypes } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { getPact } from '../../src/handlers/pacts';

/**
 * The pact detail's weekly `amountProgress` is only for measured pacts. Most pacts are not
 * measured, and the detail view is one of the hottest habits reads, so an unmeasured pact
 * must not pay for the week lookup or a second goal read to find that out.
 */
describe('Pacts handler — getPact amount progress', () => {
    afterEach(() => sinon.restore());

    const buildRes = () => {
        const res: any = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);
        return res;
    };

    const req = {
        headers: { 'x-userid': 'user-1', 'x-username': 'user', 'x-localecode': 'en-us' },
        params: { id: 'pact-1' },
        query: {},
    };

    // Pending with no startDate, so member stats short-circuit without touching the store.
    const stubPact = (habitGoalAmountUnit: string | null) => {
        sinon.stub(Store.pacts, 'getByIdWithDetails').resolves({
            id: 'pact-1',
            habitGoalId: 'goal-1',
            creatorUserId: 'user-1',
            status: 'pending',
            habitGoalAmountUnit,
        });
        sinon.stub(Store.pactMembers, 'getByPactId').resolves([{ userId: 'user-1', status: 'active' }] as any);
    };

    it('skips the week lookup and goal re-read on a pact that is not measured', async () => {
        stubPact(null);
        const goalStub = sinon.stub(Store.habitGoals, 'getById').resolves({
            id: 'goal-1', goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: null,
        });
        const userStub = sinon.stub(Store.users, 'getUserById').resolves([]);
        const res = buildRes();

        await getPact(req as any, res, () => {});

        expect(res.status.firstCall.args[0]).to.equal(200);
        expect(res.send.firstCall.args[0]).to.not.have.property('amountProgress');
        expect(userStub.called).to.equal(false);
        // Once for the savings check, and not again for the amount check.
        expect(goalStub.callCount).to.equal(1);
    });

    it('attaches weekly amount progress to a measured pact', async () => {
        stubPact('minutes');
        sinon.stub(Store.habitGoals, 'getById').resolves({
            id: 'goal-1', goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: 'minutes', targetAmount: '180',
        });
        sinon.stub(Store.users, 'getUserById').resolves([{ id: 'user-1', settingsTimezone: 'America/Chicago' }] as any);
        sinon.stub(Store.habitCheckins, 'getAmountTotalsByPactMember').resolves([
            { userId: 'user-1', weekAmount: 90, totalAmount: 300 },
        ]);
        const res = buildRes();

        await getPact(req as any, res, () => {});

        const body = res.send.firstCall.args[0];
        expect(body.amountProgress).to.include({ amountUnit: 'minutes', weeklyTargetAmount: 180, viewerWeekAmount: 90 });
    });
});
