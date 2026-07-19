/**
 * Leaderboard XP system tests.
 *
 * Covers (1) the pure weekly-period math, (2) the fire-and-forget award helper, and
 * (3) the XP valuation wired into createOrUpdateAchievement — XP must derive from the
 * progress the achievements store actually APPLIED (not the raw progressCount passed in),
 * so repeat calls against an already-complete tier award nothing.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { createOrUpdateAchievement } from '../../src/handlers/helpers/achievements';
import { awardLeaderboardPoints } from '../../src/handlers/helpers/leaderboards';
import { detectAndCelebrateRankMilestones } from '../../src/handlers/helpers/leaderboardRankMilestones';
import {
    LeaderboardXpValues,
    getCrossedRankMilestones,
    getLeaderboardPeriodStart,
    getLeaderboardPeriodEnd,
} from '../../src/utilities/leaderboardHelpers';

const therrHeaders = {
    'x-userid': 'user-1',
    'x-brand-variation': BrandVariations.THERR,
    'x-platform': 'mobile',
    'x-localecode': 'en-us',
};

describe('leaderboardHelpers — weekly period math', () => {
    it('anchors any day of the week to that week\'s Monday (UTC)', () => {
        // 2026-07-13 is a Monday
        expect(getLeaderboardPeriodStart(new Date('2026-07-13T00:00:00Z'))).to.equal('2026-07-13');
        expect(getLeaderboardPeriodStart(new Date('2026-07-15T12:30:00Z'))).to.equal('2026-07-13');
        expect(getLeaderboardPeriodStart(new Date('2026-07-18T23:59:59Z'))).to.equal('2026-07-13');
        // Sunday belongs to the week started the previous Monday
        expect(getLeaderboardPeriodStart(new Date('2026-07-19T23:59:59Z'))).to.equal('2026-07-13');
        // Next Monday rolls over
        expect(getLeaderboardPeriodStart(new Date('2026-07-20T00:00:00Z'))).to.equal('2026-07-20');
    });

    it('handles month boundaries', () => {
        // 2026-07-01 is a Wednesday; its week began Monday 2026-06-29
        expect(getLeaderboardPeriodStart(new Date('2026-07-01T08:00:00Z'))).to.equal('2026-06-29');
    });

    it('returns the following Monday as the exclusive period end', () => {
        expect(getLeaderboardPeriodEnd('2026-07-13')).to.equal('2026-07-20');
        expect(getLeaderboardPeriodEnd('2026-06-29')).to.equal('2026-07-06');
    });
});

describe('awardLeaderboardPoints', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('increments the current weekly period for the requesting user and brand', async () => {
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await awardLeaderboardPoints(therrHeaders as any, 25, 'test');

        expect(incrementStub.calledOnce).to.equal(true);
        const [brand, userId, periodStart, points] = incrementStub.firstCall.args;
        expect(brand).to.equal(BrandVariations.THERR);
        expect(userId).to.equal('user-1');
        expect(periodStart).to.equal(getLeaderboardPeriodStart());
        expect(points).to.equal(25);
    });

    it('no-ops without a user id or with a non-positive amount', async () => {
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints');

        await awardLeaderboardPoints({ ...therrHeaders, 'x-userid': undefined } as any, 25, 'test');
        await awardLeaderboardPoints(therrHeaders as any, 0, 'test');
        await awardLeaderboardPoints(therrHeaders as any, -5, 'test');

        expect(incrementStub.called).to.equal(false);
    });

    it('swallows store failures (never throws into the earning action)', async () => {
        sinon.stub(Store.userLeaderboardScores, 'incrementPoints').rejects(new Error('db-down'));

        const result = await awardLeaderboardPoints(therrHeaders as any, 25, 'test');
        expect(result).to.equal(null);
    });
});

describe('createOrUpdateAchievement — leaderboard XP valuation', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('awards XP for the progress applied to newly created rows', async () => {
        sinon.stub(Store.userAchievements, 'get').resolves([]);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [{ achievementId: 'socialite_1_1', progressCount: 2 }],
            updated: [],
            action: 'created-first-of-tier',
        } as any);
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await createOrUpdateAchievement(therrHeaders as any, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 2,
        });

        expect(incrementStub.calledOnce).to.equal(true);
        expect(incrementStub.firstCall.args[3]).to.equal(2 * LeaderboardXpValues.activityUnit);
    });

    it('adds the achievement\'s own xp as a completion bonus', async () => {
        sinon.stub(Store.userAchievements, 'get').resolves([]);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            // socialite_1_1 config: countToComplete 3, xp 10
            created: [{ achievementId: 'socialite_1_1', progressCount: 3, completedAt: new Date() }],
            updated: [],
            action: 'created-first-of-tier',
        } as any);
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        // No authorization header: the ACHIEVEMENT_COMPLETED notification path is skipped,
        // keeping this a pure XP test.
        await createOrUpdateAchievement(therrHeaders as any, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 3,
        });

        expect(incrementStub.calledOnce).to.equal(true);
        expect(incrementStub.firstCall.args[3]).to.equal((3 * LeaderboardXpValues.activityUnit) + 10);
    });

    it('only values the delta added to an in-progress row, not its whole progress', async () => {
        sinon.stub(Store.userAchievements, 'get').resolves([{
            id: 'ach-row-1',
            achievementId: 'socialite_1_1',
            progressCount: 2,
            completedAt: null,
        }]);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [],
            updated: [{ achievementId: 'socialite_1_1', progressCount: 3, completedAt: null }],
            action: 'updated-in-progress-tier',
        } as any);
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await createOrUpdateAchievement(therrHeaders as any, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 1,
        });

        expect(incrementStub.calledOnce).to.equal(true);
        expect(incrementStub.firstCall.args[3]).to.equal(1 * LeaderboardXpValues.activityUnit);
    });

    it('awards nothing when the tier is already complete (idempotent repeat calls)', async () => {
        sinon.stub(Store.userAchievements, 'get').resolves([]);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [],
            updated: [],
            action: 'achievement-tier-already-complete',
        } as any);
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await createOrUpdateAchievement(therrHeaders as any, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 5,
        });

        expect(incrementStub.called).to.equal(false);
    });

    it('awards nothing for a brand-disabled class (explorer stays Therr-only)', async () => {
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await createOrUpdateAchievement({
            ...therrHeaders,
            'x-brand-variation': BrandVariations.HABITS,
        } as any, {
            achievementClass: 'explorer',
            achievementTier: '1_1',
            progressCount: 1,
        });

        expect(incrementStub.called).to.equal(false);
    });
});

describe('getCrossedRankMilestones', () => {
    it('detects entering the top 10 / top 3 / #1 from outside', () => {
        expect(getCrossedRankMilestones(15, 8)).to.deep.equal([10]);
        expect(getCrossedRankMilestones(8, 2)).to.deep.equal([3]);
        expect(getCrossedRankMilestones(2, 1)).to.deep.equal([1]);
        expect(getCrossedRankMilestones(50, 1)).to.deep.equal([1, 3, 10]);
    });

    it('does not re-trigger while already inside a threshold', () => {
        expect(getCrossedRankMilestones(8, 5)).to.deep.equal([]);
        expect(getCrossedRankMilestones(1, 1)).to.deep.equal([]);
        expect(getCrossedRankMilestones(10, 10)).to.deep.equal([]);
    });

    it('never triggers on a rank drop', () => {
        expect(getCrossedRankMilestones(5, 12)).to.deep.equal([]);
    });
});

describe('detectAndCelebrateRankMilestones', () => {
    const eligibleUser = {
        id: 'user-1',
        userName: 'tester',
        settingsIsLeaderboardEnabled: true,
        settingsIsAccountSoftDeleted: false,
    };

    afterEach(() => {
        sinon.restore();
    });

    it('awards weeklyChampion progress and attempts a push when the user climbs into the top 10', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore')
            .onFirstCall().resolves(15) // prev rank
            .onSecondCall()
            .resolves(8); // new rank
        sinon.stub(Store.users, 'getUserById').resolves([eligibleUser]);
        // findUser resolving empty makes sendEmailAndOrPushNotification exit before any HTTP call
        const findUserStub = sinon.stub(Store.users, 'findUser').resolves([] as any);
        const getStub = sinon.stub(Store.userAchievements, 'get').resolves([]);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [],
            updated: [],
            action: 'incomplete',
        } as any);
        sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await detectAndCelebrateRankMilestones(therrHeaders as any, { prevPoints: 10, newPoints: 60 });

        expect(findUserStub.calledOnce, 'push path should be attempted').to.equal(true);
        expect(getStub.calledOnce, 'weeklyChampion award should run').to.equal(true);
        expect(getStub.firstCall.args[1]).to.include({
            achievementClass: 'weeklyChampion',
            achievementTier: '1_1',
        });
    });

    it('awards one weeklyChampion tier per threshold crossed in a single hop', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore')
            .onFirstCall().resolves(20)
            .onSecondCall()
            .resolves(1);
        sinon.stub(Store.users, 'getUserById').resolves([eligibleUser]);
        sinon.stub(Store.users, 'findUser').resolves([] as any);
        const getStub = sinon.stub(Store.userAchievements, 'get').resolves([]);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').resolves({
            created: [],
            updated: [],
            action: 'incomplete',
        } as any);
        sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await detectAndCelebrateRankMilestones(therrHeaders as any, { prevPoints: 0, newPoints: 500 });

        const awardedTiers = getStub.getCalls().map((call) => call.args[1].achievementTier).sort();
        expect(awardedTiers).to.deep.equal(['1_1', '1_2', '1_3']);
    });

    it('does nothing when no threshold is crossed', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore').resolves(25);
        const getUserByIdStub = sinon.stub(Store.users, 'getUserById');
        const findUserStub = sinon.stub(Store.users, 'findUser');

        await detectAndCelebrateRankMilestones(therrHeaders as any, { prevPoints: 10, newPoints: 15 });

        expect(getUserByIdStub.called).to.equal(false);
        expect(findUserStub.called).to.equal(false);
    });

    it('respects the leaderboard opt-out (no push, no achievement)', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore')
            .onFirstCall().resolves(15)
            .onSecondCall()
            .resolves(8);
        sinon.stub(Store.users, 'getUserById').resolves([{
            ...eligibleUser,
            settingsIsLeaderboardEnabled: false,
        }]);
        const findUserStub = sinon.stub(Store.users, 'findUser');
        const getStub = sinon.stub(Store.userAchievements, 'get');

        await detectAndCelebrateRankMilestones(therrHeaders as any, { prevPoints: 10, newPoints: 60 });

        expect(findUserStub.called).to.equal(false);
        expect(getStub.called).to.equal(false);
    });

    it('swallows rank-query failures without throwing', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore').rejects(new Error('db-down'));

        const result = await detectAndCelebrateRankMilestones(therrHeaders as any, { prevPoints: 0, newPoints: 100 });
        expect(result).to.equal(null);
    });

    // Regression: the XP award is written BEFORE this detector runs, so a rank query for the
    // user's PREVIOUS score counted the user's own (already-incremented) row as being ahead
    // of it — inflating prevRank by exactly one. A user sitting at rank 1 saw prevRank=2 /
    // newRank=1 on every award and re-crossed the "#1" threshold each time, spamming a push
    // and re-awarding weeklyChampion progress. Both rank queries must exclude the user.
    it('excludes the requesting user from both rank queries so a steady rank never re-triggers', async () => {
        const rankStub = sinon.stub(Store.userLeaderboardScores, 'getRankForScore').resolves(1);
        sinon.stub(Store.users, 'getUserById').resolves([eligibleUser]);
        const findUserStub = sinon.stub(Store.users, 'findUser');

        await detectAndCelebrateRankMilestones(therrHeaders as any, { prevPoints: 100, newPoints: 105 });

        expect(rankStub.callCount).to.equal(2);
        rankStub.getCalls().forEach((call) => {
            expect(call.args[2]).to.include({ excludeUserId: 'user-1' });
        });
        // Rank was 1 before and after — nothing was crossed, so no celebration fires.
        expect(findUserStub.called, 'a user already at #1 must not be re-notified').to.equal(false);
    });
});

describe('UserLeaderboardScoresStore.getRankForScore — excludeUserId', () => {
    const buildStore = () => {
        const query = sinon.stub().resolves({ rows: [{ count: '0' }] });
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const StoreClass = require('../../src/store/UserLeaderboardScoresStore').default;
        return { query, store: new StoreClass({ read: { query }, write: { query } }) };
    };

    it('filters out the excluded user in the weekly (periodStart) query', async () => {
        const { query, store } = buildStore();

        await store.getRankForScore(BrandVariations.THERR, 100, {
            periodStart: '2026-07-13',
            excludeUserId: 'user-1',
        });

        expect(query.firstCall.args[0]).to.contain('not "main"."userLeaderboardScores"."userId" = \'user-1\'');
    });

    it('filters out the excluded user in the all-time query', async () => {
        const { query, store } = buildStore();

        await store.getRankForScore(BrandVariations.THERR, 100, { excludeUserId: 'user-1' });

        expect(query.firstCall.args[0]).to.contain('not "main"."userLeaderboardScores"."userId" = \'user-1\'');
    });

    it('omits the exclusion when no excludeUserId is given (public board ranking)', async () => {
        const { query, store } = buildStore();

        await store.getRankForScore(BrandVariations.THERR, 100, { periodStart: '2026-07-13' });

        expect(query.firstCall.args[0]).to.not.contain('not "main"."userLeaderboardScores"."userId" =');
    });
});
