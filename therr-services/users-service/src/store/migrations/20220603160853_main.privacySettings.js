// Enums list: everyone, me, connections, friends-of-friends, groups

exports.up = (knex) => knex.schema.withSchema('main').createTable('privacySettings', (table) => {
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');

    // Profile settings
    table.jsonb('allowProfileMediaViewFrom').notNullable().defaultTo(JSON.stringify(['everyone']));
    table.jsonb('allowProfileMapViewFrom').notNullable().defaultTo(JSON.stringify(['everyone']));
    table.jsonb('allowProfileStoryViewFrom').notNullable().defaultTo(JSON.stringify(['everyone']));
    table.jsonb('allowCommentingFrom').notNullable().defaultTo(JSON.stringify(['everyone']));
    table.jsonb('allowMessagingFrom').notNullable().defaultTo(JSON.stringify(['everyone']));
    table.boolean('isFirstNamePublic').notNullable().defaultTo(false);
    table.boolean('isLastNamePublic').notNullable().defaultTo(false);
    table.boolean('isEmailPublic').notNullable().defaultTo(false);
    table.boolean('isPhoneNumberPublic').notNullable().defaultTo(false);
    table.boolean('isProfileMediaCommentsPublic').notNullable().defaultTo(true);
    table.boolean('isConnectionCountPublic').notNullable().defaultTo(true);
    table.boolean('isConnectionListPublic').notNullable().defaultTo(true);
    table.string('showActivityTo').notNullable().defaultTo(JSON.stringify(['me']));

    // Global Visibility settings
    table.string('allowCollaborationsFrom').notNullable().defaultTo('everyone');
    table.string('allowTaggingMeFrom').notNullable().defaultTo('everyone');
    table.string('allowTagsOnPostsFrom').notNullable().defaultTo('everyone');
    table.boolean('isSocialSyncPublic').notNullable().defaultTo(true);
    table.string('showPresenceTo').notNullable().defaultTo('everyone');

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['userId']);
});

exports.down = (knex) => knex.schema.dropTable('main.privacySettings');
