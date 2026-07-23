// Tracks automated reminder sends for invited contacts who have not yet
// created any account. The messaging-automator's pending-invite reminder
// pass reads main.invites (isAccepted=false) and uses these columns to cap
// the number of reminders and space them out.
exports.up = (knex) => knex.schema.withSchema('main').alterTable('invites', (table) => {
    table.integer('reminderCount').notNullable().defaultTo(0);
    table.timestamp('lastRemindedAt', { useTz: true }).nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('invites', (table) => {
    table.dropColumn('reminderCount');
    table.dropColumn('lastRemindedAt');
});
