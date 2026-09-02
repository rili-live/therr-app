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
import {
    MAX_ATTEMPTS,
    resetRetentionThrottleForTests,
    runNotificationQueueTick,
} from '../../src/utilities/notificationQueueWorker';

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

/**
 * The retention sweep is module-throttled and fires on the first tick of a
 * process, so every block has to neutralize it — otherwise the first test to run
 * issues two real DELETEs against a connection these unit tests never stand up,
 * and the retention block's own assertions see an already-consumed throttle.
 */
const stubRetention = () => {
    resetRetentionThrottleForTests();
    return {
        deleteCompleted: sinon.stub(Store.notificationQueue, 'deleteCompletedBefore').resolves(0),
        deleteFailed: sinon.stub(Store.notificationQueue, 'deleteExhaustedFailedBefore').resolves(0),
    };
};

describe('notificationQueueWorker — queue row overrides payload', () => {
    let getTokensForUser: sinon.SinonStub;
    let findUser: sinon.SinonStub;
    let internalRestRequest: sinon.SinonStub;
    let markSent: sinon.SinonStub;

    beforeEach(() => {
        const row = buildPoisonedRow();

        stubRetention();
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

describe('notificationQueueWorker — a failed send must not be recorded as sent', () => {
    afterEach(() => {
        sinon.restore();
    });

    /**
     * `sendEmailAndOrPushNotification` swallows errors by default so a dead device
     * token can never fail a user-facing request. The worker opts out of that via
     * `shouldThrowOnError`. Without the opt-out every row is marked 'sent' whatever
     * happens, which silently reduces `markFailed` / `requeueFailed` / MAX_ATTEMPTS
     * to crash recovery and loses the delivery failure entirely.
     */
    it('marks the row failed, not sent, when the push service rejects', async () => {
        const row = buildPoisonedRow();

        stubRetention();
        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        sinon.stub(Store.notificationQueue, 'claimDue')
            .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [row as any] : []));
        sinon.stub(Store.notificationQueue, 'countSentSince').resolves(0);
        const markSent = sinon.stub(Store.notificationQueue, 'markSent').resolves(1);
        const markFailed = sinon.stub(Store.notificationQueue, 'markFailed').resolves(1);
        sinon.stub(Store.users, 'findUser').resolves([{
            deviceMobileFirebaseToken: 'legacy-therr-token',
            email: 'streakqueen@example.com',
            isUnclaimed: false,
            settingsEmailInvites: true,
        }] as any);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([{ token: 'habits-device-token' } as any]);
        sinon.stub(internalRestRequestModule, 'internalRestRequest')
            .rejects(new Error('push-notifications-service unreachable'));

        await runNotificationQueueTick();

        expect(markSent.called).to.equal(false);
        expect(markFailed.calledOnce).to.equal(true);
        expect(markFailed.firstCall.args[1]).to.have.string('push-notifications-service unreachable');
    });
});

describe('notificationQueueWorker — retention', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('sweeps both completed and terminally-failed rows, bounded and never pending', async () => {
        const { deleteCompleted, deleteFailed } = stubRetention();
        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        sinon.stub(Store.notificationQueue, 'claimDue').resolves([]);

        await runNotificationQueueTick();

        expect(deleteCompleted.calledOnce).to.equal(true);
        expect(deleteFailed.calledOnce).to.equal(true);

        // Completed rows must survive well past the 24h window countSentSince reads,
        // or deleting them hands a user their daily budget back early.
        const completedCutoff: Date = deleteCompleted.firstCall.args[0];
        const completedAgeMs = Date.now() - completedCutoff.getTime();
        expect(completedAgeMs).to.be.greaterThan(24 * 60 * 60 * 1000);

        // Failed rows are the only record of a lost send, so they outlive completed ones.
        const failedCutoff: Date = deleteFailed.firstCall.args[1];
        expect(failedCutoff.getTime()).to.be.lessThan(completedCutoff.getTime());
        expect(deleteFailed.firstCall.args[0]).to.equal(MAX_ATTEMPTS);
    });

    it('self-throttles so it does not run on every 30s tick', async () => {
        const { deleteCompleted } = stubRetention();
        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        sinon.stub(Store.notificationQueue, 'claimDue').resolves([]);

        await runNotificationQueueTick();
        await runNotificationQueueTick();
        await runNotificationQueueTick();

        // Housekeeping is not worth a DELETE round trip 120 times an hour.
        expect(deleteCompleted.callCount).to.equal(1);
    });
});

describe('notificationQueueWorker — per-user daily cap', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('skips rather than sends once the user is at the cap, and records why', async () => {
        const row = buildPoisonedRow();

        stubRetention();
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

    /**
     * The once-ever exemption.
     *
     * Dropping is right for the recurring types: tomorrow queues a fresh row, so
     * a suppressed one costs a day. `pact-ended` is keyed `pact-ended:<pactId>`
     * with no date -- the only dateless key any producer here builds -- because a
     * pact ends exactly once. That makes a drop permanent and silent: the member
     * is never told their cycle closed and never offered the renewal, which is
     * the only moment `isPactRenewable` allows one. Nothing reports it.
     */
    describe('once-ever types the cap must not drop', () => {
        const buildPactEndedRow = (createdAt: Date) => ({
            ...buildPoisonedRow(),
            type: 'pact-ended',
            dedupeKey: 'pact-ended:pact-1',
            createdAt,
        });

        const stubTickAtCap = (row: any) => {
            stubRetention();
            sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
            sinon.stub(Store.notificationQueue, 'claimDue')
                .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [row] : []));
            sinon.stub(Store.notificationQueue, 'countSentSince').resolves(5);
            sinon.stub(Store.users, 'findUser').resolves([{ deviceMobileFirebaseToken: 'legacy-token' }] as any);
            sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([{ token: 'habits-device-token' } as any]);
            sinon.stub(Store.notificationQueue, 'getLastSentAt').resolves(null);
            sinon.stub(Store.notificationQueue, 'markFailed').resolves(1);

            return {
                markSkipped: sinon.stub(Store.notificationQueue, 'markSkipped').resolves(1),
                markSent: sinon.stub(Store.notificationQueue, 'markSent').resolves(1),
                defer: sinon.stub(Store.notificationQueue, 'defer').resolves(1),
                internalRestRequest: sinon.stub(internalRestRequestModule, 'internalRestRequest')
                    .resolves({ data: {} } as any),
            };
        };

        it('defers a freshly queued pact-ended instead of dropping it', async () => {
            const stubs = stubTickAtCap(buildPactEndedRow(new Date()));

            await runNotificationQueueTick();

            expect(stubs.defer.calledOnce, 'expected a deferral, not a drop').to.equal(true);
            expect(stubs.markSkipped.called, 'a dropped row is never re-queued').to.equal(false);
            expect(stubs.markSent.called).to.equal(false);

            // Re-tested within the hour: the cap window rolls continuously, so
            // room usually appears long before the 24h bound.
            const nextAttemptAt: Date = stubs.defer.firstCall.args[1];
            const msOut = nextAttemptAt.getTime() - Date.now();
            expect(msOut).to.be.greaterThan(0);
            expect(msOut).to.be.at.most(60 * 60 * 1000 + 5000);
        });

        it('sends over the cap once the row has waited out the deferral bound', async () => {
            // A user genuinely at 5/day every day would otherwise be deferred
            // forever, which is the same silence the exemption exists to prevent.
            const dayAndAHalfAgo = new Date(Date.now() - 36 * 60 * 60 * 1000);
            const stubs = stubTickAtCap(buildPactEndedRow(dayAndAHalfAgo));

            await runNotificationQueueTick();

            expect(stubs.markSent.calledOnce, 'expected the send to go through over the cap').to.equal(true);
            expect(stubs.defer.called, 'must not defer again past the bound').to.equal(false);
            expect(stubs.markSkipped.called).to.equal(false);
            expect(stubs.internalRestRequest.called).to.equal(true);
            expect(stubs.internalRestRequest.firstCall.args[1].data.type).to.equal('pact-ended');
        });

        it('still drops a recurring type at the cap, however long it has waited', async () => {
            // The exemption is keyed on the type, not on age -- a stale
            // streak-at-risk must not ride the same escape hatch.
            const stubs = stubTickAtCap({
                ...buildPoisonedRow(),
                createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
            });

            await runNotificationQueueTick();

            expect(stubs.markSkipped.calledOnce).to.equal(true);
            expect(stubs.defer.called).to.equal(false);
            expect(stubs.markSent.called).to.equal(false);
        });
    });
});
