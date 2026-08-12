import { expect } from 'chai';
import sinon from 'sinon';
import redisSessions from '../../../src/store/redisSessions';
import deleteUserData from '../../../src/handlers/deleteUserData';

const buildMockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

describe('Delete User Data Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('removes the socket session for a user with a live connection', async () => {
        sinon.stub(redisSessions, 'getUserById').resolves({ user: { id: 'user-1' }, socketId: 'socket-abc' });
        const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
        const res = buildMockRes();

        await deleteUserData({ headers: { 'x-userid': 'user-1' } }, res);

        expect(removeStub.calledOnceWith('socket-abc')).to.be.eq(true);
        expect(res.status.args[0][0]).to.equal(202);
        expect(res.send.args[0][0]).to.deep.equal({ sessionsRemoved: 1 });
    });

    // Account deletion is far more likely from a web session than with a socket open.
    // Reporting "no session" as a failure would make the users-service fan-out log an
    // error on the common path and bury the failures that actually matter.
    it('treats a user with no live session as a success', async () => {
        sinon.stub(redisSessions, 'getUserById').resolves(null);
        const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
        const res = buildMockRes();

        await deleteUserData({ headers: { 'x-userid': 'user-1' } }, res);

        expect(removeStub.called).to.be.eq(false);
        expect(res.status.args[0][0]).to.equal(202);
        expect(res.send.args[0][0]).to.deep.equal({ sessionsRemoved: 0 });
    });

    it('does not call remove when the session record carries no socketId', async () => {
        sinon.stub(redisSessions, 'getUserById').resolves({ user: { id: 'user-1' }, socketId: undefined });
        const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
        const res = buildMockRes();

        await deleteUserData({ headers: { 'x-userid': 'user-1' } }, res);

        expect(removeStub.called).to.be.eq(false);
        expect(res.status.args[0][0]).to.equal(202);
    });

    it('rejects an unidentified request', async () => {
        const getStub = sinon.stub(redisSessions, 'getUserById').resolves(null);
        const res = buildMockRes();

        await deleteUserData({ headers: {} }, res);

        expect(getStub.called).to.be.eq(false);
        expect(res.status.args[0][0]).to.equal(401);
    });

    it('reports a redis failure rather than claiming the session was removed', async () => {
        sinon.stub(redisSessions, 'getUserById').rejects(new Error('redis down'));
        const res = buildMockRes();

        await deleteUserData({ headers: { 'x-userid': 'user-1' } }, res);

        expect(res.status.args[0][0]).to.equal(500);
    });
});
