import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import sinon from 'sinon';
import redisSessions from '../../../src/store/redisSessions';
import deleteUserData from '../../../src/handlers/deleteUserData';

const TEST_JWT_SECRET = 'test-websocket-jwt-secret';

const buildMockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

const signToken = (payload: any, secret = TEST_JWT_SECRET) => jwt.sign(payload, secret);

// Every request the handler should honor carries the caller's own bearer token, exactly as
// the users-service fan-out forwards it.
const buildAuthedReq = (userId: string, token = signToken({ id: userId })) => ({
    headers: {
        'x-userid': userId,
        authorization: `Bearer ${token}`,
    },
});

describe('Delete User Data Handler', () => {
    let originalJwtSecret: string | undefined;

    beforeEach(() => {
        originalJwtSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = TEST_JWT_SECRET;
    });

    afterEach(() => {
        if (originalJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalJwtSecret;
        }
        sinon.restore();
    });

    it('removes the socket session for a user with a live connection', async () => {
        sinon.stub(redisSessions, 'getUserById').resolves({ user: { id: 'user-1' }, socketId: 'socket-abc' });
        const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
        const res = buildMockRes();

        await deleteUserData(buildAuthedReq('user-1'), res);

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

        await deleteUserData(buildAuthedReq('user-1'), res);

        expect(removeStub.called).to.be.eq(false);
        expect(res.status.args[0][0]).to.equal(202);
        expect(res.send.args[0][0]).to.deep.equal({ sessionsRemoved: 0 });
    });

    it('does not call remove when the session record carries no socketId', async () => {
        sinon.stub(redisSessions, 'getUserById').resolves({ user: { id: 'user-1' }, socketId: undefined });
        const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
        const res = buildMockRes();

        await deleteUserData(buildAuthedReq('user-1'), res);

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

    // websocket-service is published at websocket-service.therr.com with a catch-all path,
    // so every express route on it is internet-facing. `x-userid` is attacker-controlled on
    // that path; without a verified token it would be a remote "log anyone out" button.
    describe('authentication', () => {
        it('rejects a request carrying x-userid but no bearer token', async () => {
            const getStub = sinon.stub(redisSessions, 'getUserById').resolves(null);
            const res = buildMockRes();

            await deleteUserData({ headers: { 'x-userid': 'victim-1' } }, res);

            expect(getStub.called).to.be.eq(false);
            expect(res.status.args[0][0]).to.equal(401);
        });

        it('rejects a token signed with the wrong secret', async () => {
            const getStub = sinon.stub(redisSessions, 'getUserById').resolves(null);
            const res = buildMockRes();
            const forged = signToken({ id: 'victim-1' }, 'not-the-real-secret');

            await deleteUserData(buildAuthedReq('victim-1', forged), res);

            expect(getStub.called).to.be.eq(false);
            expect(res.status.args[0][0]).to.equal(401);
        });

        it('refuses to tear down a session belonging to someone other than the token holder', async () => {
            const getStub = sinon.stub(redisSessions, 'getUserById').resolves({ user: { id: 'victim-1' }, socketId: 'socket-victim' });
            const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
            const res = buildMockRes();
            const attackerToken = signToken({ id: 'attacker-9' });

            await deleteUserData(buildAuthedReq('victim-1', attackerToken), res);

            expect(getStub.called).to.be.eq(false);
            expect(removeStub.called).to.be.eq(false);
            expect(res.status.args[0][0]).to.equal(401);
        });

        it('rejects a token minted for a different audience', async () => {
            const getStub = sinon.stub(redisSessions, 'getUserById').resolves(null);
            const res = buildMockRes();
            const foreign = signToken({ id: 'user-1', aud: 'some-other-app' });

            await deleteUserData(buildAuthedReq('user-1', foreign), res);

            expect(getStub.called).to.be.eq(false);
            expect(res.status.args[0][0]).to.equal(401);
        });

        it('accepts a legacy token that carries no iss/aud claims', async () => {
            sinon.stub(redisSessions, 'getUserById').resolves({ user: { id: 'user-1' }, socketId: 'socket-abc' });
            const removeStub = sinon.stub(redisSessions, 'remove').resolves([]);
            const res = buildMockRes();

            await deleteUserData(buildAuthedReq('user-1'), res);

            expect(removeStub.calledOnceWith('socket-abc')).to.be.eq(true);
            expect(res.status.args[0][0]).to.equal(202);
        });
    });

    it('reports a redis failure rather than claiming the session was removed', async () => {
        sinon.stub(redisSessions, 'getUserById').rejects(new Error('redis down'));
        const res = buildMockRes();

        await deleteUserData(buildAuthedReq('user-1'), res);

        expect(res.status.args[0][0]).to.equal(500);
    });
});
