// A request from a user outside a pact to join it. Only open pacts (habits.pacts.isOpen) accept
// them, and only the pact's creator answers them.
//
// Why a table of its own rather than a `requested` status on habits.pact_members: membership is
// read in a dozen places (the pact list, check-in crediting, the digest, the habit list, the
// free-tier cap), each with its own status predicate, and a stranger's unanswered request must
// count in none of them. Keeping requests out of pact_members makes that true by construction
// instead of by remembering one more status in every query. An approved request becomes an
// ordinary `active` member row, and from there nothing distinguishes it.
//
//   status: pending | approved | declined | cancelled
//
// The partial unique index allows one *pending* request per (pact, requester): a second tap is
// idempotent, and a declined requester is not locked out forever by their old row.
//
// habits schema (not a main.* brand-scoped table): every row is reached through a pactId, which
// is already scoped to the HABITS app.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable, and the
// index is created IF NOT EXISTS outside the builder.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('pact_join_requests');
    if (!exists) {
        await knex.schema.withSchema('habits').createTable('pact_join_requests', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('pactId').notNullable()
                .references('id').inTable('habits.pacts')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('requesterUserId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            table.string('status', 20).notNullable().defaultTo('pending');
            table.timestamp('respondedAt', { useTz: true });

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            // The creator's read: "pending requests on this pact".
            table.index(['pactId', 'status']);
            // The requester's read: "which pacts have I already asked to join".
            table.index(['requesterUserId', 'status']);
        });
    }

    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS pact_join_requests_one_pending
        ON habits."pact_join_requests" ("pactId", "requesterUserId")
        WHERE "status" = 'pending'
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('pact_join_requests');
