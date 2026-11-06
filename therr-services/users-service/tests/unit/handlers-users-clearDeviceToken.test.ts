/**
 * POST /users/internal/clear-device-token — push-notifications-service calls this when FCM
 * reports a token dead.
 *
 * The brand-scoped delete used to be chained *after* the legacy users-column update, so
 * when that update failed — a NOT NULL violation on every call from April to 2026-10-27 —
 * the row push routing actually reads was never deleted. Every send to an uninstalled app
 * kept 502ing; in October 2026 that was about half of all habits queue rows.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { clearUserDeviceToken } from '../../src/handlers/users';

const makeRes = () => {
    const res: any = { statusCode: undefined, body: undefined, sendCount: 0 };
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.send = (payload: any) => {
        res.sendCount += 1;
        res.body = payload;
        return res;
    };
    return res;
};

const call = async () => {
    const req: any = { headers: {}, body: { userId: 'user-1', deviceToken: 'dead-token' } };
    const res = makeRes();
    await (clearUserDeviceToken as any)(req, res, () => undefined);
    return res;
};

describe('clearUserDeviceToken', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('deletes the brand-scoped registration even when the legacy column update fails', async () => {
        sinon.stub(Store.users, 'clearDeviceToken')
            .rejects(new Error('null value in column "deviceMobileFirebaseToken" violates not-null constraint'));
        const deleteByToken = sinon.stub(Store.userDeviceTokens, 'deleteByToken').resolves(1);

        const res = await call();

        expect(deleteByToken.calledOnceWithExactly('dead-token')).to.equal(true);
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.deep.equal({ cleared: true });
        expect(res.sendCount).to.equal(1);
    });

    it('clears both when both succeed', async () => {
        const clearDeviceToken = sinon.stub(Store.users, 'clearDeviceToken').resolves([{ id: 'user-1' }] as any);
        sinon.stub(Store.userDeviceTokens, 'deleteByToken').resolves(1);

        const res = await call();

        expect(clearDeviceToken.calledOnceWithExactly('user-1', 'dead-token')).to.equal(true);
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.deep.equal({ cleared: true });
    });

    it('reports a failure when the routing table delete itself fails', async () => {
        sinon.stub(Store.users, 'clearDeviceToken').resolves([] as any);
        sinon.stub(Store.userDeviceTokens, 'deleteByToken').rejects(new Error('write pool exhausted'));

        const res = await call();

        expect(res.statusCode).to.equal(500);
        expect(res.sendCount).to.equal(1);
    });

    it('answers cleared: false when nothing matched', async () => {
        sinon.stub(Store.users, 'clearDeviceToken').resolves([] as any);
        sinon.stub(Store.userDeviceTokens, 'deleteByToken').resolves(0);

        const res = await call();

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.deep.equal({ cleared: false });
    });
});
