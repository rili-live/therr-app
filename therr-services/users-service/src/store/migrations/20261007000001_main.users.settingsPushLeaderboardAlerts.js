// Leaderboard race alerts (Settings → Notifications).
//
//   - settingsPushLeaderboardAlerts: boolean, DEFAULT true. The user's switch for the two
//     competitive leaderboard pushes: `leaderboardRankLost` ("Sam just passed you — you're
//     #4") and `leaderboardPodiumWithinReach` (the Sunday-evening "you're 30 XP from #3").
//     It does not cover `leaderboardRankMilestone` — that one celebrates the user's own climb.
//
// Same contract as `settingsPushHabitReminders` / `settingsPushStreakAlerts`
// (20260126000010_main.users_habits.js): nullable, and the producers mute on an explicit
// `false` and nothing else, so every existing row stays opted in without a backfill.
//
// Additive only, so neither automator can break on it. Idempotent
// (ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = (knex) => knex.raw(
    'ALTER TABLE main."users" ADD COLUMN IF NOT EXISTS "settingsPushLeaderboardAlerts" boolean DEFAULT true',
);

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.raw(
    'ALTER TABLE main."users" DROP COLUMN IF EXISTS "settingsPushLeaderboardAlerts"',
);
