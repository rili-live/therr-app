import { expect } from 'chai';
import sinon from 'sinon';
import HabitCheckinsStore from '../../src/store/HabitCheckinsStore';

const buildStore = (rows: any[] = []) => {
    const mockConnection = {
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows })),
        },
    };

    return { store: new HabitCheckinsStore(mockConnection as any), mockConnection };
};

describe('HabitCheckinsStore — savings amounts', () => {
    describe('numeric coercion', () => {
        // node-postgres returns every `numeric` as a string. Left alone, a check-in's
        // amount reaches the client as "12.50" and `total + row.savedAmount` becomes
        // string concatenation — an error that looks like it works until the numbers
        // get large enough to notice.
        it('turns the driver\'s numeric string into a number on reads', async () => {
            const { store } = buildStore([{ id: 'c1', savedAmount: '12.50' }]);

            const [row] = await store.get({ id: 'c1' });

            expect(row.savedAmount).to.equal(12.5);
            expect(typeof row.savedAmount).to.equal('number');
        });

        it('leaves a null amount null rather than coercing it to zero', async () => {
            // Null is "no amount recorded" and 0 is "I saved nothing today". Totals
            // ignore the first and include the second.
            const { store } = buildStore([{ id: 'c1', savedAmount: null }]);

            const [row] = await store.get({ id: 'c1' });

            expect(row.savedAmount).to.equal(null);
        });

        it('coerces on the write paths too, since they return the row', async () => {
            const { store } = buildStore([{ id: 'c1', savedAmount: '30.00' }]);

            const created = await store.createOrUpdate({
                userId: 'u1',
                habitGoalId: 'g1',
                scheduledDate: '2026-09-20',
                savedAmount: 30,
            });

            expect(created.savedAmount).to.equal(30);
        });
    });

    describe('createOrUpdate', () => {
        it('writes the amount and merges it on a repeat submission', async () => {
            const { store, mockConnection } = buildStore([{ id: 'c1' }]);

            await store.createOrUpdate({
                userId: 'u1',
                habitGoalId: 'g1',
                scheduledDate: '2026-09-20',
                savedAmount: 42.5,
            });

            const queryString = mockConnection.write.query.args[0][0];
            expect(queryString).to.contain('"savedAmount"');
            expect(queryString).to.contain('42.5');
            expect(queryString).to.contain('on conflict');
        });

        it('omits the column entirely when no amount was supplied', async () => {
            // Knex drops undefined keys from the merge, which is what lets an "add a
            // note" edit leave an existing amount alone. If this ever started writing
            // NULL instead, editing a note would erase the money.
            const { store, mockConnection } = buildStore([{ id: 'c1' }]);

            await store.createOrUpdate({
                userId: 'u1',
                habitGoalId: 'g1',
                scheduledDate: '2026-09-20',
                notes: 'just a note',
            });

            expect(mockConnection.write.query.args[0][0]).to.not.contain('savedAmount');
        });
    });

    describe('getSavingsTotalsByPactMember', () => {
        it('drives from pact_members so a member who saved nothing still appears', async () => {
            const { store, mockConnection } = buildStore();

            await store.getSavingsTotalsByPactMember('pact-1', 'goal-1');

            const queryString = mockConnection.read.query.args[0][0];
            // A LEFT JOIN from membership is what produces the "Sam: $0" row. An inner
            // join would omit them, which reads as "no data" rather than "nothing yet".
            expect(queryString).to.contain('FROM habits.pact_members pm');
            expect(queryString).to.contain('LEFT JOIN habits.habit_checkins c');
            expect(queryString).to.contain('SUM(c."savedAmount")');
        });

        it('pairs check-ins on the habit goal, not on the stamped pactId', async () => {
            // A check-in stamps one pactId even when its goal backs several pacts, so
            // matching on that column undercounts a member holding the habit through
            // more than one pact.
            const { store, mockConnection } = buildStore();

            await store.getSavingsTotalsByPactMember('pact-1', 'goal-1');

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('c."habitGoalId" = \'goal-1\'');
            expect(queryString).to.contain('c."userId" = pm."userId"');
            expect(queryString).to.not.contain('c."pactId"');
        });

        it('parses the aggregate back into numbers, defaulting an empty sum to 0', async () => {
            const { store } = buildStore([
                { userId: 'a', totalSaved: '250.00', contributionCount: 3 },
                { userId: 'b', totalSaved: '0', contributionCount: 0 },
            ]);

            const totals = await store.getSavingsTotalsByPactMember('pact-1', 'goal-1');

            expect(totals).to.deep.equal([
                { userId: 'a', totalSaved: 250, contributionCount: 3 },
                { userId: 'b', totalSaved: 0, contributionCount: 0 },
            ]);
        });
    });

    describe('getSavingsTotalsByGoalForUser', () => {
        it('short-circuits without querying when there are no goals', async () => {
            const { store, mockConnection } = buildStore();

            const totals = await store.getSavingsTotalsByGoalForUser('u1', []);

            expect(totals).to.deep.equal({});
            expect(mockConnection.read.query.called).to.equal(false);
        });

        it('sums across every cycle rather than scoping to a pact or a window', async () => {
            // A renewal is a new pact row on the same goal, so scoping to the current
            // cycle would reset a saver's cumulative total each time the group
            // re-committed — the one number they most expect to keep growing.
            const { store, mockConnection } = buildStore();

            await store.getSavingsTotalsByGoalForUser('u1', ['g1', 'g2']);

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('group by "habitGoalId"');
            expect(queryString).to.not.contain('pactId');
            expect(queryString).to.not.contain('scheduledDate');
        });

        it('escapes each goal id individually rather than joining them into an array literal', async () => {
            // `{a,b}` assembled by hand lets a `,` or `}` inside one id split or
            // terminate the list; the builder quotes each value on its own.
            const { store, mockConnection } = buildStore();

            await store.getSavingsTotalsByGoalForUser('u1', ['g1', "g2'}, 'x"]);

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"habitGoalId" in (\'g1\', \'g2\'\'}, \'\'x\')');
            expect(queryString).to.not.contain('ANY(');
        });

        it('returns a map of goal id to total, omitting goals with nothing saved', async () => {
            const { store } = buildStore([{ habitGoalId: 'g1', totalSaved: '75.25', contributionCount: 3 }]);

            const totals = await store.getSavingsTotalsByGoalForUser('u1', ['g1', 'g2']);

            expect(totals).to.deep.equal({ g1: { totalSaved: 75.25, contributionCount: 3 } });
        });
    });
});
