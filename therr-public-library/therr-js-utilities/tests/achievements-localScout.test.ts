import { expect } from 'chai';
import localScout from '../src/config/achievements/localScout';
import achievements, { achievementsByClass, IAchievement } from '../src/config/achievements';

describe('LocalScout Achievements', () => {
    it('should export localScout achievements', () => {
        expect(localScout).to.be.an('object');
        expect(Object.keys(localScout).length).to.be.greaterThan(0);
    });

    it('should be registered in the main achievements object', () => {
        expect(achievements).to.have.property('localScout_1_1');
    });

    it('should be registered in achievementsByClass', () => {
        expect(achievementsByClass).to.have.property('localScout');
        expect(achievementsByClass.localScout).to.deep.equal(localScout);
    });

    describe('achievement tiers', () => {
        const tiers = Object.entries(localScout) as [string, IAchievement][];

        it('should have 5 tiers', () => {
            expect(tiers).to.have.lengthOf(5);
        });

        it('each tier should have required fields', () => {
            tiers.forEach(([key, achievement]) => {
                expect(achievement.title, `${key} missing title`).to.be.a('string');
                expect(achievement.description, `${key} missing description`).to.be.a('string');
                expect(achievement.countToComplete, `${key} missing countToComplete`).to.be.a('number');
                expect(achievement.xp, `${key} missing xp`).to.be.a('number');
                expect(achievement.pointReward, `${key} missing pointReward`).to.be.a('number');
                expect(achievement.tier, `${key} missing tier`).to.be.a('string');
                expect(achievement.version, `${key} missing version`).to.be.a('number');
                expect(achievement.prerequisite, `${key} missing prerequisite`).to.be.a('function');
            });
        });

        it('countToComplete should increase across tiers', () => {
            const counts = tiers.map(([, a]) => a.countToComplete);
            for (let i = 1; i < counts.length; i += 1) {
                expect(counts[i]).to.be.greaterThan(
                    counts[i - 1],
                    `Tier ${i} countToComplete should be greater than tier ${i - 1}`,
                );
            }
        });

        it('first tier should have no prerequisite', () => {
            const [, firstTier] = tiers[0];
            expect(firstTier.prerequisite({})).to.be.equal(true);
        });

        it('second tier should require first tier', () => {
            const [, secondTier] = tiers[1];
            expect(secondTier.prerequisite({})).to.be.equal(false);
            expect(secondTier.prerequisite({ localScout_1_1: true })).to.be.equal(true);
        });

        it('each subsequent tier should require the previous tier', () => {
            for (let i = 1; i < tiers.length; i += 1) {
                const [prevKey] = tiers[i - 1];
                const [, currentTier] = tiers[i];
                expect(currentTier.prerequisite({})).to.be.equal(false);
                expect(currentTier.prerequisite({ [prevKey]: true })).to.be.equal(true);
            }
        });
    });
});
