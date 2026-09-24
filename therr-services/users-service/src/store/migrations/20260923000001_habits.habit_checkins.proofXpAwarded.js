// How much leaderboard XP a check-in's proof (note and/or photo) has already been paid.
//
// A completed check-in with proof earns bonus XP on top of the base check-in XP — see
// `checkinProofXp` in utilities/leaderboardHelpers.ts. Proof almost always arrives after the
// check-in itself: the one-tap check-in writes the row, then the "add a note or photo" screen
// re-POSTs the same (userId, habitGoalId, scheduledDate) row, possibly more than once. So the
// bonus cannot be awarded "on first completion" like the base XP, and it cannot be awarded on
// every save either, or removing and re-adding a photo would pay each time.
//
// This column is the high-water mark: `HabitCheckinsStore.claimProofXp` raises it to the
// check-in's current proof value and pays only the difference. It never goes down.
//
//   - proofXpAwarded: smallint NOT NULL DEFAULT 0. The maximum is 15 (note + photo).
//
// Existing rows are backfilled to the value their proof is already worth, so a check-in logged
// with a note or photo before this shipped does not pay out when it is next edited. Rows
// without proof keep 0 and are not touched. The backfill only raises values, so re-running it
// is a no-op.
//
// Idempotent (ADD COLUMN IF NOT EXISTS, and a backfill guarded on the current value) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_checkins" ADD COLUMN IF NOT EXISTS "proofXpAwarded" smallint NOT NULL DEFAULT 0');
    await knex.raw(`UPDATE habits."habit_checkins" AS c
        SET "proofXpAwarded" = v.xp
        FROM (
            SELECT id,
                (CASE WHEN char_length(btrim(COALESCE(notes, ''))) >= 10 THEN 5 ELSE 0 END)
                    + (CASE WHEN "hasProof" THEN 10 ELSE 0 END) AS xp
            FROM habits."habit_checkins"
            WHERE status = 'completed'
                AND ("hasProof" = true OR notes IS NOT NULL)
        ) AS v
        WHERE c.id = v.id
            AND c."proofXpAwarded" < v.xp`);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_checkins" DROP COLUMN IF EXISTS "proofXpAwarded"');
};
