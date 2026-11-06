/**
 * Notification queue worker — what a failed push records, and what a dead token does.
 *
 * In October 2026 about half of all Friends with Habits queue rows failed with
 * "Request failed with status code 502" and nothing in the table said why. The
 * push service had said why — FCM's errorCode is in the 502 body — but the worker
 * stored only the axios message. Production logs showed the reason was
 * `NotRegistered` on every one: uninstalled apps whose tokens were never cleared,
 * retried three times a row, every day.
 *
 * These pin both halves: the FCM reason reaches `lastError`, and a dead-token
 * answer removes the registration and skips the row instead of retrying it.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import {
    resetRetentionThrottleForTests,
    runNotificationQueueTick,
} from '../../src/utilities/notificationQueueWorker';
import { describePushSendError, isDeadDeviceTokenError } from '../../src/utilities/pushSendError';

const ROW_ID = 'cccccccc-0000-4000-8000-000000000003';
const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const DEVICE_TOKEN = 'habits-device-token';

const buildRow = () => ({
    id: ROW_ID,
    userId: USER_ID,
    brandVariation: BrandVariations.HABITS,
    type: 'streak-at-risk',
    dedupeKey: 'streak-at-risk:pact-1:2026-10-28',
    payload: { habitName: 'Morning run' },
    status: 'failed' as const,
    scheduledFor: new Date(),
    attempts: 1,
    lastError: 'claimed but not completed',
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
});

/** The shape axios rejects with when push-notifications-service answers 502. */
const pushService502 = (errorCode: string, errorMessage: string) => Object.assign(
    new Error('Request failed with status code 502'),
    { response: { status: 502, data: { errorCode, errorMessage } } },
);

describe('notificationQueueWorker — send errors', () => {
    let markSent: sinon.SinonStub;
    let markFailed: sinon.SinonStub;
    let markSkipped: sinon.SinonStub;
    let deleteByToken: sinon.SinonStub;
    let internalRestRequest: sinon.SinonStub;

    beforeEach(() => {
        resetRetentionThrottleForTests();
        sinon.stub(Store.notificationQueue, 'deleteCompletedBefore').resolves(0);
        sinon.stub(Store.notificationQueue, 'deleteExhaustedFailedBefore').resolves(0);
        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        sinon.stub(Store.notificationQueue, 'claimDue')
            .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [buildRow() as any] : []));
        sinon.stub(Store.notificationQueue, 'countSentSince').resolves(0);
        sinon.stub(Store.notificationQueue, 'getLastSentAt').resolves(null);
        markSent = sinon.stub(Store.notificationQueue, 'markSent').resolves(1);
        markFailed = sinon.stub(Store.notificationQueue, 'markFailed').resolves(1);
        markSkipped = sinon.stub(Store.notificationQueue, 'markSkipped').resolves(1);
        sinon.stub(Store.users, 'findUser').resolves([{
            deviceMobileFirebaseToken: '',
            email: 'streakqueen@example.com',
            isUnclaimed: false,
            settingsEmailInvites: true,
        }] as any);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([{ token: DEVICE_TOKEN } as any]);
        deleteByToken = sinon.stub(Store.userDeviceTokens, 'deleteByToken').resolves(1);
        internalRestRequest = sinon.stub(internalRestRequestModule, 'internalRestRequest');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('records the FCM reason from the push service body, not the axios message', async () => {
        internalRestRequest.rejects(pushService502('messaging/mismatched-credential', 'SenderId mismatch'));

        await runNotificationQueueTick();

        expect(markSent.called).to.equal(false);
        expect(markFailed.calledOnce).to.equal(true);
        expect(markFailed.firstCall.args[1]).to.equal('push 502 messaging/mismatched-credential: SenderId mismatch');
        // Not a token problem, so the registration stays and the row is retried.
        expect(deleteByToken.called).to.equal(false);
        expect(markSkipped.called).to.equal(false);
    });

    it('removes the registration and skips the row when FCM says the token is not registered', async () => {
        internalRestRequest.rejects(pushService502('messaging/registration-token-not-registered', 'Requested entity was not found.'));

        await runNotificationQueueTick();

        expect(deleteByToken.calledOnceWithExactly(DEVICE_TOKEN)).to.equal(true);
        expect(markSkipped.calledOnce).to.equal(true);
        expect(markSkipped.firstCall.args[0]).to.equal(ROW_ID);
        expect(markSkipped.firstCall.args[1]).to.match(/^device-token-not-registered: push 502 messaging\/registration-token-not-registered/);
        // Neither burned as a retry nor recorded as a delivery.
        expect(markFailed.called).to.equal(false);
        expect(markSent.called).to.equal(false);
    });

    it('still skips the row when deleting the registration fails', async () => {
        internalRestRequest.rejects(pushService502('messaging/registration-token-not-registered', 'NotRegistered'));
        deleteByToken.rejects(new Error('write pool exhausted'));

        await runNotificationQueueTick();

        expect(markSkipped.calledOnce).to.equal(true);
        expect(markFailed.called).to.equal(false);
    });

    it('keeps the token when invalid-argument is about the message, not the token', async () => {
        // A payload bug reaches every recipient of a digest run. Treating it as a dead
        // token would delete all of their registrations at once.
        internalRestRequest.rejects(pushService502(
            'messaging/invalid-argument',
            'Invalid value at \'message.android.notification.color\'',
        ));

        await runNotificationQueueTick();

        expect(deleteByToken.called).to.equal(false);
        expect(markSkipped.called).to.equal(false);
        expect(markFailed.calledOnce).to.equal(true);
        expect(markFailed.firstCall.args[1]).to.have.string('messaging/invalid-argument');
    });

    it('falls back to the axios message when the push service gave no body', async () => {
        internalRestRequest.rejects(new Error('connect ECONNREFUSED 10.0.0.1:7775'));

        await runNotificationQueueTick();

        expect(markFailed.firstCall.args[1]).to.equal('connect ECONNREFUSED 10.0.0.1:7775');
        expect(deleteByToken.called).to.equal(false);
    });
});

describe('describePushSendError', () => {
    it('summarizes a push-service 502 body', () => {
        const result = describePushSendError(pushService502('messaging/registration-token-not-registered', 'NotRegistered'));

        expect(result).to.deep.equal({
            status: 502,
            errorCode: 'messaging/registration-token-not-registered',
            errorMessage: 'NotRegistered',
            summary: 'push 502 messaging/registration-token-not-registered: NotRegistered',
        });
    });

    it('bounds the summary to 500 characters', () => {
        const result = describePushSendError(pushService502('messaging/internal-error', 'x'.repeat(2000)));

        expect(result.summary).to.have.length(500);
    });

    it('handles a non-Error rejection', () => {
        expect(describePushSendError('boom').summary).to.equal('boom');
        expect(describePushSendError(undefined).summary).to.equal('unknown error');
    });
});

describe('isDeadDeviceTokenError', () => {
    it('is true for the codes that always mean the token is dead', () => {
        expect(isDeadDeviceTokenError({ errorCode: 'messaging/registration-token-not-registered' })).to.equal(true);
        expect(isDeadDeviceTokenError({ errorCode: 'messaging/invalid-registration-token' })).to.equal(true);
    });

    it('is true for invalid-argument only when it names the registration token', () => {
        expect(isDeadDeviceTokenError({
            errorCode: 'messaging/invalid-argument',
            errorMessage: 'The registration token is not a valid FCM registration token',
        })).to.equal(true);
        expect(isDeadDeviceTokenError({
            errorCode: 'messaging/invalid-argument',
            errorMessage: 'Message payload is too large',
        })).to.equal(false);
    });

    it('is false for credential, routing and transport failures', () => {
        ['messaging/mismatched-credential', 'messaging/third-party-auth-error', 'notification-type-not-routed', undefined]
            .forEach((errorCode) => {
                expect(isDeadDeviceTokenError({ errorCode })).to.equal(false);
            });
    });
});
