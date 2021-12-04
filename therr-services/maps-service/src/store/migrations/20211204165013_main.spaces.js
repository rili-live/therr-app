const createFunctions = async (knex) => {
    await knex.schema.raw(
        `
            CREATE FUNCTION main.no_area_overlaps(id uuid, g geometry)
            RETURNS boolean AS $$
            SELECT NOT EXISTS (
                SELECT 1 from main.spaces
                WHERE main.spaces.id != id
                    AND main.spaces.geom && g
                    AND ST_Relate(main.spaces.geom, g, '2********'));
            $$ LANGUAGE sql
        `,
    );
};

const dropFunctions = async (knex) => {
    await knex.schema.raw('DROP FUNCTION IF EXISTS main.no_area_overlaps(id uuid, g geometry)');
};

exports.up = (knex) => knex.schema.withSchema('main').createTable('spaces', async (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('fromUserId').notNullable();
    table.string('locale', 8);
    table.bool('isPublic').notNullable().defaultTo(false);
    table.text('message').notNullable().defaultsTo('');
    table.string('notificationMsg').notNullable(); // If empty, should default to first x characters of message
    table.text('mediaIds').notNullable().defaultsTo('');
    table.text('mentionsIds').notNullable().defaultsTo(''); // Other connection/user mentions for linking
    table.text('hashTags').notNullable().defaultsTo('');
    table.integer('maxViews').notNullable().defaultsTo(0);
    table.double('latitude', 15).notNullable();
    table.double('longitude', 15).notNullable();
    table.float('radius');
    table.jsonb('polygonCoords').notNullable().defaultsTo(JSON.stringify([]));
    table.float('maxProximity').defaultTo(0.0);
    table.bool('doesRequireProximityToView').notNullable().defaultTo(false);
    table.boolean('isMatureContent').notNullable().defaultTo(false);
    table.bool('isModeratorApproved').notNullable().defaultTo(false);
    table.bool('isForSale').notNullable().defaultTo(false);
    table.bool('isHirable').notNullable().defaultTo(false);
    table.bool('isPromotional').notNullable().defaultTo(false);
    table.bool('isExclusiveToGroups').notNullable().defaultTo(false);
    table.string('category', 50).notNullable().defaultTo('uncategorized');
    table.timestamp('isScheduledAt', { useTz: true });

    // Audit
    table.integer('valuation').notNullable().defaultTo(0);
    table.string('region').notNullable(); // Also used for sharding, db locationing
    table.timestamp('expiresAt', { useTz: true });
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('fromUserId');

    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'spaces', 'geom', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    // await knex.schema.raw(`UPDATE main.spaces SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_spaces_geom ON main.spaces USING gist(geom);`); // eslint-disable-line quotes
}).then(() => createFunctions(knex)).then(async () => {
    await knex.schema.raw('ALTER TABLE main.spaces ADD CONSTRAINT no_overlaps CHECK (main.no_area_overlaps(id, geom))');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('spaces').then(() => dropFunctions(knex));
