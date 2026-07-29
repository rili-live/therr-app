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
    // Backfill: approximate day history as the calendar days spanned between the first
    // and last visit, capped by visitCount (a location cannot have been observed on more
    // days than it was observed at all).
    //
    // NOTE: this recovers almost nothing in practice, and that is expected. Before this
    // migration the create/on-conflict merge only bumped `visitCount` — `updatedAt` was
    // left at its insert value — so for nearly every existing row updatedAt = createdAt,
    // the span is 0, and distinctDayCount lands on 1. Legacy dwellings therefore have to
    // re-accumulate DWELL_MIN_DISTINCT_DAYS of history after deploy (roughly three days
    // of presence), except where the user explicitly set isDeclaredHome, which bypasses
    // the day count entirely. The backfill is kept because it is correct for the rows
    // that did get an updatedAt bump via the update handler, and because seeding
    // lastVisitedAt from updatedAt makes the first post-deploy ping count as a new day.
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
