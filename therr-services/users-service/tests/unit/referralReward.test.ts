import { expect } from 'chai';
import sinon from 'sinon';
import {
    AccessLevels,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    HABITS_REFERRAL_REWARD_ACTIVE_DAYS,
    HABITS_REFERRAL_REWARD_FRIEND_COUNT,
    PushNotifications,
} from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    evaluateReferralRewardsAfterCheckin,
    getReferralRewardProgress,
    maybeGrantReferralReward,
} from '../../src/handlers/helpers/referralReward';
import { UNCAPPABLE_TYPES } from '../../src/utilities/notificationQueueWorker';

const REFERRER = 'aaaaaaaa-0000-4000-8000-0000000000r1';

const friend = (userName: string, activeDays: number, accessLevels: string[] = [AccessLevels.EMAIL_VERIFIED]) => ({
    userId: `id-${userName}`,
    userName,
    accessLevels,
    activeDays,
});

const activeFriends = (count: number) => Array.from({ length: count }, (_, i) => friend(`f${i}`, HABITS_REFERRAL_REWARD_ACTIVE_DAYS));

describe('referral reward (founder unlock for active friends)', () => {
    let updateUser: sinon.SinonStub;
    let createIfAbsent: sinon.SinonStub;
    let enqueue: sinon.SinonStub;

    const stub = ({
        friends = activeFriends(HABITS_REFERRAL_REWARD_FRIEND_COUNT),
        existingGrant = undefined,
        accessLevels = [AccessLevels.EMAIL_VERIFIED],
        claimed = 0,
        created = { id: 'grant-1' },
    }: any = {}) => {
        sinon.stub(Store.referralRewards, 'getByUserId').resolves(existingGrant);
        sinon.stub(Store.referralRewards, 'getReferredFriends').resolves(friends);
        sinon.stub(Store.users, 'findUser').resolves([{ id: REFERRER, accessLevels }] as any);
        sinon.stub(Store.lifetimePurchases, 'countClaimedFounderSlots').resolves(claimed);
        createIfAbsent = sinon.stub(Store.referralRewards, 'createIfAbsent').resolves(created as any);
        updateUser = sinon.stub(Store.users, 'updateUser').resolves({} as any);
        enqueue = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'q' } as any);
    };

    afterEach(() => {
        sinon.restore();
        delete process.env.HABITS_REFERRAL_REWARD_ENABLED;
    });

    describe('maybeGrantReferralReward', () => {
        it('grants the lifetime entitlement without dropping existing access levels, and announces it once', async () => {
            stub();

            expect(await maybeGrantReferralReward(REFERRER)).to.equal('granted');

            const [values] = updateUser.firstCall.args;
            expect(JSON.parse(values.accessLevels)).to.have.members([AccessLevels.EMAIL_VERIFIED, AccessLevels.HABITS_LIFETIME]);
            expect(createIfAbsent.firstCall.args[1]).to.have.length(HABITS_REFERRAL_REWARD_FRIEND_COUNT);
            const [, args] = enqueue.firstCall.args;
            expect(args.type).to.equal(PushNotifications.Types.habitsReferralRewardEarned);
            expect(args.dedupeKey).to.equal(`habits-referral-reward:${REFERRER}`);
        });

        it('waits until enough friends are active', async () => {
            stub({ friends: activeFriends(HABITS_REFERRAL_REWARD_FRIEND_COUNT - 1).concat(friend('new', 1)) });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('not-yet');
            expect(updateUser.called).to.equal(false);
        });

        it('does not count unverified friends', async () => {
            const friends = activeFriends(HABITS_REFERRAL_REWARD_FRIEND_COUNT);
            friends[0].accessLevels = [];
            stub({ friends });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('not-yet');
        });

        it('gives nothing to an account that already paid', async () => {
            stub({ accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.HABITS_LIFETIME] });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('already-entitled');
            expect(createIfAbsent.called).to.equal(false);
        });

        it('grants and announces nothing when a racing evaluation already claimed the row', async () => {
            stub({ created: null });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('already-granted');
            expect(updateUser.called).to.equal(false);
            expect(enqueue.called).to.equal(false);
        });

        it('ends with the founder offer', async () => {
            stub({ claimed: HABITS_LIFETIME_FOUNDER_LIMIT });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('sold-out');
            expect(createIfAbsent.called).to.equal(false);
        });

        it('honours the kill switch', async () => {
            stub();
            process.env.HABITS_REFERRAL_REWARD_ENABLED = 'false';
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('disabled');
        });

        it('announces through a type the daily cap cannot drop, since its once-ever dedupe key is never re-queued', () => {
            expect(UNCAPPABLE_TYPES.has(PushNotifications.Types.habitsReferralRewardEarned)).to.equal(true);
        });
    });

    describe('evaluateReferralRewardsAfterCheckin', () => {
        it('evaluates everyone who brought the friend in', async () => {
            stub();
            sinon.stub(Store.referralRewards, 'getReferrersOf').resolves([REFERRER]);
            expect(await evaluateReferralRewardsAfterCheckin('friend-id')).to.deep.equal(['granted']);
        });

        it('never throws into the check-in', async () => {
            sinon.stub(Store.referralRewards, 'getReferrersOf').rejects(new Error('db down'));
            expect(await evaluateReferralRewardsAfterCheckin('friend-id')).to.deep.equal([]);
        });
    });

    describe('getReferralRewardProgress', () => {
        it('reports progress with days capped at the requirement', async () => {
            stub({ friends: [friend('done', 40), friend('started', 1), friend('unverified', 5, [])] });

            const progress = await getReferralRewardProgress(REFERRER);

            expect(progress.qualifiedCount).to.equal(1);
            expect(progress.isAvailable).to.equal(true);
            expect(progress.friends[0]).to.deep.equal({
                userName: 'done', activeDays: HABITS_REFERRAL_REWARD_ACTIVE_DAYS, isVerified: true, isQualified: true,
            });
            expect(progress.friends[2]).to.include({ isVerified: false, isQualified: false });
        });
    });
});
