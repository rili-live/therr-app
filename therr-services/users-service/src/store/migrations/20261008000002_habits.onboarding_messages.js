// The once-ever ledger behind the Habits onboarding nurture sequence (#3011,
// handlers/helpers/onboardingNurtureDigest.ts).
//
// Each message in the sequence goes to a user at most once, whichever channel carries it. Pushes
// already dedupe through main.notificationQueue, but that queue is push-only and purges finished
// rows after 30 days, and an email has no queue at all — so the digest claims a row here
// *before* sending, and a second run, a retry, or a manual curl finds the claim and sends
// nothing. A crash between claim and send costs that one message, which is the right way round
// for a nudge.
//
//   messageKey: stable and period-free, e.g. 'onboarding:no-habit',
//               'seat:<pactMemberId>:d3'. Never a clock value (CLAUDE.md § Sibling Repos, rule 4).
//   channel:    push | email — whichever the claim was made for, for measurement.
//
// habits schema (not a main.* brand-scoped table): the sequence only exists for the HABITS app.
// Nothing outside users-service reads it.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('onboarding_messages');
    if (!exists) {
        await knex.schema.withSchema('habits').createTable('onboarding_messages', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.string('messageKey', 120).notNullable();
            table.string('channel', 16).notNullable();
            table.timestamp('sentAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['userId', 'messageKey']);
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('habits').dropTableIfExists('onboarding_messages');
};
