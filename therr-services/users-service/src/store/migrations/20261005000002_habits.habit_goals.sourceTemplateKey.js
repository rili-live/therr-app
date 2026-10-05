// Which template a user's habit was cloned from — what "the same habit" means across users.
//
// The pact wizard clones a template into a goal row owned by the user (per-user stats must not
// share rows), and the clone carries the *localized* text the user saw. So two people who both
// picked "Read" hold two different goal ids, and one of them may be named "Leer". Nothing linked
// a clone back to its template, which left open-pact matching with nothing to match on but the
// name. `sourceTemplateKey` is that link: the template's language-neutral `templateKey`, copied
// onto the clone at create time (see handlers/habitGoals.ts § createHabitGoal).
//
// Nullable: custom habits have no template, and are matched on their normalized name instead.
// Not unique — many clones share one template — and deliberately a separate column from
// `templateKey`, whose partial unique index marks the template row itself.
//
// Backfill: existing clones are linked where their name still equals the template's stored
// (English) name, case-insensitively. Clones made in another language stay null and fall back to
// name matching, which is exactly what they had before. A no-op on re-run: it only touches rows
// whose key is still null.
//
// Additive only. Idempotent per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_goals" ADD COLUMN IF NOT EXISTS "sourceTemplateKey" varchar(64)');
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_habit_goals_source_template_key
        ON habits."habit_goals" ("sourceTemplateKey")
        WHERE "sourceTemplateKey" IS NOT NULL
    `);
    await knex.raw(`
        UPDATE habits."habit_goals" AS clone
        SET "sourceTemplateKey" = template."templateKey"
        FROM habits."habit_goals" AS template
        WHERE template."isTemplate" = true
          AND template."templateKey" IS NOT NULL
          AND clone."isTemplate" = false
          AND clone."sourceTemplateKey" IS NULL
          AND LOWER(TRIM(clone."name")) = LOWER(TRIM(template."name"))
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits.idx_habit_goals_source_template_key');
    await knex.raw('ALTER TABLE habits."habit_goals" DROP COLUMN IF EXISTS "sourceTemplateKey"');
};
