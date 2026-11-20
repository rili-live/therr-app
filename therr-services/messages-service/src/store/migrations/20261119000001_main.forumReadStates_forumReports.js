// Groups: unread state and member reports (issue #3230).
//
// main.forumReadStates — one row per (user, forum): the user's unread watermark in that group's
// chat. Messages newer than `lastReadAt` by someone else are unread. Moved forward only, never
// backwards (ForumReadStatesStore.markRead), so a stale device cannot un-read. A member with no
// row yet falls back to a fixed watermark in code (FORUM_READ_TRACKING_STARTED_AT), so the day this
// ships does not light up every group with its whole history as unread.
//
// main.forumReports — one row per (forum, reporting user). Distinct reporters, not report count:
// UNIQUE (forumId, reportedByUserId) means one person cannot hide a group by tapping Report
// repeatedly. A group with enough reporters drops out of Discover pending review; a reviewer
// restores it by deleting its rows here, or removes it by archiving the forum.
//
// Not brand-scoped tables (not in eslint-config/brand-scoped-tables.js): like
// main.forumCategories, every row is reached through a forumId, and main.forums already carries
// the brand. Every query pins forumId. Keeping them off that list also keeps them out of
// therr-messaging-automator's mirrored list, which no sibling repo needs: neither automator reads
// group read state or reports.
//
// No FK to main.users: users live in users-service's database, not this one. Account deletion
// clears both tables explicitly (handlers/deleteUserData.ts).
//
// Idempotent per therr/require-idempotent-migration: hasTable probes guard createTable and both
// tables are dropped IF EXISTS on the way down. Every index is declared inside its new table's
// createTable callback, so none is built against a live table.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const hasReadStates = await knex.schema.withSchema('main').hasTable('forumReadStates');
    if (!hasReadStates) {
        await knex.schema.withSchema('main').createTable('forumReadStates', (table) => {
            table.uuid('forumId').notNullable()
                .references('id').inTable('main.forums')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('userId').notNullable();
            table.timestamp('lastReadAt', { useTz: true }).notNullable();

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            // The read: "my watermarks for these forums". userId leads; the unique index serves
            // both the lookup and the upsert's ON CONFLICT target.
            table.primary(['userId', 'forumId']);
        });
    }

    const hasReports = await knex.schema.withSchema('main').hasTable('forumReports');
    if (!hasReports) {
        await knex.schema.withSchema('main').createTable('forumReports', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('forumId').notNullable()
                .references('id').inTable('main.forums')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('reportedByUserId').notNullable();
            table.string('reason', 32);

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            // Leads on forumId: Discover counts reporters per forum.
            table.unique(['forumId', 'reportedByUserId']);
            // "Groups this viewer reported", to hide them from that viewer's Discover at once.
            table.index(['reportedByUserId']);
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('main').dropTableIfExists('forumReports');
    await knex.schema.withSchema('main').dropTableIfExists('forumReadStates');
};
