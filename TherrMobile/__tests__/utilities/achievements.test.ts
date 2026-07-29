// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import { getUnclaimedAchievementsCount } from '../../main/utilities/achievements';

/**
 * Unclaimed Achievements Badge Count Tests
 *
 * The right drawer (components/HeaderMenuRight.tsx) renders a badge next to the
 * "Achievements" menu item using this count. It must stay in sync with the
 * "unclaimed" section on the Achievements screen (routes/Achievements/index.tsx),
 * which treats an achievement as unclaimed when it is completed AND still has
 * reward points outstanding.
 */

describe('getUnclaimedAchievementsCount', () => {
    it('returns 0 when achievements are missing', () => {
        expect(getUnclaimedAchievementsCount(undefined)).toBe(0);
        expect(getUnclaimedAchievementsCount({})).toBe(0);
    });

    it('counts completed achievements with outstanding reward points', () => {
        const achievements = {
            1: { id: 1, completedAt: '2026-07-01T00:00:00.000Z', unclaimedRewardPts: 10 },
            2: { id: 2, completedAt: '2026-07-02T00:00:00.000Z', unclaimedRewardPts: 5 },
        };

        expect(getUnclaimedAchievementsCount(achievements)).toBe(2);
    });

    it('excludes achievements that are still in progress', () => {
        const achievements = {
            1: { id: 1, completedAt: null, unclaimedRewardPts: 10 },
            2: { id: 2, completedAt: undefined, unclaimedRewardPts: 10 },
            3: { id: 3, completedAt: '2026-07-02T00:00:00.000Z', unclaimedRewardPts: 5 },
        };

        expect(getUnclaimedAchievementsCount(achievements)).toBe(1);
    });

    it('excludes achievements whose rewards were already claimed', () => {
        const achievements = {
            1: { id: 1, completedAt: '2026-07-01T00:00:00.000Z', unclaimedRewardPts: 0 },
            2: { id: 2, completedAt: '2026-07-02T00:00:00.000Z', unclaimedRewardPts: null },
            3: { id: 3, completedAt: '2026-07-03T00:00:00.000Z', unclaimedRewardPts: 20 },
        };

        expect(getUnclaimedAchievementsCount(achievements)).toBe(1);
    });

    it('handles reward points serialized as strings', () => {
        const achievements = {
            1: { id: 1, completedAt: '2026-07-01T00:00:00.000Z', unclaimedRewardPts: '15' },
            2: { id: 2, completedAt: '2026-07-02T00:00:00.000Z', unclaimedRewardPts: '0' },
        };

        expect(getUnclaimedAchievementsCount(achievements)).toBe(1);
    });
});
