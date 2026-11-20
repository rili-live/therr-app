import { expect } from 'chai';
import { BrandVariations } from '../src/constants/enums/Branding';
import {
    LEADERBOARD_TIERS_BY_BRAND,
    getLeaderboardTierIndex,
    getLeaderboardTiers,
    getLowestLeaderboardTier,
    resolveLeaderboardTier,
} from '../src/config/leaderboardTiers';

describe('leaderboard tiers', () => {
    it('gives Friends with Habits and Therr their own branded ladders', () => {
        expect(getLeaderboardTiers(BrandVariations.HABITS).map((tier) => tier.id))
            .to.deep.equal(['seedling', 'sprout', 'sapling', 'bloom', 'oak', 'evergreen']);
        expect(getLeaderboardTiers(BrandVariations.THERR).map((tier) => tier.id))
            .to.deep.equal(['wanderer', 'scout', 'pathfinder', 'trailblazer', 'cartographer', 'legend']);
    });

    it('has no tiers for a brand without a leaderboard', () => {
        expect(getLeaderboardTiers(BrandVariations.TEEM)).to.deep.equal([]);
        expect(getLeaderboardTiers(undefined)).to.deep.equal([]);
        expect(getLowestLeaderboardTier(BrandVariations.TEEM)).to.equal(undefined);
        expect(getLeaderboardTierIndex(BrandVariations.TEEM, 'seedling')).to.equal(-1);
    });

    it('keeps every persisted id unique within its brand and inside the 50-char column', () => {
        Object.values(LEADERBOARD_TIERS_BY_BRAND).forEach((tiers) => {
            const ids = tiers.map((tier) => tier.id);
            expect(new Set(ids).size).to.equal(ids.length);
            ids.forEach((id) => expect(id.length).to.be.at.most(50));
            expect(tiers.length).to.be.at.least(2);
        });
    });

    it('reads a null, unknown or other-brand id as the lowest tier, never as -1', () => {
        expect(getLeaderboardTierIndex(BrandVariations.HABITS, null)).to.equal(0);
        expect(getLeaderboardTierIndex(BrandVariations.HABITS, 'no-such-tier')).to.equal(0);
        expect(getLeaderboardTierIndex(BrandVariations.HABITS, 'legend')).to.equal(0);
        expect(getLeaderboardTierIndex(BrandVariations.HABITS, 'oak')).to.equal(4);
        expect(resolveLeaderboardTier(BrandVariations.THERR, undefined)?.id).to.equal('wanderer');
        expect(resolveLeaderboardTier(BrandVariations.THERR, 'legend')?.id).to.equal('legend');
    });
});
