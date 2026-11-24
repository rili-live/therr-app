import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { openDrop } from '../../src/handlers/drops';
import { IDropRow } from '../../src/utilities/drops';

/**
 * openDrop — the request that loses a race to a concurrent open.
 *
 * `markOpened` only writes while `openedAt` is null, so when two opens overlap (a double tap, a
 * client retry) the second one's update matches no row. Its `row` was read before the first
 * write landed and still reads as locked; answering with it returned a 200 whose drop had
 * `status: 'locked'` and no message, so the app showed a successful open with nothing in it.
 */

const RECIPIENT = '22222222-2222-4222-8222-222222222222';
const SENDER = '11111111-1111-4111-8111-111111111111';
const DROP_ID = '33333333-3333-4333-8333-333333333333';

const lockedRow = (): IDropRow => ({
    id: DROP_ID,
    brandVariation: 'therr',
    batchId: '44444444-4444-4444-8444-444444444444',
    fromUserId: SENDER,
    toUserId: RECIPIENT,
    message: 'Look up',
    mediaPath: null,
    mediaType: null,
    latitude: 40.7128,
    longitude: -74.006,
    unlockRadiusMeters: 100,
    placeName: 'The bench',
    spaceId: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    openedAt: null,
    recipientDismissedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

const mockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

const openRequest = () => ({
    headers: { 'x-userid': RECIPIENT, 'x-localecode': 'en-us', 'x-brand-variation': 'therr' },
    params: { id: DROP_ID },
    body: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
});

describe('openDrop handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('answers with the opened drop when a concurrent request opened it first', async () => {
        const openedRow = { ...lockedRow(), openedAt: new Date().toISOString() };
        const getStub = sinon.stub(Store.drops, 'getForParticipant');
        getStub.onFirstCall().resolves(lockedRow());
        getStub.onSecondCall().resolves(openedRow);
        sinon.stub(Store.drops, 'markOpened').resolves(undefined);
        sinon.stub(Store.users, 'findUsers').resolves([]);

        const res = mockRes();
        await (openDrop as any)(openRequest(), res);

        expect(res.status.firstCall.args[0]).to.equal(200);
        const payload = res.send.firstCall.args[0];
        expect(payload.justOpened).to.equal(false);
        expect(payload.drop.status).to.equal('opened');
        expect(payload.drop.message).to.equal('Look up');
    });

    it('does not re-read a drop this request opened itself', async () => {
        const openedRow = { ...lockedRow(), openedAt: new Date().toISOString() };
        const getStub = sinon.stub(Store.drops, 'getForParticipant').resolves(lockedRow());
        sinon.stub(Store.drops, 'markOpened').resolves(openedRow);
        sinon.stub(Store.users, 'findUsers').resolves([]);

        const res = mockRes();
        // shouldNotifySender: false keeps the sender push (a real HTTP call) out of a unit test.
        await (openDrop as any)({ ...openRequest(), body: { ...openRequest().body, shouldNotifySender: false } }, res);

        expect(getStub.callCount).to.equal(1);
        expect(res.status.firstCall.args[0]).to.equal(200);
        expect(res.send.firstCall.args[0].drop.status).to.equal('opened');
        expect(res.send.firstCall.args[0].justOpened).to.equal(true);
    });
});
