// The ledger behind the daily bonus (utilities/dailyBonus.ts, handlers/helpers/dailyBonus.ts).
//
// The first completed check-in of a local day pays a random XP bonus on top of the check-in.
// It is rolled and paid on the server at check-in time, so the user has it whether or not they
// watch the celebration that shows it off (the chameleon catching the rock is purely the
// reveal). The roll is written here *before* it is paid, and the UNIQUE
// (userId, source, sourceKey) constraint is what makes a retry, a deleted-and-redone check-in
// or a second device harmless: the second insert conflicts, returns nothing, and pays nothing.
//
//   source:    'daily-streak' — the only source today; the seam for bonuses on other moments
//              (an achievement, a pact completion) without a second table.
//   sourceKey: the user's local day for 'daily-streak' (YYYY-MM-DD). Never a clock value
//              (CLAUDE.md § Sibling Repos, rule 4).
//   tier:      standard | boosted — the odds table the roll used (boosted on streak milestones
//              and perfect weeks).
//   rarity:    common | rare | epic | jackpot — what the roll landed on; drives the size of the
//              reveal and is kept for measurement.
//   bonusXp:   the leaderboard XP paid.
//
// habits schema (not a main.* brand-scoped table): the bonus only exists for the HABITS app.
// brandVariation is recorded because the XP is paid onto that brand's leaderboard. Nothing
// outside users-service reads it.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('daily_bonuses');
    if (!exists) {
        await knex.schema.withSchema('habits').createTable('daily_bonuses', (table) => {
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
            table.integer('bonusXp').notNullable();
            table.timestamp('awardedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['userId', 'source', 'sourceKey']);
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('habits').dropTableIfExists('daily_bonuses');
};
