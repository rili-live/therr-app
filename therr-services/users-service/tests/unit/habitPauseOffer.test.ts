import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import { markPauseOffers } from '../../src/handlers/helpers/habitPause';
import { shouldOfferPauseOnNudge } from '../../src/utilities/habitPause';
import sendEmailAndOrPushNotification from '../../src/utilities/sendEmailAndOrPushNotification';

/**
 * "Pause" on the check-in nudge for a streak that ends tonight with no freezes left.
 *
 * The digest decides it after the roll-up (`markPauseOffers`), and the decision has to survive the
 * queue: the row's payload is spread into `sendEmailAndOrPushNotification`, which forwards only the
 * fields it names. The week-progress and savings fields on the same payload were dropped that way
 * until they were listed, so the last test here pins the whole set.
 */

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const GOAL = 'bbbbbbbb-0000-4000-8000-000000000002';

const row = (payload: Record<string, any>, userId = USER): any => ({
    userId,
    type: PushNotifications.Types.streakAtRisk,
    payload: {
        habitName: 'Running',
        habitCount: 1,
        habitNames: ['Running'],
        streakCount: 12,
        freezesRemaining: 0,
        habitGoalId: GOAL,
        ...payload,
    },
    candidateCount: 1,
    hasLiveStreak: true,
    hasStreakAtStakeToday: true,
});

describe('Pause offer on check-in nudges', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('shouldOfferPauseOnNudge', () => {
        it('offers only a single habit with a live streak and no freezes left', () => {
            expect(shouldOfferPauseOnNudge({ habitGoalId: GOAL, streakCount: 12, freezesRemaining: 0 })).to.equal(true);
        });

        it('does not offer while a freeze would still cover tonight', () => {
            expect(shouldOfferPauseOnNudge({ habitGoalId: GOAL, streakCount: 12, freezesRemaining: 1 })).to.equal(false);
        });

        it('does not read an unknown freeze count as zero', () => {
            // A roll-up drops the per-habit count; absent is "unknown", not "out of freezes".
            expect(shouldOfferPauseOnNudge({ habitGoalId: GOAL, streakCount: 12 })).to.equal(false);
        });

        it('does not offer with nothing at stake or no single habit', () => {
            expect(shouldOfferPauseOnNudge({ habitGoalId: GOAL, streakCount: 0, freezesRemaining: 0 })).to.equal(false);
            expect(shouldOfferPauseOnNudge({ streakCount: 12, freezesRemaining: 0 })).to.equal(false);
        });
    });

    describe('markPauseOffers', () => {
        it('flags eligible nudges and skips habits that cannot be paused right now', async () => {
            const OTHER = 'aaaaaaaa-0000-4000-8000-000000000009';
            const read = sinon.stub(Store.habitPauses, 'getUnpausablePairKeys')
                .resolves(new Set([`${OTHER}:${GOAL}`]));
            const rows = [
                row({}),
                row({}, OTHER),
                row({ freezesRemaining: 2 }, 'aaaaaaaa-0000-4000-8000-00000000000a'),
            ];

            const offered = await markPauseOffers(rows, '2026-11-07');

            expect(offered).to.equal(1);
            expect(rows[0].payload.offerPause).to.equal(true);
            expect(rows[1].payload.offerPause).to.equal(undefined);
            expect(rows[2].payload.offerPause).to.equal(undefined);
            // Only the two out-of-freezes candidates are looked up, with the cooldown window start.
            expect(read.firstCall.args[0]).to.have.length(2);
            expect(read.firstCall.args[1]).to.equal('2026-10-31');
        });

        it('offers nothing when eligibility cannot be read', async () => {
            sinon.stub(Store.habitPauses, 'getUnpausablePairKeys').rejects(new Error('read pool down'));
            const rows = [row({})];

            expect(await markPauseOffers(rows, '2026-11-07')).to.equal(0);
            expect(rows[0].payload.offerPause).to.equal(undefined);
        });

        it('does no read when nothing qualifies', async () => {
            const read = sinon.stub(Store.habitPauses, 'getUnpausablePairKeys');

            await markPauseOffers([row({ freezesRemaining: 1 })], '2026-11-07');

            expect(read.called).to.equal(false);
        });
    });

    describe('forwarding through sendEmailAndOrPushNotification', () => {
        it('carries the pause offer and the single-habit nudge fields to the push service', async () => {
            sinon.stub(Store.users, 'findUser').resolves([{
                deviceMobileFirebaseToken: '', email: 'a@example.com', isUnclaimed: false, settingsEmailInvites: true,
            }] as any);
            sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([{ token: 'device-token' } as any]);
            const request = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);

            await sendEmailAndOrPushNotification(Store.users.findUser, {
                'x-platform': 'mobile',
                'x-brand-variation': BrandVariations.HABITS,
                'x-localecode': 'en-us',
                'x-userid': '',
            } as any, {
                authorization: '',
                locale: 'en-us',
                toUserId: USER,
                type: PushNotifications.Types.streakAtRisk,
                whiteLabelOrigin: '',
                brandVariation: BrandVariations.HABITS,
                habitGoalId: GOAL,
                offerPause: true,
                weekDone: 1,
                weekTarget: 3,
                daysLeft: 2,
                isSavingsGoal: true,
                currencyCode: 'USD',
            } as any, { shouldSendPushNotification: true, shouldSendEmail: false, shouldThrowOnError: true });

            const { data } = request.firstCall.args[1] as any;
            expect(data).to.include({
                offerPause: true,
                weekDone: 1,
                weekTarget: 3,
                daysLeft: 2,
                isSavingsGoal: true,
                currencyCode: 'USD',
                habitGoalId: GOAL,
            });
        });
    });
});
