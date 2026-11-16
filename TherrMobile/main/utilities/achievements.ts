/**
 * Counts achievements the user has completed but not yet claimed rewards for.
 * Mirrors the "unclaimed" section criteria on the Achievements screen
 * (routes/Achievements/index.tsx) so the drawer badge always matches what
 * that screen lists.
 */
export const getUnclaimedAchievementsCount = (achievements?: { [key: string]: any }): number => Object
    .values(achievements || {})
    .filter((ach: any) => !!ach?.completedAt && Number(ach?.unclaimedRewardPts) > 0)
    .length;

/**
 * A coin or XP amount for display. Rewards are configured as decimals (`0.50`, `2.00`) and
 * arrive from the API as strings; this drops the trailing zeros ("0.5", "2") and returns
 * an empty string for nothing, so a caller can use it as the "is there a reward" check too.
 */
export const formatRewardAmount = (amount: number | string | undefined | null): string => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        return '';
    }
    return String(Math.round(value * 100) / 100);
};
