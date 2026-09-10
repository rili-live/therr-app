import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import evaluateCheckinNudgeFreshness, { isCheckinNudgeType } from '../../src/utilities/checkinNudgeFreshness';
import {
    resetRetentionThrottleForTests,
    runNotificationQueueTick,
} from '../../src/utilities/notificationQueueWorker';

/**
 * The send-time relevance gate.
 *
 * This is the mechanism that makes the whole per-user scheduling change safe.
 * The digest decides at 14:00 UTC and the "last chance" row is scheduled for
 * the recipient's local evening — hours later — and in those hours most people
 * do the thing the notification is about to nag them for. Sending "your 12-day
 * streak is on the line" to someone who checked in at lunchtime does not just
 * waste a push; it teaches them the app does not know what they have done,
 * which is the lesson that gets notifications turned off for good.
 *
 * Nothing upstream can catch it. The producer was right when it queued the row,
 * the queue is working correctly when it drains it, and the send succeeds. Only
 * a re-read at send time can tell.
 */

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';

const buildRow = (overrides: Record<string, any> = {}): any => ({
    id: 'cccccccc-0000-4000-8000-000000000003',
    userId: USER,
    brandVariation: BrandVariations.HABITS,
    type: 'evening-check-in',
    dedupeKey: 'last-chance:2026-07-15',
    payload: {
        habitName: 'Morning run',
        habitCount: 2,
        streakCount: 12,
        habitGoalIds: ['goal-1', 'goal-2'],
        checkinDate: '2026-07-15',
    },
    status: 'failed',
    scheduledFor: new Date(),
    attempts: 1,
    lastError: 'claimed but not completed',
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe('checkinNudgeFreshness', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('covers exactly the three types whose relevance can expire', () => {
        // A `pactEnded` or a `streakMilestone` is a fact about the past and is
        // still true tonight; only the check-in nudges are claims about
        // something the user has not done yet.
        expect(isCheckinNudgeType('streak-at-risk')).to.equal(true);
        expect(isCheckinNudgeType('daily-habit-reminder')).to.equal(true);
        expect(isCheckinNudgeType('evening-check-in')).to.equal(true);
        expect(isCheckinNudgeType('pact-ended')).to.equal(false);
        expect(isCheckinNudgeType('streak-milestone')).to.equal(false);
    });

    it('suppresses the nudge once every habit it names is complete', async () => {
        const read = sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs')
            .resolves(new Set([`${USER}:goal-1`, `${USER}:goal-2`]));

        const decision = await evaluateCheckinNudgeFreshness(buildRow());

        expect(decision.shouldSend).to.equal(false);
        // The reason is written onto the skipped row, so suppression shows up as
        // a number rather than as an absence nobody can measure.
        expect(decision.reason).to.contain('already-checked-in');
        expect(read.firstCall.args[1]).to.equal('2026-07-15');
    });

    it('still sends when only some of the habits are done', async () => {
        // A partial completion leaves something to act on, and the copy already
        // names the count. Suppressing here would silence a nudge that is still
        // entirely correct.
        sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs')
            .resolves(new Set([`${USER}:goal-1`]));

        const decision = await evaluateCheckinNudgeFreshness(buildRow());

        expect(decision.shouldSend).to.equal(true);
    });

    it('sends a row that predates the stamp rather than guessing', async () => {
        const read = sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs').resolves(new Set());

        const decision = await evaluateCheckinNudgeFreshness(buildRow({
            payload: { habitName: 'Morning run' },
        }));

        expect(decision.shouldSend).to.equal(true);
        // No evidence to check, so no query — and certainly no suppression.
        expect(read.called).to.equal(false);
    });

    it('sends when the read fails', async () => {
        // Fail open, deliberately. A database blip must not turn into silence
        // on the feature whose entire purpose is not being silent — and unlike
        // an extra push, silence is invisible.
        sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs').rejects(new Error('read pool exhausted'));

        const decision = await evaluateCheckinNudgeFreshness(buildRow());

        expect(decision.shouldSend).to.equal(true);
    });

    it('never queries for a type outside the set', async () => {
        const read = sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs').resolves(new Set());

        const decision = await evaluateCheckinNudgeFreshness(buildRow({ type: 'pact-ended' }));

        expect(decision.shouldSend).to.equal(true);
        expect(read.called).to.equal(false);
    });
});

describe('notificationQueueWorker — a stale check-in nudge is skipped, not sent', () => {
    let markSkipped: sinon.SinonStub;
    let markSent: sinon.SinonStub;
    let countSentSince: sinon.SinonStub;
    let internalRestRequest: sinon.SinonStub;

    beforeEach(() => {
        resetRetentionThrottleForTests();
        sinon.stub(Store.notificationQueue, 'deleteCompletedBefore').resolves(0);
        sinon.stub(Store.notificationQueue, 'deleteExhaustedFailedBefore').resolves(0);
        sinon.stub(Store.notificationQueue, 'requeueFailed').resolves(0);
        sinon.stub(Store.notificationQueue, 'claimDue')
            .callsFake((brand: any) => Promise.resolve(brand === BrandVariations.HABITS ? [buildRow()] : []));

        countSentSince = sinon.stub(Store.notificationQueue, 'countSentSince').resolves(0);
        markSent = sinon.stub(Store.notificationQueue, 'markSent').resolves(1);
        markSkipped = sinon.stub(Store.notificationQueue, 'markSkipped').resolves(1);
        sinon.stub(Store.notificationQueue, 'markFailed').resolves(1);
        sinon.stub(Store.notificationQueue, 'getLastSentAt').resolves(null);

        sinon.stub(Store.users, 'findUser').resolves([{ deviceMobileFirebaseToken: 'legacy-token' }] as any);
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([{ token: 'habits-device-token' }] as any);
        internalRestRequest = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('does not send, and records why', async () => {
        sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs')
            .resolves(new Set([`${USER}:goal-1`, `${USER}:goal-2`]));

        await runNotificationQueueTick();

        expect(internalRestRequest.called).to.equal(false);
        expect(markSent.called).to.equal(false);
        expect(markSkipped.calledOnce).to.equal(true);
        expect(markSkipped.firstCall.args[1]).to.contain('already-checked-in');
    });

    it('checks relevance before spending any of the user\'s daily send budget', async () => {
        // Ordering matters. The cap is 5 sends per user per day; a row that no
        // longer needs sending must not consume one, or an irrelevant nudge
        // crowds out something timely later the same day.
        sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs')
            .resolves(new Set([`${USER}:goal-1`, `${USER}:goal-2`]));

        await runNotificationQueueTick();

        expect(countSentSince.called).to.equal(false);
    });

    it('sends normally when the user still has a habit outstanding', async () => {
        sinon.stub(Store.habitCheckins, 'getCompletedOnDateForPairs').resolves(new Set());

        await runNotificationQueueTick();

        expect(internalRestRequest.calledOnce).to.equal(true);
        expect(markSkipped.called).to.equal(false);
        expect(markSent.calledOnce).to.equal(true);
    });
});
