import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { achievementClassesByBrand, achievementsByClass } from 'therr-js-utilities/config';
import { Stop } from 'react-native-svg';

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
            // An earned badge is painted in its class colour; one in progress is not.
            const groundOf = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Stop)[0].props.stopColor;

            expect(groundOf(earned)).not.toBe(groundOf(unearned));
        } else {
            // Therr's Lottie card renders the same frame either way.
            expect(countLotties(earned)).toBe(1);
            expect(countLotties(unearned)).toBe(1);
        }
    });

    it('draws nothing, rather than throwing, for an achievement this build has no config for', () => {
        const tree = renderTile({
            id: 'ua-future',
            achievementClass: brandClasses[0],
            achievementId: 'notInThisBuild_9_9',
            progressCount: 1,
            completedAt: null,
        });

        expect(tree.toJSON()).toBeNull();
    });

    it('offers the claim button only while a reward is waiting', () => {
        const [achievementClass] = brandClasses;
        const claimButtons = (tree: renderer.ReactTestRenderer) => tree.root.findAll(
            (node) => typeof node.type !== 'string' && node.props.accessibilityLabel === 'Claim',
        ).length;

        const claimable = renderTile(buildUserAchievement(achievementClass, {
            completedAt: '2026-09-01T00:00:00.000Z',
            unclaimedRewardPts: '0.50',
        }));
        const claimed = renderTile(buildUserAchievement(achievementClass, { completedAt: '2026-09-01T00:00:00.000Z' }));

        expect(claimButtons(claimable)).toBeGreaterThan(0);
        expect(claimButtons(claimed)).toBe(0);
        expect(claimButtons(renderTile(buildUserAchievement(achievementClass)))).toBe(0);
    });
});
