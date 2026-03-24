exports.up = async (knex) => {
    // Step 1: Add columns as nullable (safe for existing rows)
    await knex.schema.withSchema('main').alterTable('apiKeys', (table) => {
        table.string('keyPrefix', 8).nullable();
        table.string('name', 128).nullable();
    });

    // Step 2: Backfill any existing rows with unique prefixes derived from their id
    await knex.raw(`
        UPDATE main."apiKeys"
        SET "keyPrefix" = LEFT(REPLACE(id::text, '-', ''), 8)
        WHERE "keyPrefix" IS NULL
    `);

    // Step 3: Add NOT NULL constraint and unique index
    await knex.schema.withSchema('main').alterTable('apiKeys', (table) => {
        table.string('keyPrefix', 8).notNullable().alter();
        table.unique('keyPrefix');
        table.index('keyPrefix');
    });
};

exports.down = (knex) => knex.schema.withSchema('main').alterTable('apiKeys', (table) => {
    table.dropIndex('keyPrefix');
    table.dropUnique(['keyPrefix']);
    table.dropColumn('keyPrefix');
    table.dropColumn('name');
});
