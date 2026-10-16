/**
 * Re-activate per-habit streaks that abandoning a pact switched off.
 *
 * Archetype: Data backfill on a habits.* table (docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * ## What happened
 *
 * Until fa095ea7b, `abandonPact` called `StreaksStore.deactivate` on every streak row linked
 * to the pact — the partner's included. `habits.streaks` is one row per (userId, habitGoalId)
 * that carries across pacts, and nothing ever set `isActive` back, so the partner (who did
 * nothing) and the abandoner (who only ended a pact, not the habit) both lost, for that habit:
 * its freezes from their daily streak (`dailyStreak.ts`), its /streaks/active entry, and the
 * digest's at-risk warning. `deactivate` had no other caller, so every `isActive = false` row
 * came from that path.
 *
 * fa095ea7b stopped the deactivation, and `incrementStreak` now sets the row active again on
 * the next credited check-in. This repairs the rows already off, for the users who need it
 * before their next check-in.
 *
 * ## Why only recent streaks
 *
 * A streak's `currentStreak` is only reset by the next check-in's gap check, so a row whose
 * last completion was weeks ago still holds that old run's count. Switching those back on
 * would hand the digest a long-dead "12-day streak" to warn about. Fourteen days covers every
 * cadence's longest legitimate gap (a weekly quota judged a closed week late) plus freezes;
 * anything older is a run that is over, and the next credited check-in re-activates it anyway.
 *
 * Idempotent: the `isActive = false` predicate excludes every row a first run updated.
 */
exports.up = (knex) => knex.raw(`
    UPDATE habits."streaks"
    SET "isActive" = true, "updatedAt" = now()
    WHERE "isActive" = false
        AND "lastCompletedDate" >= CURRENT_DATE - 14
`);

/**
 * Data-only backfill. Not reversible: nothing records which rows this touched, and the state
 * it undid was the bug.
 */
exports.down = () => Promise.resolve();
