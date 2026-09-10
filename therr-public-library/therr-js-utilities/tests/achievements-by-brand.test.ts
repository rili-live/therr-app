/**
 * Brand-scoped achievement classes — niche apps must not silently surface
 * Therr-themed achievements (`explorer`, `influencer`, `thinker`, etc.) just
 * because the SQL row was stamped with their brandVariation. The
 * BrandScopedStore filter prevents cross-brand reads at the row level; this
 * allow-list decides which classes a brand may EARN.
 *
 * Policy as of the 2026-07 leaderboards release:
 *   - THERR / DASHBOARD_THERR earn every class.
 *   - HABITS earns the streak/pact-themed ladder (accountability, cleanBreak,
 *     consistency, habitBuilder, pactPioneer, resilience, socialEnergizer,
 *     treasureBuilder) plus `socialite` (invite virality) and `weeklyChampion`
 *     (leaderboard rank milestones). This ends the interim "HABITS earns
 *     nothing" policy from a55bce90d.
 *   - TEEM and other brands still earn nothing until they get their own list.
 */
import { expect } from 'chai';
import { BrandVariations } from '../src/constants/enums/Branding';
import {
    achievementClassesByBrand,
    achievementsByClass,
    isAchievementClassEnabledForBrand,
} from '../src/config/achievements';

const HABITS_ENABLED_CLASSES = [
    'accountability',
    'cleanBreak',
    'consistency',
    'habitBuilder',
    'pactPioneer',
    'resilience',
    'socialEnergizer',
    'socialite',
    'treasureBuilder',
    'weeklyChampion',
];

describe('isAchievementClassEnabledForBrand', () => {
    const allClasses = Object.keys(achievementsByClass);

    it('allows every class for the THERR brand', () => {
        allClasses.forEach((cls) => {
            expect(
                isAchievementClassEnabledForBrand(cls, BrandVariations.THERR),
                `expected ${cls} to be enabled for THERR`,
            ).to.equal(true);
        });
    });

    it('allows exactly the habit ladder + socialite + weeklyChampion for HABITS', () => {
        allClasses.forEach((cls) => {
            const expected = HABITS_ENABLED_CLASSES.includes(cls);
            expect(
                isAchievementClassEnabledForBrand(cls, BrandVariations.HABITS),
                `expected ${cls} enablement for HABITS to be ${expected}`,
            ).to.equal(expected);
        });
    });

    it('blocks Therr-only classes (e.g. explorer, influencer) for HABITS', () => {
        ['explorer', 'influencer', 'thinker', 'localScout', 'tourGuide'].forEach((cls) => {
            expect(isAchievementClassEnabledForBrand(cls, BrandVariations.HABITS)).to.equal(false);
        });
    });

    it('blocks every class for the TEEM brand', () => {
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

    it('exposes the brand → classes map for Therr brands and HABITS', () => {
        expect(achievementClassesByBrand).to.have.property(BrandVariations.THERR);
        expect(achievementClassesByBrand).to.have.property(BrandVariations.DASHBOARD_THERR);
        expect(achievementClassesByBrand).to.have.property(BrandVariations.HABITS);
        expect(achievementClassesByBrand).to.not.have.property(BrandVariations.TEEM);
    });

    it('every allow-listed class name resolves to a real class', () => {
        Object.values(achievementClassesByBrand).forEach((classSet) => {
            classSet.forEach((cls) => {
                expect(achievementsByClass, `unknown class in allow-list: ${cls}`).to.have.property(cls);
            });
        });
    });
});
