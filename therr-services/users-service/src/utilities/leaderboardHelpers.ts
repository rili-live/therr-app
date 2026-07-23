/**
 * Pure helpers for the leaderboard XP system. XP is an append-only activity measure,
 * deliberately separate from the spendable coin balance (settingsTherrCoinTotal) —
 * see the main.userLeaderboardScores migration for the design rationale.
 */

// Weekly-rank thresholds that trigger a celebration (push notification + weeklyChampion
// achievement progress) when crossed from outside. Ordered best-first.
export const LEADERBOARD_RANK_MILESTONES = [1, 3, 10];

// weeklyChampion tier awarded per crossed rank threshold.
export const WEEKLY_CHAMPION_TIER_BY_MILESTONE: { [milestone: number]: string } = {
    10: '1_1',
    3: '1_2',
    1: '1_3',
};

/**
 * Rank thresholds newly crossed by moving from prevRank to newRank (rank 1 = best).
 * A threshold counts only when the user was strictly outside it before, so repeated
 * awards inside the top N never re-trigger a celebration.
 */
export const getCrossedRankMilestones = (prevRank: number, newRank: number): number[] => LEADERBOARD_RANK_MILESTONES
    .filter((threshold) => newRank <= threshold && prevRank > threshold);

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
 * Assigns standard competition ranks (1, 1, 3, 4…) to a points-descending list: tied
 * scores share the better rank and the next distinct score skips ahead.
 *
 * This must match `UserLeaderboardScoresStore.getRankForScore`, which computes
 * "1 + the number of users strictly ahead". Naively using the array index would give
 * two tied leaders ranks 1 and 2 in the list while both are told they are #1 in the
 * sticky current-user row.
 *
 * Only correct for a page that starts at rank 1 (the leaderboard endpoint takes a
 * limit but no offset). Add the page offset here if paging is ever introduced.
 */
export const withCompetitionRanks = <T extends { points: number }>(entries: T[]): (T & { rank: number })[] => {
    let previousPoints: number | null = null;
    let previousRank = 0;

    return entries.map((entry, index) => {
        const rank = previousPoints !== null && entry.points === previousPoints
            ? previousRank
            : index + 1;
        previousPoints = entry.points;
        previousRank = rank;

        return { ...entry, rank };
    });
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
