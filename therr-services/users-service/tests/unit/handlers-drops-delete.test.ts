import { expect } from 'chai';
import sinon from 'sinon';
import { storage } from '../../src/api/aws';
import Store from '../../src/store';
import { deleteDrop, deleteDropMediaIfUnreferenced } from '../../src/handlers/drops';
import { IDropRow } from '../../src/utilities/drops';

/**
 * Deleting a drop removes its photo from the private bucket, but only once no row still points
 * at it: one drop left for several friends writes one row per friend over a single upload, so
 * the sender deleting one copy must leave the photo for the copies that remain.
 */

const SENDER = '11111111-1111-4111-8111-111111111111';
const RECIPIENT = '22222222-2222-4222-8222-222222222222';
const DROP_ID = '33333333-3333-4333-8333-333333333333';
const MEDIA_PATH = `${SENDER}/drops/drop.jpg`;

const row = (overrides: Partial<IDropRow> = {}): IDropRow => ({
    id: DROP_ID,
    brandVariation: 'therr',
    batchId: '44444444-4444-4444-8444-444444444444',
    fromUserId: SENDER,
    toUserId: RECIPIENT,
    message: '',
    mediaPath: MEDIA_PATH,
    mediaType: 'user-image-private',
    latitude: 40.7128,
    longitude: -74.006,
    unlockRadiusMeters: 100,
    placeName: null,
    spaceId: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    openedAt: null,
    recipientDismissedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
});

const mockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

const deleteRequest = (userId: string) => ({
    headers: { 'x-userid': userId, 'x-localecode': 'en-us', 'x-brand-variation': 'therr' },
    params: { id: DROP_ID },
});

const stubBucket = () => {
    const deleteStub = sinon.stub().resolves();
    const fileStub = sinon.stub().returns({ delete: deleteStub });
    const bucketStub = sinon.stub(storage, 'bucket').returns({ file: fileStub } as any);
    return { bucketStub, fileStub, deleteStub };
};

describe('Drops — photo cleanup on delete', () => {
    const originalBucket = process.env.BUCKET_PRIVATE_USER_DATA;

    beforeEach(() => {
        process.env.BUCKET_PRIVATE_USER_DATA = 'test-private-bucket';
    });

    afterEach(() => {
        sinon.restore();
        process.env.BUCKET_PRIVATE_USER_DATA = originalBucket;
    });

    it('deletes the photo from the private bucket once no drop references it', async () => {
        sinon.stub(Store.drops, 'countByMediaPath').resolves(0);
        const { bucketStub, fileStub, deleteStub } = stubBucket();

        const deleted = await deleteDropMediaIfUnreferenced('therr', MEDIA_PATH);

        expect(deleted).to.equal(true);
        expect(bucketStub.firstCall.args[0]).to.equal('test-private-bucket');
        expect(fileStub.firstCall.args[0]).to.equal(MEDIA_PATH);
        expect(deleteStub.firstCall.args[0]).to.deep.equal({ ignoreNotFound: true });
    });

    it('keeps the photo while another recipient\'s copy of the drop still shows it', async () => {
        sinon.stub(Store.drops, 'countByMediaPath').resolves(2);
        const { deleteStub } = stubBucket();

        const deleted = await deleteDropMediaIfUnreferenced('therr', MEDIA_PATH);

        expect(deleted).to.equal(false);
        expect(deleteStub.called).to.equal(false);
    });

    it('removes the photo when the sender deletes their last copy', async () => {
        sinon.stub(Store.drops, 'getForParticipant').resolves(row());
        sinon.stub(Store.drops, 'deleteForSender').resolves(1);
        sinon.stub(Store.drops, 'countByMediaPath').resolves(0);
        const { deleteStub } = stubBucket();

        const res = mockRes();
        await (deleteDrop as any)(deleteRequest(SENDER), res);

        expect(res.status.firstCall.args[0]).to.equal(200);
        expect(res.send.firstCall.args[0].deleted).to.equal(true);
        expect(deleteStub.calledOnce).to.equal(true);
    });

    it('still deletes the drop when removing the photo fails', async () => {
        sinon.stub(Store.drops, 'getForParticipant').resolves(row());
        sinon.stub(Store.drops, 'deleteForSender').resolves(1);
        sinon.stub(Store.drops, 'countByMediaPath').resolves(0);
        const { deleteStub } = stubBucket();
        deleteStub.rejects(new Error('403 storage.objects.delete denied'));

        const res = mockRes();
        await (deleteDrop as any)(deleteRequest(SENDER), res);

        expect(res.status.firstCall.args[0]).to.equal(200);
        expect(res.send.firstCall.args[0].deleted).to.equal(true);
    });

    it('never touches the photo when the recipient dismisses their copy', async () => {
        sinon.stub(Store.drops, 'getForParticipant').resolves(row());
        sinon.stub(Store.drops, 'dismissForRecipient').resolves(1);
        const countStub = sinon.stub(Store.drops, 'countByMediaPath').resolves(0);
        const { deleteStub } = stubBucket();

        const res = mockRes();
        await (deleteDrop as any)(deleteRequest(RECIPIENT), res);

        expect(res.send.firstCall.args[0].dismissed).to.equal(true);
        expect(countStub.called).to.equal(false);
        expect(deleteStub.called).to.equal(false);
    });
});
