/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import HabitGoalsStore from '../../src/store/HabitGoalsStore';

const buildStore = () => {
    const mockConnection = {
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
    };

    return { store: new HabitGoalsStore(mockConnection as any), mockConnection };
};

describe('HabitGoalsStore', () => {
    describe('getByUserId', () => {
        // Regression: the Habits dashboard renders this list and offers a
        // check-in per row. Filtering on createdByUserId alone meant an invitee
        // who accepted a pact never saw the habit they joined — the goal row
        // belongs to whoever sent the invite — so the dashboard showed only the
        // inviter's own goals (including ones whose pacts were still pending)
        // and silently omitted the active pact.
        it('includes goals joined through an active pact membership', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByUserId('user-1');

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"habits"."habit_goals"');
            expect(queryString).to.contain('"createdByUserId" = \'user-1\'');
            expect(queryString).to.contain('"habits"."pact_members"');
            expect(queryString).to.contain('"habits"."pacts"');
            expect(queryString).to.contain('"habitGoalId"');
        });

        it('only counts memberships the user has actually accepted', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByUserId('user-1');

            const queryString = mockConnection.read.query.args[0][0];
            // An invite the user has not accepted yet leaves pact_members.status
            // as 'pending'; that habit must stay out of their list.
            expect(queryString).to.contain('"habits"."pact_members"."status" = \'active\'');
        });

        it('falls back to the legacy partnerUserId column for pre-pact_members pacts', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByUserId('user-1');

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"partnerUserId" = \'user-1\'');
            expect(queryString).to.contain('"habits"."pacts"."status" = \'active\'');
        });

        it('applies limit and offset to the outer goal query', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByUserId('user-1', 10, 20);

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('limit 10');
            expect(queryString).to.contain('offset 20');
        });

        it('returns the queried rows', async () => {
            const { store, mockConnection } = buildStore();
            mockConnection.read.query.callsFake(() => Promise.resolve({
                rows: [{ id: 'goal-1' }, { id: 'goal-2' }],
            }));

            const result = await store.getByUserId('user-1');

            expect(result).to.deep.equal([{ id: 'goal-1' }, { id: 'goal-2' }]);
        });
    });
});
