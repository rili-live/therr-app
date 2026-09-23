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

        // Regression: the pact wizard creates the goal before the pact, so a pact
        // refused at the free-tier cap left a goal nobody tracked. Listing it put
        // it on the dashboard as a live habit, and a check-in on it became a
        // habit the cap never counted.
        it('lists a goal the user created only once it is tracked or backs a pact they created', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByUserId('user-1');

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"habits"."user_habits"."userId" = \'user-1\'');
            expect(queryString).to.contain('"habits"."pacts"."creatorUserId" = \'user-1\'');
            // Ownership alone must not be a sufficient condition.
            expect(queryString).to.match(/"createdByUserId" = 'user-1' and \(/);
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
