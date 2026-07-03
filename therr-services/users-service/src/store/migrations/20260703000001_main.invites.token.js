// Adds a per-invite opaque token that powers "magic invite links"
// (/invite/:token). The token lets the invite landing page pre-fill the
// invitee's known email/phone and lets registration trust the contact
// channel the token was delivered on (email -> email verified, SMS ->
// phone verified). uuid_generate_v4() is volatile, so existing rows each
// receive a distinct backfilled token, satisfying the unique constraint.
exports.up = (knex) => knex.schema.withSchema('main').alterTable('invites', (table) => {
    table.uuid('token').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.unique(['token']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('invites', (table) => {
    table.dropUnique(['token']);
    table.dropColumn('token');
});
