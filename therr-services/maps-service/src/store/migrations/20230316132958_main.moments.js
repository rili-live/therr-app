// DELIBERATELY PRESERVED AS-IS — this migration has never done what it appears to do, and making
// it do so here would be wrong. Do not "repair" it inline.
//
// It was originally written as an `async` alterTable callback whose first statement was
// `await table.dropForeign('spaceid')`. Knex invokes that callback synchronously while collecting
// the DDL, so only the statements before the first `await` were ever emitted: the dropForeign
// landed, and the spaceId foreign-key re-add that followed it resumed a microtask later — after
// toSQL() had already run — and was silently discarded.
//
// So the real, shipped effect of this migration is "drop the spaceId foreign key", full stop.
// Verified against a database replayed from scratch: main.moments has zero foreign-key
// constraints. Production ran this same code, so production has no such constraint either.
//
// Re-adding the FK here would give freshly-built databases (CI, local dev) a constraint that
// production lacks, which is exactly the divergence this file must not introduce. If the
// constraint is actually wanted, it needs a NEW forward migration, and that migration has to
// reckon with orphaned moments.spaceId values that have accumulated in the years since — adding
// the constraint will fail outright if any exist. Tracked in docs/WORK_IN_PROGRESS.md.
exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropForeign('spaceid');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    // await table.dropForeign('spaceid');
    table.uuid('spaceId')
        .alter()
        .references('id')
        .inTable('main.spaces')
        .onDelete('NO ACTION');
});
