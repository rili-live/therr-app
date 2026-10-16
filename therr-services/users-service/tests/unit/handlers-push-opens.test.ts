import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { recordPushOpen } from '../../src/handlers/notifications';

/**
 * Push open tracking — POST /users/notifications/push-opens.
 *
 * The id arrives from the device, so the two things worth pinning are that the write is
 * scoped to the caller (user + brand from headers, never from the body), and that the
 * response says nothing about whether the id existed.
 */

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const QUEUE_ID = 'cccccccc-0000-4000-8000-000000000003';

const call = async (body: any, { userId = USER_ID, brand = 'habits' }: any = {}) => {
    const captured: { statusCode?: number; body?: any } = {};
    const res = {
        status: (statusCode: number) => {
            captured.statusCode = statusCode;
            return { send: (payload?: any) => { captured.body = payload; return payload; } };
        },
    } as any;
    await recordPushOpen({
        headers: {
            'x-userid': userId,
            'x-localecode': 'en-us',
            'x-brand-variation': brand,
        },
        params: {},
        body,
        query: {},
    } as any, res);
    return captured;
};

describe('recordPushOpen', () => {
    let markOpened: sinon.SinonStub;

    beforeEach(() => {
        markOpened = sinon.stub(Store.notificationQueue, 'markOpened').resolves(1);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('stamps the open against the caller\'s own user and brand', async () => {
        const result = await call({ notificationQueueId: QUEUE_ID, pressActionId: 'habit-checkin' });

        expect(result.statusCode).to.equal(204);
        expect(markOpened.calledOnce).to.equal(true);
        expect(markOpened.firstCall.args).to.deep.equal([
            BrandVariations.HABITS, USER_ID, QUEUE_ID, 'habit-checkin',
        ]);
    });

    it('ignores a userId in the body', async () => {
        await call({ notificationQueueId: QUEUE_ID, userId: 'bbbbbbbb-0000-4000-8000-000000000002' });

        expect(markOpened.firstCall.args[1]).to.equal(USER_ID);
    });

    it('answers 204 when nothing matched, so it is no oracle for ids the caller does not own', async () => {
        markOpened.resolves(0);

        const result = await call({ notificationQueueId: QUEUE_ID });

        expect(result.statusCode).to.equal(204);
    });

    it('records a null action when none is given', async () => {
        await call({ notificationQueueId: QUEUE_ID });

        expect(markOpened.firstCall.args[3]).to.equal(null);
    });

    it('rejects an id that is not a uuid before it reaches SQL', async () => {
        const result = await call({ notificationQueueId: 'not-a-uuid' });

        expect(result.statusCode).to.equal(400);
        expect(markOpened.called).to.equal(false);
    });

    it('truncates an over-long action rather than failing the write', async () => {
        await call({ notificationQueueId: QUEUE_ID, pressActionId: 'x'.repeat(500) });

        expect(markOpened.firstCall.args[3]).to.have.length(100);
    });
});
