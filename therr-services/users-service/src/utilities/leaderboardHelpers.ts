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
    // Per unscheduled day, when a habit's weekly quota is met. See `weeklyQuotaBonus`.
    quotaBonusPerUnscheduledDay: 10,
};

/**
 * XP for discharging a habit's weekly quota, awarded once by the check-in that completes it.
 *
 * The board pays per check-in (10) plus per daily-streak day (5), so a daily habit earns ~105 a
 * week and a fully-honoured 4x/week habit earns 60. That gap is structural, not a measure of
 * effort: both users did exactly what they committed to, and only one of them can place. Once
 * habits can declare a cadence, leaving it alone would make the leaderboard a reason not to.
 *
 *     bonus = min((7 - target) * 10, target * 15)
 *
 * The first term pays for the days the cadence did not ask for; the second is what makes it
 * ungameable. Without the cap, declaring a 1x/week habit would pay 60 XP for a single check-in —
 * a far better rate than doing the work. With it:
 *
 *     1x/week →  15 + 15 =  30      4x/week →  60 + 30 =  90
 *     2x/week →  30 + 30 =  60      5x/week →  75 + 20 =  95
 *     3x/week →  45 + 40 =  85      6x/week →  90 + 10 = 100
 *                                   daily   → 105 +  0 = 105
 *
 * Monotonic in effort, no cliff, and daily still leads. A daily habit scores `(7 - 7) * 10 = 0`,
 * so every existing user's XP is untouched.
 */
export const weeklyQuotaBonus = (weeklyTarget: number): number => {
    const target = Math.round(Number(weeklyTarget) || 0);
    if (!Number.isFinite(target) || target < 1 || target >= 7) {
        return 0;
    }
    return Math.min(
        (7 - target) * LeaderboardXpValues.quotaBonusPerUnscheduledDay,
        target * (LeaderboardXpValues.habitCheckin + 5),
    );
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
