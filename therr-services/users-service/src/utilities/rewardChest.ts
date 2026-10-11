/**
 * The daily reward chest: the odds and the roll. Pure, so the distribution can be tested
 * without a database; handlers/rewardChests.ts does the claiming and paying.
 *
 * Why a random reward at all: a fixed payout stops being noticed after a week, while a variable
 * one keeps the moment of opening worth looking at — the same mechanic as Duolingo's chest. The
 * leaderboard is the constraint. It ranks effort, so the chest must never be able to outrank
 * effort:
 *
 *   - one chest per local day, and only on a day the user *upheld* their streak, so it scales
 *     with consistency and nothing else;
 *   - the expected value is ~10 XP (standard) / ~20 XP (boosted), the size of one check-in, and
 *     even a jackpot (50 XP) is less than a week of a single daily habit (70 XP);
 *   - the roll happens on the server, never the client, and is written before it is paid, so
 *     re-opening cannot re-roll.
 *
 * Boosted odds (no commons, more epics and jackpots) are what a streak milestone or a perfect
 * week adds: the "bigger chest" for the bigger day.
 */

export type RewardChestTier = 'standard' | 'boosted';
export type RewardChestRarity = 'common' | 'rare' | 'epic' | 'jackpot';

interface IRewardChestOdds {
    rarity: RewardChestRarity;
    /** Relative weight; the weights of a tier need not sum to 100. */
    weight: number;
    minXp: number;
    maxXp: number;
}

export const REWARD_CHEST_ODDS: Record<RewardChestTier, IRewardChestOdds[]> = {
    standard: [
        {
            rarity: 'common', weight: 60, minXp: 3, maxXp: 8,
        },
        {
            rarity: 'rare', weight: 28, minXp: 10, maxXp: 15,
        },
        {
            rarity: 'epic', weight: 10, minXp: 20, maxXp: 30,
        },
        {
            rarity: 'jackpot', weight: 2, minXp: 50, maxXp: 50,
        },
    ],
    boosted: [
        {
            rarity: 'rare', weight: 60, minXp: 10, maxXp: 15,
        },
        {
            rarity: 'epic', weight: 32, minXp: 20, maxXp: 30,
        },
        {
            rarity: 'jackpot', weight: 8, minXp: 50, maxXp: 50,
        },
    ],
};

/** Kill switch. On unless explicitly `false`; an older client never asks, so on is harmless. */
export const isRewardChestEnabled = (): boolean => process.env.HABIT_REWARD_CHESTS_ENABLED !== 'false';

export const getRewardChestTier = ({ isMilestone, isPerfectWeek }: { isMilestone: boolean; isPerfectWeek: boolean }): RewardChestTier => (
    isMilestone || isPerfectWeek ? 'boosted' : 'standard'
);

export interface IRewardChestRoll {
    tier: RewardChestTier;
    rarity: RewardChestRarity;
    rewardXp: number;
}

/**
 * Roll a chest. `randomInt(maxExclusive)` must return an integer in [0, maxExclusive); it is
 * `crypto.randomInt` in production and injected in tests.
 */
export const rollRewardChest = (
    tier: RewardChestTier,
    randomInt: (maxExclusive: number) => number,
): IRewardChestRoll => {
    const odds = REWARD_CHEST_ODDS[tier];
    const totalWeight = odds.reduce((sum, entry) => sum + entry.weight, 0);
    let pick = randomInt(totalWeight);
    const entry = odds.find((candidate) => {
        if (pick < candidate.weight) {
            return true;
        }
        pick -= candidate.weight;
        return false;
    }) || odds[0];

    return {
        tier,
        rarity: entry.rarity,
        rewardXp: entry.minXp + randomInt(entry.maxXp - entry.minXp + 1),
    };
};

/** The mean XP of a tier, for the doc and the tests that pin the leaderboard budget. */
export const getExpectedRewardXp = (tier: RewardChestTier): number => {
    const odds = REWARD_CHEST_ODDS[tier];
    const totalWeight = odds.reduce((sum, entry) => sum + entry.weight, 0);
    return odds.reduce((sum, entry) => sum + (entry.weight / totalWeight) * ((entry.minXp + entry.maxXp) / 2), 0);
};
