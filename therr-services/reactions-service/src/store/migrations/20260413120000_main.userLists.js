exports.up = (knex) => knex.schema.withSchema('main').createTable('userLists', (table) => {
    table.uuid('id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId').notNullable();
    table.string('name', 120).notNullable();
    table.text('description').nullable();
    table.string('iconName').nullable();
    table.string('colorHex', 7).nullable();
    table.boolean('isPublic').notNullable().defaultTo(false);
    table.boolean('isDefault').notNullable().defaultTo(false);
    table.integer('itemCount').notNullable().defaultTo(0);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.primary(['id']);
    table.index(['userId'], 'idx_userlists_userid');
})
    // Case-insensitive uniqueness on (userId, name)
    .then(() => knex.raw('CREATE UNIQUE INDEX idx_userlists_userid_name_lower ON main."userLists" ("userId", LOWER(name))'))
    // At most one default list per user (enforced at the DB level so that
    // races and backfill bugs can't produce two defaults for the same user).
    .then(() => knex.raw('CREATE UNIQUE INDEX idx_userlists_userid_default ON main."userLists" ("userId") WHERE "isDefault" = true'));

exports.down = (knex) => knex.raw('DROP INDEX IF EXISTS main.idx_userlists_userid_default')
    .then(() => knex.raw('DROP INDEX IF EXISTS main.idx_userlists_userid_name_lower'))
    .then(() => knex.schema.withSchema('main').dropTable('userLists'));
