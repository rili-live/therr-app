import { expect } from 'chai';
import sinon from 'sinon';
import PactJoinRequestsStore from '../../src/store/PactJoinRequestsStore';

const buildStore = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const store = new PactJoinRequestsStore({
        read: { query: readStub } as any,
        write: { query: sinon.stub().resolves({ rows: [] }) } as any,
    });
    return { store, readStub };
};

describe('PactJoinRequestsStore.getPendingByPact', () => {
    it('lists every pending requester for the creator, deleted accounts included', async () => {
        const { store, readStub } = buildStore();
        await store.getPendingByPact('pact-1');

        expect(readStub.firstCall.args[0]).to.not.contain('settingsIsAccountSoftDeleted');
    });

    // The open-pact handoff must never make a deleted account the pact's new host.
    it('drops requesters who deleted their account when asked to', async () => {
        const { store, readStub } = buildStore();
        await store.getPendingByPact('pact-1', { excludeSoftDeletedRequesters: true });

        const sql = readStub.firstCall.args[0];
        expect(sql).to.contain('"main"."users"."settingsIsAccountSoftDeleted" = false');
        expect(sql).to.contain('"main"."users"."settingsIsAccountSoftDeleted" is null');
        expect(sql).to.match(/"status" = 'pending' and \(/);
    });
});
