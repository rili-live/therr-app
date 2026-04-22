exports.up = (knex) => knex.schema.withSchema('main').createTable('cityWikiCache', (table) => {
    // (slug, locale) composite primary key
    table.string('slug', 120).notNullable();
    table.string('locale', 10).notNullable();

    // Resolved Wikipedia title used for subsequent fetches
    table.string('resolvedTitle', 200);

    // Editorial content
    table.text('summary');
    table.jsonb('sections'); // { understand, districts, getIn, getAround }

    // Lead image
    table.text('heroImageUrl');

    // Attribution (CC-BY-SA compliance)
    table.string('attributionUrl', 500);
    table.string('license', 40).defaultTo('CC-BY-SA-4.0');

    // Fallback indicator when we served English content for a non-en locale request
    table.boolean('localeFallback').notNullable().defaultTo(false);

    // Status flag — lets us remember "nothing found" and avoid hammering Wikipedia on every request
    table.string('status', 20).notNullable().defaultTo('ok'); // 'ok' | 'not_found' | 'error'

    // Lifecycle
    table.timestamp('fetchedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('expiresAt', { useTz: true });

    // Indexes
    table.primary(['slug', 'locale']);
    table.index('expiresAt');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('cityWikiCache');
