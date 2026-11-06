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
import ReferralRewardsStore from '../../src/store/ReferralRewardsStore';
import {
    evaluateReferralRewardsAfterCheckin,
    getReferralRewardProgress,
    getReferralRewardProgressWithCatchUp,
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
    let grant: sinon.SinonStub;
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
        grant = sinon.stub(Store.referralRewards, 'grant').resolves(created as any);
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

            const [userId, qualifyingUserIds, accessLevels] = grant.firstCall.args;
            expect(userId).to.equal(REFERRER);
            expect(accessLevels).to.have.members([AccessLevels.EMAIL_VERIFIED, AccessLevels.HABITS_LIFETIME]);
            expect(qualifyingUserIds).to.have.length(HABITS_REFERRAL_REWARD_FRIEND_COUNT);
            const [, args] = enqueue.firstCall.args;
            expect(args.type).to.equal(PushNotifications.Types.habitsReferralRewardEarned);
            expect(args.dedupeKey).to.equal(`habits-referral-reward:${REFERRER}`);
        });

        it('waits until enough friends are active', async () => {
            stub({ friends: activeFriends(HABITS_REFERRAL_REWARD_FRIEND_COUNT - 1).concat(friend('new', 1)) });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('not-yet');
            expect(grant.called).to.equal(false);
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
            expect(grant.called).to.equal(false);
        });

        it('grants and announces nothing when a racing evaluation already claimed the row', async () => {
            stub({ created: null });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('already-granted');
            expect(enqueue.called).to.equal(false);
        });

        it('ends with the founder offer', async () => {
            stub({ claimed: HABITS_LIFETIME_FOUNDER_LIMIT });
            expect(await maybeGrantReferralReward(REFERRER)).to.equal('sold-out');
            expect(grant.called).to.equal(false);
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

        it('announces nothing when the grant fails, so the next check-in can retry it', async () => {
            stub();
            grant.rejects(new Error('write failed'));
            sinon.stub(Store.referralRewards, 'getReferrersOf').resolves([REFERRER]);
            expect(await evaluateReferralRewardsAfterCheckin('friend-id')).to.deep.equal([]);
            expect(enqueue.called).to.equal(false);
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

    describe('getReferralRewardProgressWithCatchUp', () => {
        // Regression: the grant only ran on a friend's check-in, so referrers whose friends had
        // already qualified (and then went quiet) were never evaluated. On 2026-10-28 two real
        // users had three active friends each and habits.referral_rewards was empty.
        it('grants a reward that was earned but never evaluated, and reports it as granted', async () => {
            stub();
            (Store.referralRewards.getByUserId as sinon.SinonStub)
                .onFirstCall().resolves(undefined) // progress read
                .onSecondCall().resolves(undefined) // maybeGrant's own check
                .onThirdCall()
                .resolves({ grantedAt: new Date('2026-10-28T00:00:00Z') }); // re-read

            const progress = await getReferralRewardProgressWithCatchUp(REFERRER);

            expect(grant.calledOnce).to.equal(true);
            expect(enqueue.calledOnce).to.equal(true);
            expect(progress.isGranted).to.equal(true);
        });

        it('does not try to grant while the reward is not yet earned', async () => {
            stub({ friends: activeFriends(HABITS_REFERRAL_REWARD_FRIEND_COUNT - 1) });

            const progress = await getReferralRewardProgressWithCatchUp(REFERRER);

            expect(grant.called).to.equal(false);
            expect(progress.isGranted).to.equal(false);
        });

        it('does not try to grant once it has been given', async () => {
            stub({ existingGrant: { grantedAt: new Date() } });

            await getReferralRewardProgressWithCatchUp(REFERRER);

            expect(grant.called).to.equal(false);
        });

        it('does not try to grant to an account that already paid', async () => {
            stub({ accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.HABITS_LIFETIME] });

            await getReferralRewardProgressWithCatchUp(REFERRER);

            expect(grant.called).to.equal(false);
        });

        it('still returns progress when the grant fails, so the screen does not break', async () => {
            stub();
            grant.rejects(new Error('write failed'));

            const progress = await getReferralRewardProgressWithCatchUp(REFERRER);

            expect(progress.isGranted).to.equal(false);
            expect(progress.qualifiedCount).to.equal(HABITS_REFERRAL_REWARD_FRIEND_COUNT);
            expect(enqueue.called).to.equal(false);
        });
    });

    describe('ReferralRewardsStore.grant', () => {
        // A pg client that answers each statement in order and records what it was sent.
        const fakeDb = (onQuery: (sql: string) => Promise<any>) => {
            const sent: string[] = [];
            const client = {
                query: (sql: string) => {
                    sent.push(sql);
                    return onQuery(sql);
                },
                release: sinon.stub(),
            };
            const db: any = { write: { connect: () => Promise.resolve(client) }, read: {} };
            return { db, sent, client };
        };

        it('rolls back the claimed row when the access-level write fails, so the reward is not lost', async () => {
            const { db, sent, client } = fakeDb((sql) => {
                if (sql.startsWith('INSERT')) return Promise.resolve({ rows: [{ id: 'grant-1' }] });
                if (sql.startsWith('update')) return Promise.reject(new Error('write failed'));
                return Promise.resolve({ rows: [] });
            });

            let error: any;
            await new ReferralRewardsStore(db).grant(REFERRER, ['f1'], [AccessLevels.HABITS_LIFETIME]).catch((err) => { error = err; });

            expect(error?.message).to.equal('write failed');
            expect(sent[sent.length - 1]).to.equal('ROLLBACK');
            expect(sent).to.not.include('COMMIT');
            expect(client.release.calledOnce).to.equal(true);
        });

        it('commits the row and the access levels together', async () => {
            const { db, sent } = fakeDb((sql) => Promise.resolve({ rows: sql.startsWith('INSERT') ? [{ id: 'grant-1' }] : [] }));

            const granted = await new ReferralRewardsStore(db).grant(REFERRER, ['f1'], [AccessLevels.HABITS_LIFETIME]);

            expect(granted).to.deep.equal({ id: 'grant-1' });
            expect(sent[0]).to.equal('BEGIN');
            expect(sent[2]).to.match(/^update "main"\."users" set "accessLevels" = '\["user\.habits\.lifetime"\]'/);
            expect(sent[3]).to.equal('COMMIT');
        });

        it('writes no access levels when a racing evaluation already holds the row', async () => {
            const { db, sent } = fakeDb(() => Promise.resolve({ rows: [] }));

            expect(await new ReferralRewardsStore(db).grant(REFERRER, ['f1'], [AccessLevels.HABITS_LIFETIME])).to.equal(undefined);
            expect(sent).to.deep.equal(['BEGIN', sent[1], 'COMMIT']);
        });
    });
});
