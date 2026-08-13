// Add email-delivery tracking to habits.habit_phases.
//
// WHY SEPARATE COLUMNS FROM THE PUSH SIDE
//
// `maintenanceStage` and `lastComebackAt` record what the *push* path delivered.
// The long-form emails are sent by a different process, in a different repo, on
// a different schedule (therr-messaging-automator's `habits-milestone-emails`
// task — see docs/HABIT_LIFECYCLE_MESSAGING.md § "Where each message lives").
//
// Reusing the push columns as the email watermark would mean whichever ran first
// suppressed the other: the digest advancing `maintenanceStage` to 30 would make
// the 30-day email look already-sent, and the user would get the tap on the
// shoulder but never the version with their actual numbers in it. Two channels,
// two watermarks.
//
// This is also what makes the email pass idempotent without a queue behind it.
// The automator is stateless and has no `main.notificationQueue` equivalent for
// SES, so "have we already emailed this stage?" has to be a fact in the
// database. Selecting on `maintenanceStage > maintenanceEmailedStage` and
// advancing only after a successful send gives the email path the same
// persistence-follows-delivery property the push path gets from the queue's
// unique constraint: a crashed run re-sends, a completed run does not.
//
// Both are written by therr-messaging-automator over a direct Knex connection,
// matching the existing cross-repo pattern documented in
// docs/CROSS_REPO_INTEGRATION.md. Renaming or dropping either column breaks that
// Cloud Function at its next scheduler firing, with no alert — grep the
// automator's src/store/ before touching them.
//
// Idempotent (ADD COLUMN IF NOT EXISTS via raw, DROP COLUMN IF EXISTS) per
// therr/require-idempotent-migration. Raw rather than an alterTable builder
// callback because the builder has no IF NOT EXISTS form.

const TABLE = 'habits.habit_phases';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    // Defaults to 0, matching `maintenanceStage`, so pre-existing rows are
    // treated as "no maintenance email sent yet" rather than as fully caught up.
    await knex.raw(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "maintenanceEmailedStage" INTEGER NOT NULL DEFAULT 0`);
    await knex.raw(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "lastComebackEmailedAt" DATE`);

    // The trailing-window consistency the digest computed on its last pass,
    // 0-100. Denormalized on purpose: the email needs this number, and the
    // alternative is the automator recomputing it from habits.habit_checkins
    // with its own copy of the window length and the age-capped denominator.
    // Two repos deriving "consistency" independently is how the push comes to
    // say 92% and the email 85% for the same user on the same day, with no test
    // anywhere able to see the disagreement. One writer, one number.
    await knex.raw(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "lastConsistencyPercent" INTEGER NOT NULL DEFAULT 0`);

    // Serves the automator's "which rows owe an email?" sweep. Partial on the
    // two phases that can owe one at all: a `forming` habit never does, and
    // those are the bulk of the table.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "habit_phases_email_sweep_idx"
         ON ${TABLE} ("phase", "maintenanceStage", "maintenanceEmailedStage")
         WHERE "phase" IN ('established', 'maintaining', 'lapsed')`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."habit_phases_email_sweep_idx"');
    await knex.raw(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS "maintenanceEmailedStage"`);
    await knex.raw(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS "lastComebackEmailedAt"`);
    await knex.raw(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS "lastConsistencyPercent"`);
};
