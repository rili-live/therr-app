/**
 * Pure helpers for the leaderboard XP system. XP is an append-only activity measure,
 * deliberately separate from the spendable coin balance (settingsTherrCoinTotal) —
 * see the main.userLeaderboardScores migration for the design rationale.
 */

// XP valuations for activity that isn't already valued by an achievement's own `xp` field.
export const LeaderboardXpValues = {
    // Per unit of achievement progress applied (a created post, a new connection, a streak day…)
    activityUnit: 5,
    // Per first completed habit check-in for a given habit + day
    habitCheckin: 10,
    // Multiplied by the streak-day milestone reached (7-day milestone → 35 XP bonus)
    streakMilestoneMultiplier: 5,
};

/**
 * Monday (UTC) of the ISO week containing `date`, as YYYY-MM-DD. All XP earned in a
 * week accrues to this periodStart; boards "reset" simply because a new week writes
 * to a new row.
 */
export const getLeaderboardPeriodStart = (date: Date = new Date()): string => {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() - daysSinceMonday,
    ));
    return monday.toISOString().split('T')[0];
};

/**
 * Exclusive end of the weekly period (the following Monday, UTC) — returned to clients
 * so they can render a "resets in…" countdown without duplicating week math.
 */
export const getLeaderboardPeriodEnd = (periodStart: string): string => {
    const start = new Date(`${periodStart}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 7);
    return start.toISOString().split('T')[0];
};
