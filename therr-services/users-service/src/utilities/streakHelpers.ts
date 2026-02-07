/**
 * Streak calculation and milestone utilities for the HABITS app
 */

// Standard milestone thresholds
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

/**
 * Check if a streak count has reached a milestone
 */
export const checkMilestoneReached = (streakCount: number): number | null => {
    // Return the exact milestone if the streak matches one
    if (STREAK_MILESTONES.includes(streakCount)) {
        return streakCount;
    }
    return null;
};

/**
 * Get the next milestone for a given streak count
 */
export const getNextMilestone = (currentStreak: number): number | null => {
    const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > currentStreak);
    return nextMilestone || null;
};

/**
 * Get progress percentage towards next milestone
 */
export const getMilestoneProgress = (currentStreak: number): { nextMilestone: number | null; progress: number } => {
    const nextMilestone = getNextMilestone(currentStreak);
    if (!nextMilestone) {
        return { nextMilestone: null, progress: 100 };
    }

    // Find previous milestone
    const prevMilestoneIndex = STREAK_MILESTONES.findIndex((m) => m > currentStreak) - 1;
    const prevMilestone = prevMilestoneIndex >= 0 ? STREAK_MILESTONES[prevMilestoneIndex] : 0;

    const range = nextMilestone - prevMilestone;
    const progressInRange = currentStreak - prevMilestone;
    const progress = Math.round((progressInRange / range) * 100);

    return { nextMilestone, progress };
};

/**
 * Calculate if a day was missed based on last completed date
 * Takes into account that habits might not be daily (e.g., 3x per week)
 */
export const wasDayMissed = (
    lastCompletedDate: string | null,
    frequencyType: string,
    frequencyCount: number,
    targetDaysOfWeek?: number[],
): boolean => {
    if (!lastCompletedDate) {
        return false; // No history yet, can't have missed
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastCompleted = new Date(lastCompletedDate);
    lastCompleted.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24));

    if (frequencyType === 'daily') {
        // For daily habits, missing means more than 1 day gap
        return daysDiff > 1;
    }

    if (frequencyType === 'weekly' && targetDaysOfWeek?.length) {
        // For specific days of week, check if any target day was missed
        // Build array of days between last completion and today
        const daysBetween = Array.from({ length: daysDiff - 1 }, (_, i) => {
            const checkDate = new Date(lastCompleted);
            checkDate.setDate(checkDate.getDate() + i + 1);
            return checkDate.getDay();
        });

        // Check if any of those days were target days
        return daysBetween.some((dayOfWeek) => targetDaysOfWeek.includes(dayOfWeek));
    }

    if (frequencyType === 'weekly') {
        // X times per week - allow full week flexibility
        // Check if we're in a new week and previous week didn't hit target
        const weeksDiff = Math.floor(daysDiff / 7);
        return weeksDiff > 1;
    }

    // Default: daily logic
    return daysDiff > 1;
};

/**
 * Check if grace period can be used for a missed day
 */
export const canUseGracePeriod = (
    gracePeriodDays: number,
    graceDaysUsed: number,
): boolean => gracePeriodDays > 0 && graceDaysUsed < gracePeriodDays;

/**
 * Format streak for display
 */
export const formatStreakDisplay = (streakCount: number): string => {
    if (streakCount === 0) {
        return 'No streak';
    }
    if (streakCount === 1) {
        return '1 day';
    }
    return `${streakCount} days`;
};

/**
 * Get streak status emoji based on count
 */
export const getStreakEmoji = (streakCount: number): string => {
    if (streakCount >= 365) return '🏆';
    if (streakCount >= 180) return '⭐';
    if (streakCount >= 90) return '💎';
    if (streakCount >= 60) return '🌟';
    if (streakCount >= 30) return '🔥';
    if (streakCount >= 14) return '💪';
    if (streakCount >= 7) return '✨';
    if (streakCount >= 3) return '👍';
    return '🌱';
};

/**
 * Calculate streak risk level (for notifications)
 * Returns: 'safe' | 'at_risk' | 'critical'
 */
export const getStreakRiskLevel = (
    lastCompletedDate: string | null,
    frequencyType: string,
): 'safe' | 'at_risk' | 'critical' => {
    if (!lastCompletedDate) {
        return 'safe';
    }

    const now = new Date();
    const lastCompleted = new Date(lastCompletedDate);
    const hoursSinceCompletion = (now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60);

    if (frequencyType === 'daily') {
        if (hoursSinceCompletion >= 36) return 'critical'; // Less than 12 hours until midnight
        if (hoursSinceCompletion >= 20) return 'at_risk'; // Evening of the next day
        return 'safe';
    }

    // For non-daily habits, use more relaxed thresholds
    if (hoursSinceCompletion >= 144) return 'critical'; // 6 days
    if (hoursSinceCompletion >= 120) return 'at_risk'; // 5 days
    return 'safe';
};

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDateString = (): string => new Date().toISOString().split('T')[0];

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export const getYesterdayDateString = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

/**
 * Check if a date string is today
 */
export const isToday = (dateString: string): boolean => dateString === getTodayDateString();

/**
 * Check if a date string is yesterday
 */
export const isYesterday = (dateString: string): boolean => dateString === getYesterdayDateString();
