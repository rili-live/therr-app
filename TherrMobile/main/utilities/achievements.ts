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
