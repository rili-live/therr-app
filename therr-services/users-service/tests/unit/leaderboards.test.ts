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
import {
    LeaderboardXpValues,
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

    it('awards nothing for a brand-disabled class (HABITS earns via direct hooks instead)', async () => {
        const incrementStub = sinon.stub(Store.userLeaderboardScores, 'incrementPoints').resolves([]);

        await createOrUpdateAchievement({
            ...therrHeaders,
            'x-brand-variation': BrandVariations.HABITS,
        } as any, {
            achievementClass: 'socialite',
            achievementTier: '1_1',
            progressCount: 1,
        });

        expect(incrementStub.called).to.equal(false);
    });
});
