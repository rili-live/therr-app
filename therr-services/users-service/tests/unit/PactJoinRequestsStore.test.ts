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

// Who may host a handed-off pact is judged by the same signs of life as the creator who left it.
describe('PactJoinRequestsStore.getLastActiveAtByUser', () => {
    it('reads login, any check-in and this pact\'s chat for each user, keyed by id', async () => {
        const { store, readStub } = buildStore();
        readStub.callsFake(() => Promise.resolve({ rows: [{ id: 'u-1', lastActiveAt: '2026-11-20T00:00:00.000Z' }] }));
        const result = await store.getLastActiveAtByUser('pact-1', ['u-1', 'u-2']);

        const sql = readStub.firstCall.args[0];
        expect(sql).to.contain('"u"."lastLoginAt"');
        expect(sql).to.contain('hc."userId" = "u"."id"');
        expect(sql).to.contain('pm."pactId" = \'pact-1\' AND pm."userId" = "u"."id"');
        expect(sql).to.contain('in (\'u-1\', \'u-2\')');
        expect(result['u-1'].toISOString()).to.equal('2026-11-20T00:00:00.000Z');
        expect(result).to.not.have.property('u-2');
    });

    it('reads nothing for nobody', async () => {
        const { store, readStub } = buildStore();
        expect(await store.getLastActiveAtByUser('pact-1', [])).to.deep.equal({});
        expect(readStub.called).to.equal(false);
    });
});
