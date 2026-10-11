// The ledger behind the daily reward chest (utilities/rewardChest.ts, handlers/rewardChests.ts).
//
// A user who upholds their daily streak is offered one chest per local day on the celebration
// screen. The XP inside is rolled server-side when the chest is opened and written here *before*
// it is awarded, so the UNIQUE (userId, source, sourceKey) constraint is what makes a double tap,
// a retry or a second device harmless: the second insert conflicts, returns nothing, and the
// handler replays the first roll instead of rolling (and paying) again.
//
//   source:    'daily-streak' — the only source today; the seam for chests from other moments
//              (an achievement claim, a pact completion) without a second table.
//   sourceKey: the user's local day for 'daily-streak' (YYYY-MM-DD). Never a clock value
//              (CLAUDE.md § Sibling Repos, rule 4).
//   tier:      standard | boosted — the odds table the roll used (boosted on milestones and
//              perfect weeks).
//   rarity:    common | rare | epic | jackpot — what the roll landed on, for measurement.
//   rewardXp:  the leaderboard XP paid.
//
// habits schema (not a main.* brand-scoped table): chests only exist for the HABITS app.
// brandVariation is recorded because the XP is paid onto that brand's leaderboard. Nothing
// outside users-service reads it.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('reward_chests');
    if (!exists) {
        await knex.schema.withSchema('habits').createTable('reward_chests', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.string('brandVariation', 32).notNullable().defaultTo('habits');
            table.string('source', 32).notNullable();
            table.string('sourceKey', 64).notNullable();
            table.string('tier', 16).notNullable();
            table.string('rarity', 16).notNullable();
            table.integer('rewardXp').notNullable();
            table.timestamp('openedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['userId', 'source', 'sourceKey']);
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('habits').dropTableIfExists('reward_chests');
};
