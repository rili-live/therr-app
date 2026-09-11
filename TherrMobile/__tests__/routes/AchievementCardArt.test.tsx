import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { achievementClassesByBrand, achievementsByClass } from 'therr-js-utilities/config';

/**
 * Brand-relative, like `brandSurfaceConsistency`: on Friends with Habits every
 * achievement tile draws the Habits badge and no Lottie; on Therr the Lottie cards
 * still render and the badge never appears. Runs against every class the current
 * brand can actually earn, so a class added to the brand's allow-list without card
 * art fails here rather than rendering a blank tile.
 */
jest.mock('lottie-react-native', () => 'LottieView');

import AchievementTile from '../../main/routes/Achievements/AchievementTile';
import { CURRENT_BRAND_VARIATION } from '../../main/config/brandConfig';
import { buildStyles as buildAchievementStyles } from '../../main/styles/achievements';

const themeAchievements = buildAchievementStyles('light');
const isHabits = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;
const brandClasses = Array.from(achievementClassesByBrand[CURRENT_BRAND_VARIATION] || []);

const buildUserAchievement = (achievementClass: string, overrides: any = {}) => {
    const achievementId = Object.keys(achievementsByClass[achievementClass])[0];

    return {
        id: `ua-${achievementClass}`,
        achievementClass,
        achievementId,
        progressCount: 0,
        unclaimedRewardPts: 0,
        completedAt: null,
        ...overrides,
    };
};

const renderTile = (userAchievement: any) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <AchievementTile
                claimText="Claim"
                completedText="Completed"
                handleClaim={() => undefined}
                isClaiming={false}
                onPressAchievement={() => undefined}
                progressText={({ count, total }) => `${count} of ${total}`}
                userAchievement={userAchievement}
                themeAchievements={themeAchievements}
            />,
        );
    });
    return tree!;
};

const countBadges = (tree: renderer.ReactTestRenderer) => tree.root.findAll(
    (node) => typeof node.type === 'string' && typeof node.props.testID === 'string'
        && node.props.testID.startsWith('habits-achievement-badge-'),
).length;
const countLotties = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType('LottieView' as any).length;

describe('AchievementTile card art', () => {
    it('has classes to check for this brand', () => {
        expect(brandClasses.length).toBeGreaterThan(0);
    });

    it.each(brandClasses)(`draws the ${isHabits ? 'Habits badge' : 'Lottie card'} for "%s" on ${CURRENT_BRAND_VARIATION}`, (achievementClass) => {
        const tree = renderTile(buildUserAchievement(achievementClass));

        expect(countBadges(tree)).toBe(isHabits ? 1 : 0);
        expect(countLotties(tree)).toBe(isHabits ? 0 : 1);
    });

    it('passes completion through to the card art', () => {
        const [achievementClass] = brandClasses;
        const earned = renderTile(buildUserAchievement(achievementClass, {
            completedAt: '2026-09-01T00:00:00.000Z',
            progressCount: 99,
        }));
        const unearned = renderTile(buildUserAchievement(achievementClass));

        if (isHabits) {
            const opacityOf = (tree: renderer.ReactTestRenderer) => {
                const style = tree.root.findByProps({ testID: `habits-achievement-badge-${achievementClass}` }).props.style;
                return Object.assign({}, ...(Array.isArray(style) ? style : [style])).opacity;
            };

            expect(opacityOf(earned)).toBe(1);
            expect(opacityOf(unearned)).toBeLessThan(1);
        } else {
            // Therr's Lottie card renders the same frame either way.
            expect(countLotties(earned)).toBe(1);
            expect(countLotties(unearned)).toBe(1);
        }
    });
});
