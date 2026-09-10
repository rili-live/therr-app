exports.up = (knex) => knex.schema.withSchema('habits')
    .table('pact_members', (table) => {
        table.timestamp('nudgedAt', { useTz: true }).nullable();
    });

exports.down = (knex) => knex.schema.withSchema('habits')
    .table('pact_members', (table) => {
        table.dropColumn('nudgedAt');
    });
