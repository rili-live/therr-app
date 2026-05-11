// Archetype: Identity-shared
//
// Stores crowdsourced edits to business info on main.spaces. Submissions
// (authenticated or anonymous) accumulate as "pending" rows; when N distinct
// identities agree on the same normalizedValue for the same (spaceId,
// fieldName), the handler applies the value to main.spaces and flips matching
// rows to "applied" / non-matching pending rows to "superseded". Owner-claimed
// spaces never auto-apply: their rows just accumulate for a future owner
// suggestions UI.
//
// Identity is either userId (authed) or submitterIdentityHash
// (sha256(SALT + ip + ':' + anon-session-id) for anonymous web users). Exactly
// one of the two is non-null per row, enforced by a CHECK constraint.

exports.up = (knex) => knex.schema.withSchema('main').createTable('spaceCorrections', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('spaceId').notNullable().references('id').inTable('main.spaces')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('userId').nullable();
    table.text('submitterIdentityHash').nullable();
    table.text('fieldName').notNullable();
    table.jsonb('submittedValue').notNullable();
    table.text('normalizedValue').notNullable();
    table.text('status').notNullable().defaultTo('pending');
    table.text('userAgent').nullable();
    table.timestamp('appliedAt', { useTz: true }).nullable();
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['spaceId', 'fieldName', 'status']);
}).then(() => knex.raw(`
    CREATE INDEX idx_space_corrections_agreement
    ON main."spaceCorrections" ("spaceId", "fieldName", "normalizedValue", "status")
`)).then(() => knex.raw(`
    CREATE UNIQUE INDEX idx_space_corrections_unique_user
    ON main."spaceCorrections" ("spaceId", "fieldName", "userId")
    WHERE "userId" IS NOT NULL
`)).then(() => knex.raw(`
    CREATE UNIQUE INDEX idx_space_corrections_unique_anon
    ON main."spaceCorrections" ("spaceId", "fieldName", "submitterIdentityHash")
    WHERE "submitterIdentityHash" IS NOT NULL
`)).then(() => knex.raw(`
    ALTER TABLE main."spaceCorrections"
    ADD CONSTRAINT chk_space_corrections_one_identity
    CHECK (("userId" IS NOT NULL) <> ("submitterIdentityHash" IS NOT NULL))
`)).then(() => knex.raw(`
    ALTER TABLE main."spaceCorrections"
    ADD CONSTRAINT chk_space_corrections_field_name
    CHECK ("fieldName" IN ('phoneNumber', 'websiteUrl', 'openingHours'))
`)).then(() => knex.raw(`
    ALTER TABLE main."spaceCorrections"
    ADD CONSTRAINT chk_space_corrections_status
    CHECK ("status" IN ('pending', 'applied', 'superseded', 'rejected', 'expired'))
`));

exports.down = (knex) => knex.schema.withSchema('main').dropTableIfExists('spaceCorrections');
