/**
 * Brand-scoped achievement classes — niche apps must not silently surface
 * Therr-themed achievements (`socialite`, `explorer`, `influencer`, `thinker`,
 * etc.) just because the SQL row was stamped with their brandVariation. The
 * BrandScopedStore filter prevents cross-brand reads at the row level, but the
 * classes themselves are content-coupled to Therr — niche brands like HABITS
 * will ship their own (streak-based) classes per HABITS_PROJECT_BRIEF.md.
 *
 * Until those niche classes exist, every current class must be locked to THERR
 * so registration seeds and activity-driven creates skip on niche brands.
 */
import { expect } from 'chai';
import { BrandVariations } from '../src/constants/enums/Branding';
import {
    achievementClassesByBrand,
    achievementsByClass,
    isAchievementClassEnabledForBrand,
} from '../src/config/achievements';

describe('isAchievementClassEnabledForBrand', () => {
    const allClasses = Object.keys(achievementsByClass);

    it('allows every Therr-themed class for the THERR brand', () => {
        allClasses.forEach((cls) => {
            expect(
                isAchievementClassEnabledForBrand(cls, BrandVariations.THERR),
                `expected ${cls} to be enabled for THERR`,
            ).to.equal(true);
        });
    });

    it('blocks every Therr-themed class for the HABITS brand', () => {
        allClasses.forEach((cls) => {
            expect(
                isAchievementClassEnabledForBrand(cls, BrandVariations.HABITS),
                `expected ${cls} to be blocked for HABITS`,
            ).to.equal(false);
        });
    });

    it('blocks every Therr-themed class for the TEEM brand', () => {
        allClasses.forEach((cls) => {
            expect(
                isAchievementClassEnabledForBrand(cls, BrandVariations.TEEM),
                `expected ${cls} to be blocked for TEEM`,
            ).to.equal(false);
        });
    });

    it('returns false when the brand is missing or empty', () => {
        expect(isAchievementClassEnabledForBrand('socialite', undefined)).to.equal(false);
        expect(isAchievementClassEnabledForBrand('socialite', null)).to.equal(false);
        expect(isAchievementClassEnabledForBrand('socialite', '')).to.equal(false);
    });

    it('returns false for an unknown brand even on a known class', () => {
        expect(isAchievementClassEnabledForBrand('socialite', 'made-up-brand')).to.equal(false);
    });

    it('returns false for an unknown class even on the THERR brand', () => {
        expect(isAchievementClassEnabledForBrand('madeUpClass', BrandVariations.THERR)).to.equal(false);
    });

    it('exposes the brand → classes map only for Therr brands today', () => {
        // Sanity check the data shape — adding HABITS-specific classes in the future
        // should land an entry here AND in this test.
        expect(achievementClassesByBrand).to.have.property(BrandVariations.THERR);
        expect(achievementClassesByBrand).to.have.property(BrandVariations.DASHBOARD_THERR);
        expect(achievementClassesByBrand).to.not.have.property(BrandVariations.HABITS);
        expect(achievementClassesByBrand).to.not.have.property(BrandVariations.TEEM);
    });
});
