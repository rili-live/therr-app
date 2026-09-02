/**
 * Spacing, priority and un-addressable rows.
 *
 * The daily cap bounds how *many* notifications a user gets; it says nothing
 * about when. A tick claims 25 rows and sends them sequentially in a few
 * hundred milliseconds, so a user with four due rows got four pushes in the
 * same second — which reads as a malfunction however reasonable each one is
 * alone. The digest's roll-up removes most of that volume at the source; these
 * cover what is left, plus the rows that can never be delivered at all.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import {
    compareBySendPriority,
    resetRetentionThrottleForTests,
    runNotificationQueueTick,
} from '../../src/utilities/notificationQueueWorker';

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const ROW_ID = 'cccccccc-0000-4000-8000-000000000003';

const buildRow = (overrides: any = {}) => ({
    id: ROW_ID,
    userId: USER_ID,
    brandVariation: BrandVariations.HABITS,
    type: 'partner-checked-in',
    dedupeKey: 'partner-checked-in:g1:u1:2026-08-30',
    payload: { habitName: 'Reading', locale: 'en-us' },
    status: 'failed' as const,
    scheduledFor: new Date(),
    attempts: 1,
    lastError: 'claimed but not completed',
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

interface IHarness {
    markSent: sinon.SinonStub;
    markSkipped: sinon.SinonStub;
    defer: sinon.SinonStub;
    internalRestRequest: sinon.SinonStub;
}

const stubWorker = (row: any, {
    lastSentAt = null as Date | null,
    brandToken = 'habits-device-token' as string | null,
    legacyToken = null as string | null,
}): IHarness => {
    resetRetentionThrottleForTests();
    sinon.stub(Store.notificationQueue, 'deleteCompletedBefore').resolves(0);
    sinon.stub(Store.notificationQueue, 'deleteExhaustedFailedBefore').resolves(0);
    sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
    sinon.stub(Store.notificationQueue, 'claimDue')
        .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [row] : []));
    sinon.stub(Store.notificationQueue, 'countSentSince').resolves(0);
    sinon.stub(Store.notificationQueue, 'getLastSentAt').resolves(lastSentAt);
    sinon.stub(Store.notificationQueue, 'markFailed').resolves(1);

    sinon.stub(Store.users, 'findUser').resolves([{
        deviceMobileFirebaseToken: legacyToken,
        email: 'habits@example.com',
        isUnclaimed: false,
        settingsEmailInvites: true,
    }] as any);
    sinon.stub(Store.userDeviceTokens, 'getTokensForUser')
        .resolves(brandToken ? [{ token: brandToken } as any] : []);

    return {
        markSent: sinon.stub(Store.notificationQueue, 'markSent').resolves(1),
        markSkipped: sinon.stub(Store.notificationQueue, 'markSkipped').resolves(1),
        defer: sinon.stub(Store.notificationQueue, 'defer').resolves(1),
        internalRestRequest: sinon.stub(internalRestRequestModule, 'internalRestRequest')
            .resolves({ data: {} } as any),
    };
};

describe('notificationQueueWorker — minimum spacing between sends', () => {
    afterEach(() => sinon.restore());

    it('defers a row that would land on top of a recent send', async () => {
        const lastSentAt = new Date(Date.now() - 60 * 1000);
        const harness = stubWorker(buildRow(), { lastSentAt });

        await runNotificationQueueTick();

        expect(harness.internalRestRequest.called, 'should not have sent').to.equal(false);
        expect(harness.defer.calledOnce).to.equal(true);
        expect(harness.defer.firstCall.args[0]).to.equal(ROW_ID);
        // Scheduled for one full gap after the previous send, not "now + gap" —
        // so a user's notifications settle onto an even cadence.
        const deferredTo: Date = harness.defer.firstCall.args[1];
        expect(deferredTo.getTime()).to.equal(lastSentAt.getTime() + 15 * 60 * 1000);
        // Deferred, never dropped: everything reaching this rule is still
        // timely fifteen minutes from now.
        expect(harness.markSkipped.called).to.equal(false);
    });

    it('sends when the previous notification is far enough back', async () => {
        const harness = stubWorker(buildRow(), {
            lastSentAt: new Date(Date.now() - 60 * 60 * 1000),
        });

        await runNotificationQueueTick();

        expect(harness.internalRestRequest.calledOnce).to.equal(true);
        expect(harness.markSent.calledOnce).to.equal(true);
        expect(harness.defer.called).to.equal(false);
    });

    it('sends a row that has already waited out the deferral horizon', async () => {
        // Without a horizon, a user who keeps receiving notifications could
        // push a low-priority row back indefinitely.
        const harness = stubWorker(
            buildRow({ createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000) }),
            { lastSentAt: new Date(Date.now() - 60 * 1000) },
        );

        await runNotificationQueueTick();

        expect(harness.internalRestRequest.calledOnce).to.equal(true);
        expect(harness.defer.called).to.equal(false);
    });

    it('sends the first notification a user has ever received', async () => {
        const harness = stubWorker(buildRow(), { lastSentAt: null });

        await runNotificationQueueTick();

        expect(harness.internalRestRequest.calledOnce).to.equal(true);
    });
});

describe('notificationQueueWorker — un-addressable rows', () => {
    afterEach(() => sinon.restore());

    it('skips a row for a user with no device token instead of burning attempts', async () => {
        // 36 production errors in 30 days: "Exactly one of topic, token or
        // condition is required". Now that failures propagate these would land
        // 'failed' daily and bury real failures.
        const harness = stubWorker(buildRow(), { brandToken: null, legacyToken: null });

        await runNotificationQueueTick();

        expect(harness.internalRestRequest.called).to.equal(false);
        expect(harness.markSkipped.calledOnce).to.equal(true);
        expect(harness.markSkipped.firstCall.args[1]).to.equal('no-device-token');
    });

    it('still sends to a user who only has the legacy token column', async () => {
        // resolveDeviceTokenForBrand falls back to users.deviceMobileFirebaseToken
        // for devices that have not re-registered since Phase 2. Skipping them
        // would silence real recipients to tidy up a log.
        const harness = stubWorker(buildRow(), {
            brandToken: null,
            legacyToken: 'legacy-token',
        });

        await runNotificationQueueTick();

        expect(harness.markSkipped.called).to.equal(false);
        expect(harness.internalRestRequest.calledOnce).to.equal(true);
        expect(harness.internalRestRequest.firstCall.args[1].data.toUserDeviceToken)
            .to.equal('legacy-token');
    });
});

describe('notificationQueueWorker — send order', () => {
    const row = (type: string, scheduledFor = new Date('2026-08-30T14:00:00.000Z')) => buildRow({
        type,
        scheduledFor,
    });

    it('puts the time-sensitive nudge ahead of the celebration', () => {
        // With spacing in play the first row for a user is the one that goes out
        // now, so this decides what they actually see tonight.
        const ordered = [
            row('streak-milestone'),
            row('partner-checked-in'),
            row('streak-at-risk'),
        ].sort(compareBySendPriority).map((r) => r.type);

        expect(ordered).to.deep.equal(['streak-at-risk', 'partner-checked-in', 'streak-milestone']);
    });

    it('sorts an unknown type last rather than ahead of everything', () => {
        const ordered = [
            row('some-future-type'),
            row('daily-habit-reminder'),
        ].sort(compareBySendPriority).map((r) => r.type);

        expect(ordered).to.deep.equal(['daily-habit-reminder', 'some-future-type']);
    });

    it('puts the once-ever pact ending ahead of the recurring reminders', () => {
        // Everything else in the priority map recurs, so the daily cap dropping
        // one costs a day. `pact-ended` is keyed without a date -- a pact ends
        // once -- so a dropped row is never re-queued and the member is never
        // told their cycle closed, taking the renew CTA with it. Being ahead of
        // the reminders is what keeps it out of the row the cap cuts.
        const ordered = [
            row('partner-checked-in'),
            row('daily-habit-reminder'),
            row('pact-ended'),
            row('pact-expiring'),
        ].sort(compareBySendPriority).map((r) => r.type);

        expect(ordered.indexOf('pact-ended')).to.be.lessThan(ordered.indexOf('pact-expiring'));
        expect(ordered.indexOf('pact-ended')).to.be.lessThan(ordered.indexOf('partner-checked-in'));
    });

    it('falls back to oldest-first within one priority', () => {
        const older = row('partner-checked-in', new Date('2026-08-30T10:00:00.000Z'));
        const newer = row('partner-missed-day', new Date('2026-08-30T14:00:00.000Z'));

        expect([newer, older].sort(compareBySendPriority)[0]).to.equal(older);
    });
});
