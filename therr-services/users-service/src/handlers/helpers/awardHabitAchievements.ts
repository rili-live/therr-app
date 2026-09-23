import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { HabitGoalType } from 'therr-js-utilities/constants';
import Store from '../../store';
import { getCadence, countScheduledForRange } from '../../utilities/habitCadence';
import { createOrUpdateAchievement } from './achievements';

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

const MULTI_HABIT_WINDOW_DAYS = 7;
const MULTI_HABIT_LADDER = [2, 3, 5];

const subtractDays = (isoDate: string, days: number): string => {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().split('T')[0];
};

/**
 * Counts how many of the user's habit goals had a perfect 7-day window ending
 * on `asOfDate`, and awards `consistency_1_2` (Two At Once / Triple Threat /
 * All Things at Once) when that count crosses a ladder rung the user has not
 * yet been credited for.
 *
 * "Perfect" is measured against each habit's own cadence, not against seven days. The rung used
 * to require 7 completions in the 7-day window, which a 4x/week habit can never reach — so a
 * user tracking three habits on a weekly cadence, keeping every one of them, was permanently
 * ineligible for an achievement about keeping several habits at once.
 *
 * Called inline from createCheckin after a successful completion. At current
 * scale (≤ a few thousand HABITS users with 1-3 active habits each) the
 * per-checkin cost is tiny — one habit-goal lookup + one count query per
 * goal. If multi-habit users grow into the tens of thousands, move this to a
 * nightly scheduler scanning yesterday's completions; the helper itself
 * already takes an `asOfDate` arg to make that swap easy.
 */
export const scanMultiHabitConsistency = async (
    headers: InternalConfigHeaders,
    userId: string,
    asOfDate: string,
) => {
    if (!userId || !asOfDate) {
        return Promise.resolve(null);
    }
    try {
        const goals = await Store.habitGoals.getByUserId(userId);
        if (!goals || goals.length < 2) {
            // Need at least 2 active habits to credit any consistency_1_2 rung.
            return Promise.resolve(null);
        }

        const startDate = subtractDays(asOfDate, MULTI_HABIT_WINDOW_DAYS - 1);
        const counts = await Promise.all(goals.map((g: any) => Store.habitCheckins
            .getCompletedCountForPeriod(userId, g.id, startDate, asOfDate)
            .catch(() => 0)));

        const simultaneousPerfectCount = counts.filter((count: number, index: number) => {
            // What this habit owed over the window. For a daily habit that is 7 and the rung is
            // unchanged; for "4x per week" it is 4, which is the whole point.
            const required = countScheduledForRange(getCadence(goals[index]), startDate, asOfDate);
            return required > 0 && count >= required;
        }).length;

        if (simultaneousPerfectCount < MULTI_HABIT_LADDER[0]) {
            return Promise.resolve(null);
        }

        // The store's tier-completion logic increments cumulative progressCount.
        // Pass the highest ladder rung the user currently qualifies for; the
        // store will fast-forward through any uncompleted tiers and stop at
        // the matching rung. Idempotent on repeat calls because we only pass
        // the top rung crossed (further calls with the same value are no-ops
        // once that tier is already complete).
        const topRung = MULTI_HABIT_LADDER
            .filter((rung: number) => simultaneousPerfectCount >= rung)
            .reduce((max: number, rung: number) => Math.max(max, rung), 0);
        return awardConsistencyMultiAchievement(headers, topRung);
    } catch (err) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Multi-habit consistency scan failed'],
            traceArgs: { 'error.message': (err as Error)?.message },
        });
        return Promise.resolve(null);
    }
};

/**
 * Build a copy of the request headers with `x-userid` set to a different
 * user, so cross-user achievement awards (e.g. crediting the partner of a
 * pact-mate who hits a longest-streak milestone) attribute to the right
 * recipient. Authorization is intentionally cleared — the requester's JWT
 * does not authenticate the partner, and the achievement notification will
 * skip its push send because of the missing token. The DB row still
 * persists, which is the part that matters for tier progression.
 */
export const headersForOtherUser = (
    headers: InternalConfigHeaders,
    otherUserId: string,
): InternalConfigHeaders => ({
    ...headers,
    'x-userid': otherUserId,
    authorization: undefined,
});

export {
    CLASS_BY_GOAL_TYPE,
    STREAK_MILESTONES_BY_TYPE,
};
