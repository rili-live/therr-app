import { expect } from 'chai';
import sinon from 'sinon';
import PactMembersStore from '../../src/store/PactMembersStore';

const buildStore = (rows: any[] = []) => {
    const mockConnection = {
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows })),
        },
    };

    return { store: new PactMembersStore(mockConnection as any), mockConnection };
};

describe('PactMembersStore', () => {
    describe('getByPactIds', () => {
        // The pact list endpoints hydrate `members` so the client can name the
        // partner it is waiting on. Doing that per pact would be an N+1; this
        // batches the whole page into one query.
        it('fetches members for every pact in one query, joined to user names', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByPactIds(['pact-1', 'pact-2']);

            expect(mockConnection.read.query.callCount).to.be.equal(1);
            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"habits"."pact_members"');
            expect(queryString).to.contain('in (\'pact-1\', \'pact-2\')');
            expect(queryString).to.contain('"main"."users"');
            expect(queryString).to.contain('"userName"');
        });

        // knex emits an empty string for `.whereIn(col, [])` operands in some
        // builder positions and pg rejects an empty query; a user with no pacts
        // is the common case on a fresh account.
        it('resolves empty without querying when there are no pact ids', async () => {
            const { store, mockConnection } = buildStore();

            const result = await store.getByPactIds([]);

            expect(result).to.deep.equal([]);
            expect(mockConnection.read.query.called).to.be.equal(false);
        });

        it('returns the queried rows', async () => {
            const { store } = buildStore([
                { id: 'member-1', pactId: 'pact-1', role: 'creator' },
                { id: 'member-2', pactId: 'pact-1', role: 'partner' },
            ]);

            const result = await store.getByPactIds(['pact-1']);

            expect(result).to.have.lengthOf(2);
            expect(result[1].role).to.be.equal('partner');
        });
    });

    describe('getByPactId', () => {
        // getByPactId delegates to the batch query so the two cannot drift in
        // the columns they expose. getPact returns its result straight to the
        // client, so a dropped join column here is a blank partner name there.
        it('selects the same hydrated columns as the batch query', async () => {
            const single = buildStore();
            const batch = buildStore();

            await single.store.getByPactId('pact-1');
            await batch.store.getByPactIds(['pact-1']);

            expect(single.mockConnection.read.query.args[0][0])
                .to.be.equal(batch.mockConnection.read.query.args[0][0]);
        });

        it('still filters to the requested pact', async () => {
            const { store, mockConnection } = buildStore();

            await store.getByPactId('pact-1');

            const queryString = mockConnection.read.query.args[0][0];
            expect(queryString).to.contain('"habits"."pact_members"."pactId" in (\'pact-1\')');
        });
    });
});
