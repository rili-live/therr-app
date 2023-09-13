exports.up = (knex) => knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .then(() => knex.schema.raw('CREATE SCHEMA IF NOT EXISTS "main";'))
    .then(() => knex.schema.withSchema('main').createTable('users', (table) => {
        table.uuid('id').primary().notNullable()
            .defaultTo(knex.raw('uuid_generate_v4()'));
        table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.default']));
        table.string('userName').nullable();
        table.string('email').unique().notNullable();
        table.string('firstName');
        table.string('lastName');
        table.string('password').notNullable();
        table.string('phoneNumber', 24).nullable();
        table.string('oneTimePassword');
        table.jsonb('verificationCodes').defaultTo(JSON.stringify({ email: {}, mobile: {} }));
        table.varchar('deviceMobileFirebaseToken').notNullable().defaultsTo('');
        table.text('userAdministratorForumIds').notNullable().defaultsTo('');
        table.text('userInvitedForumIds').notNullable().defaultsTo('');
        table.text('userRecentForumIds').notNullable().defaultsTo('');
        table.bool('isBusinessAccount').nullable().defaultsTo(false);
        table.bool('shouldHideMatureContent').nullable().defaultsTo(true);

        // Audit
        table.integer('loginCount').notNullable().defaultsTo(0);
        table.bool('isBlocked').nullable().defaultsTo(false);
        table.jsonb('blockedUsers').defaultTo(JSON.stringify([]));
        table.bool('hasAgreedToTerms').nullable().defaultsTo(false);
        table.jsonb('wasReportedBy').defaultTo(JSON.stringify([]));
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // Indexes
        table.index('email').index('userName');
    }));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('users');
