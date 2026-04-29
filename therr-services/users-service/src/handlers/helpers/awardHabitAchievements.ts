import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { createOrUpdateAchievement } from './achievements';

export type HabitGoalType = 'build_good' | 'break_bad' | 'savings_goal' | 'maintenance';

// Goal-type → achievement-class routing for streak-based awards.
const CLASS_BY_GOAL_TYPE: Record<HabitGoalType, string> = {
    build_good: 'habitBuilder',
    maintenance: 'habitBuilder',
    break_bad: 'cleanBreak',
    savings_goal: 'treasureBuilder',
};

// Streak ladders per goal type (descending — caller resolves max(currentStreak <= rung))
const STREAK_MILESTONES_BY_TYPE: Record<HabitGoalType, number[]> = {
    build_good: [3, 7, 14, 30, 60, 90, 180, 365],
    maintenance: [3, 7, 14, 30, 60, 90, 180, 365],
    break_bad: [1, 3, 7, 14, 30, 60, 90, 180, 365],
    savings_goal: [7, 14, 30, 60, 100],
};

const swallow = (label: string) => (err: Error) => {
    logSpan({
        level: 'warn',
        messageOrigin: 'API_SERVER',
        messages: [`Achievement award failed: ${label}`],
        traceArgs: { 'error.message': err?.message },
    });
};

const award = (
    headers: InternalConfigHeaders,
    achievementClass: string,
    achievementTier: string,
    progressCount: number,
    label: string,
) => createOrUpdateAchievement(headers, {
    achievementClass,
    achievementTier,
    progressCount,
}).catch(swallow(label));

/**
 * Awards a streak achievement when a user reaches a milestone rung in their goalType's ladder.
 * Passes the delta between this milestone and the previous one as progressCount, so the
 * store's incremental tier-completion logic completes each tier exactly at its milestone with
 * no overshoot. No-op if currentStreak is not on the ladder.
 */
export const awardStreakAchievement = (
    headers: InternalConfigHeaders,
    {
        goalType,
        currentStreak,
    }: { goalType: HabitGoalType; currentStreak: number },
) => {
    const ladder = STREAK_MILESTONES_BY_TYPE[goalType] || STREAK_MILESTONES_BY_TYPE.build_good;
    const idx = ladder.indexOf(currentStreak);
    if (idx === -1) {
        return Promise.resolve(null);
    }
    const previousMilestone = idx === 0 ? 0 : ladder[idx - 1];
    const delta = currentStreak - previousMilestone;
    const achievementClass = CLASS_BY_GOAL_TYPE[goalType] || CLASS_BY_GOAL_TYPE.build_good;
    return award(headers, achievementClass, '1_1', delta, `streak:${achievementClass}:${currentStreak}`);
};

// Tier countToComplete ladder for consistency_1_1.
const CONSISTENCY_LADDER = [7, 14, 30, 90];

/**
 * Awards a consistency achievement (single-habit perfect period). Uses the delta approach so each
 * tier completes exactly when the streak reaches the matching ladder rung.
 */
export const awardConsistencyAchievement = (
    headers: InternalConfigHeaders,
    currentStreak: number,
) => {
    const idx = CONSISTENCY_LADDER.indexOf(currentStreak);
    if (idx === -1) {
        return Promise.resolve(null);
    }
    const previousRung = idx === 0 ? 0 : CONSISTENCY_LADDER[idx - 1];
    const delta = currentStreak - previousRung;
    return award(headers, 'consistency', '1_1', delta, `consistency:1_1:${currentStreak}`);
};

export const awardConsistencyMultiAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'consistency', '1_2', progressCount, 'consistency:1_2');

export const awardResilienceComebackAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'resilience', '1_1', progressCount, 'resilience:1_1');

export const awardResilienceWithinPactAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'resilience', '1_2', progressCount, 'resilience:1_2');

export const awardAccountabilitySelfAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'accountability', '1_1', progressCount, 'accountability:1_1');

export const awardAccountabilityWingAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'accountability', '1_2', progressCount, 'accountability:1_2');

export const awardPactPioneerCreatedAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'pactPioneer', '1_1', progressCount, 'pactPioneer:1_1');

export const awardPactPioneerInvitesAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'pactPioneer', '1_2', progressCount, 'pactPioneer:1_2');

export const awardSocialEnergizerReactionAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'socialEnergizer', '1_1', progressCount, 'socialEnergizer:1_1');

export const awardSocialEnergizerCelebrationAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'socialEnergizer', '1_2', progressCount, 'socialEnergizer:1_2');

export const awardTreasurePactCompletionAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'treasureBuilder', '1_2', progressCount, 'treasureBuilder:1_2');

export const awardSocialiteInviteAchievement = (
    headers: InternalConfigHeaders,
    progressCount: number,
) => award(headers, 'socialite', '1_1', progressCount, 'socialite:1_1');

export {
    CLASS_BY_GOAL_TYPE,
    STREAK_MILESTONES_BY_TYPE,
};
