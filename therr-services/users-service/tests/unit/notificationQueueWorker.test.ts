/* eslint-disable quotes, max-len */
/**
 * Notification queue worker — the queue row is the authority, not the payload.
 *
 * `main.notificationQueue.payload` is free-form jsonb written by whichever
 * producer enqueued the notification, and it is forwarded verbatim into
 * `sendEmailAndOrPushNotification`. That function's argument type
 * (`ISendPushNotification`) declares `toUserId`, `type` and `brandVariation`
 * among its fields, so a producer that copies the shape of an existing inline
 * send call into `payload` is doing the obvious thing.
 *
 * Two of those keys are load-bearing downstream:
 *
 *   - `toUserId`       selects the recipient (`findUser`)
 *   - `brandVariation` selects which brand's device token is resolved
 *                      (`resolveDeviceTokenForBrand`), and therefore which
 *                      Firebase project the push goes through
 *
 * If the payload can override them, a stale or copy-pasted value sends the
 * wrong person a push through the wrong brand's Firebase project — precisely
 * the leak the brand scoping on this table exists to prevent, and one that
 * would be invisible in logs because the send still "succeeds".
 *
 * These tests drive the real exported tick against a deliberately poisoned
 * payload and assert the row wins.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import { runNotificationQueueTick } from '../../src/utilities/notificationQueueWorker';

const ROW_USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const PAYLOAD_USER_ID = 'bbbbbbbb-0000-4000-8000-000000000002';

/**
 * A row queued for Habits whose payload claims to be a Therr notification for a
 * different user. Nothing stops a producer writing this — the point is that it
 * must not change where the push goes.
 */
const buildPoisonedRow = () => ({
    id: 'cccccccc-0000-4000-8000-000000000003',
    userId: ROW_USER_ID,
    brandVariation: BrandVariations.HABITS,
    type: 'streak-at-risk',
    dedupeKey: 'streak-at-risk:pact-1:2026-08-09',
    payload: {
        habitName: 'Morning run',
        // The poison.
        toUserId: PAYLOAD_USER_ID,
        brandVariation: BrandVariations.THERR,
        type: 'some-other-type',
    },
    status: 'failed' as const,
    scheduledFor: new Date(),
    attempts: 1,
    lastError: 'claimed but not completed',
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe('notificationQueueWorker — queue row overrides payload', () => {
    let getTokensForUser: sinon.SinonStub;
    let findUser: sinon.SinonStub;
    let internalRestRequest: sinon.SinonStub;
    let markSent: sinon.SinonStub;

    beforeEach(() => {
        const row = buildPoisonedRow();

        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        // Only the Habits pass returns work; every other brand drains empty.
        sinon.stub(Store.notificationQueue, 'claimDue')
            .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [row as any] : []));
        sinon.stub(Store.notificationQueue, 'countSentSince').resolves(0);
        markSent = sinon.stub(Store.notificationQueue, 'markSent').resolves(1);
        sinon.stub(Store.notificationQueue, 'markFailed').resolves(1);
        sinon.stub(Store.notificationQueue, 'markSkipped').resolves(1);

        findUser = sinon.stub(Store.users, 'findUser').resolves([{
            deviceMobileFirebaseToken: 'legacy-therr-token',
            email: 'streakqueen@example.com',
            isUnclaimed: false,
            settingsEmailInvites: true,
        }] as any);

        getTokensForUser = sinon.stub(Store.userDeviceTokens, 'getTokensForUser')
            .resolves([{ token: 'habits-device-token' } as any]);

        internalRestRequest = sinon.stub(internalRestRequestModule, 'internalRestRequest')
            .resolves({ data: {} } as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('resolves the device token for the row brand, not the brand named in the payload', async () => {
        await runNotificationQueueTick();

        expect(getTokensForUser.called).to.equal(true);
        // 'habits' — the queue row. Not 'therr', which the payload asked for and
        // which would route the push through the Therr Firebase project.
        expect(getTokensForUser.firstCall.args[0]).to.equal(BrandVariations.HABITS);
    });

    it('sends to the user the row is for, not the user named in the payload', async () => {
        await runNotificationQueueTick();

        expect(findUser.called).to.equal(true);
        expect(findUser.firstCall.args[0]).to.deep.equal({ id: ROW_USER_ID });
        expect(getTokensForUser.firstCall.args[1]).to.equal(ROW_USER_ID);
    });

    it('forwards the row type and the brand-scoped token to push-notifications-service', async () => {
        await runNotificationQueueTick();

        expect(internalRestRequest.called).to.equal(true);
        const { data } = internalRestRequest.firstCall.args[1];
        expect(data.type).to.equal('streak-at-risk');
        expect(data.toUserDeviceToken).to.equal('habits-device-token');
    });

    it('still forwards the payload fields that are only decoration', async () => {
        // The fix must not throw the payload away — habitName, streakCount and the
        // rest of the copy variables are the whole reason payload exists.
        await runNotificationQueueTick();

        const { data } = internalRestRequest.firstCall.args[1];
        expect(data.habitName).to.equal('Morning run');
    });

    it('marks the row sent once', async () => {
        await runNotificationQueueTick();

        expect(markSent.calledOnce).to.equal(true);
        expect(markSent.firstCall.args[0]).to.equal('cccccccc-0000-4000-8000-000000000003');
    });
});

describe('notificationQueueWorker — per-user daily cap', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('skips rather than sends once the user is at the cap, and records why', async () => {
        const row = buildPoisonedRow();

        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        sinon.stub(Store.notificationQueue, 'claimDue')
            .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [row as any] : []));
        // At the cap. `markSkipped`, not `markFailed`: suppression has to stay
        // distinguishable from breakage in the metrics.
        sinon.stub(Store.notificationQueue, 'countSentSince').resolves(5);
        const markSkipped = sinon.stub(Store.notificationQueue, 'markSkipped').resolves(1);
        const markSent = sinon.stub(Store.notificationQueue, 'markSent').resolves(1);
        const internalRestRequest = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);

        await runNotificationQueueTick();

        expect(markSkipped.calledOnce).to.equal(true);
        expect(markSkipped.firstCall.args[1]).to.have.string('daily cap');
        expect(markSent.called).to.equal(false);
        expect(internalRestRequest.called).to.equal(false);
    });
});
