/**
 * Adds dwelling tracking to main.userLocations.
 *
 * A "dwelling" is a general location (home, hotel, apartment, extended stay) where a
 * user has been present across multiple distinct calendar days. `visitCount` alone
 * cannot distinguish these from a place visited many times in a single day, because
 * background location pings increment it several times per stay.
 *
 * - distinctDayCount: number of separate calendar days this location has been observed.
 * - lastVisitedAt: used both to increment distinctDayCount at most once per day and to
 *   let stale dwellings (e.g. an old hotel) decay out of the dwelling set.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('userLocations', (table) => {
    table.integer('distinctDayCount').notNullable().defaultTo(1);
    table.timestamp('lastVisitedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['userId', 'distinctDayCount']);
})
    // Backfill: existing rows have no day history, so approximate it as the number of
    // calendar days spanned between the first and last visit, capped by visitCount
    // (a location cannot have been observed on more days than it was observed at all).
    // This keeps long-established homes recognized immediately after deploy instead of
    // requiring users to re-accumulate DWELL_MIN_DISTINCT_DAYS of history.
    .then(() => knex.raw(`
        UPDATE "main"."userLocations"
        SET "lastVisitedAt" = "updatedAt",
            "distinctDayCount" = LEAST(
                "visitCount",
                GREATEST(1, (DATE_PART('day', "updatedAt" - "createdAt"))::int + 1)
            )
    `));

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('userLocations', (table) => {
    table.dropIndex(['userId', 'distinctDayCount']);
    table.dropColumn('distinctDayCount');
    table.dropColumn('lastVisitedAt');
});
