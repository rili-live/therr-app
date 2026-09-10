/**
 * Add lastLoginAt to main.users.
 *
 * Archetype: Additive, brand-agnostic (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Complements the existing `loginCount` column: `loginCount` answers "how often",
 * `lastLoginAt` answers "how recently". Written by the login handler on every
 * successful authentication.
 *
 * Defaults:
 *   - Nullable with no default. NULL means "has not logged in since this migration
 *     ran" — deliberately distinct from a backfilled timestamp, which would
 *     fabricate login activity that never happened. Consumers must treat NULL as
 *     unknown rather than as an old login.
 *   - timestamptz (knex `timestamp()` maps to `timestamp with time zone` on
 *     Postgres), matching `createdAt`/`updatedAt` on this table.
 *
 * Deploy ordering: this migration MUST run before the users-service image that
 * writes the column. It is additive and nullable, so it is safe to apply while the
 * previous release is still serving — the old code simply never writes it. Deploying
 * the code first makes every login fail with
 * `column "lastLoginAt" of relation "users" does not exist`.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.timestamp('lastLoginAt').nullable().defaultTo(null);
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('lastLoginAt');
});
