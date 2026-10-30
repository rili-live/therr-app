// Pact chat (docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md).
//
// habits.pact_messages — text a pact member wrote to the pact. Check-ins are NOT copied in here:
// the chat timeline merges completed habits.habit_checkins at read time, so the check-in path
// gains no write and every historical check-in already appears in the thread.
//
//   clientMessageId: optional client-generated id. UNIQUE (userId, clientMessageId) makes a
//   retried send idempotent; NULLs are distinct, so clients that omit it are unaffected.
//   reportedAt / reportedByUserIds: the report path. Rows are kept for moderation.
//
// habits.pact_chat_reactions — at most one reaction per person per timeline item (a message or a
// check-in). `targetId` is polymorphic and so carries no FK; an orphaned reaction is harmless
// because reads join from the page's own item ids. UNIQUE (targetId, userId) is the whole
// "one reaction each" rule — a second emoji replaces the first.
//
// habits.pact_members."chatLastReadAt" — the unread watermark.
//
// habits schema, not a main.* brand-scoped table: like pact_join_requests and challenges, every
// row is reached through a pactId, which already belongs to the HABITS app.
//
// Idempotent per therr/require-idempotent-migration: hasTable probes guard createTable, the column
// is added IF NOT EXISTS, and everything is dropped IF EXISTS on the way down. Every index is
// declared inside its new table's createTable callback, so none is built against a live table.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const hasMessages = await knex.schema.withSchema('habits').hasTable('pact_messages');
    if (!hasMessages) {
        await knex.schema.withSchema('habits').createTable('pact_messages', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('pactId').notNullable()
                .references('id').inTable('habits.pacts')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            table.text('text').notNullable();
            table.uuid('clientMessageId');

            table.timestamp('reportedAt', { useTz: true });
            table.jsonb('reportedByUserIds').notNullable().defaultTo('[]');

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            // The timeline read: one thread, newest first.
            table.index(['pactId', 'createdAt']);
            table.unique(['userId', 'clientMessageId']);
        });
    }

    const hasReactions = await knex.schema.withSchema('habits').hasTable('pact_chat_reactions');
    if (!hasReactions) {
        await knex.schema.withSchema('habits').createTable('pact_chat_reactions', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('pactId').notNullable()
                .references('id').inTable('habits.pacts')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            table.string('targetKind', 16).notNullable(); // message | checkin
            table.uuid('targetId').notNullable();
            table.string('emoji', 16).notNullable();

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['targetId', 'userId']);
            table.index(['pactId']);
        });
    }

    await knex.raw('ALTER TABLE habits."pact_members" ADD COLUMN IF NOT EXISTS "chatLastReadAt" timestamptz');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."pact_members" DROP COLUMN IF EXISTS "chatLastReadAt"');
    await knex.schema.withSchema('habits').dropTableIfExists('pact_chat_reactions');
    await knex.schema.withSchema('habits').dropTableIfExists('pact_messages');
};
