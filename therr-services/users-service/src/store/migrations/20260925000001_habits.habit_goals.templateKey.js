/**
 * Adds a stable, language-neutral key to system template habit goals.
 *
 * Template `name` / `description` are stored as English text, so every Spanish and
 * French-Canadian user saw the picker in English. The mobile app now translates a template
 * from `pages.pacts.templates.<templateKey>` in its own dictionaries and falls back to the
 * stored English when a key is absent — so the stored text remains the source of truth for
 * any client that predates this, and for a template added before its translations ship.
 *
 * Only templates carry a key. A user's own habit is a copy made at pact creation and holds
 * the text the user saw (already localized), so it never needs one — hence nullable, with a
 * partial unique index rather than a NOT NULL constraint.
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_goals" ADD COLUMN IF NOT EXISTS "templateKey" varchar(64)');
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS habit_goals_template_key_unique
        ON habits."habit_goals" ("templateKey")
        WHERE "templateKey" IS NOT NULL
    `);
};

exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits.habit_goals_template_key_unique');
    await knex.raw('ALTER TABLE habits."habit_goals" DROP COLUMN IF EXISTS "templateKey"');
};
