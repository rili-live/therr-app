// Dedicated markers for the onboarding completion-nudge email pass in the
// messaging-automator. Kept separate from latestMarketingEmail (the linear
// intro -> app-feedback -> ... retention pointer) so onboarding nudges run
// as an independent pass without disturbing the retention chain. Nullable:
// only users who receive a nudge get a value written.
exports.up = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.string('latestOnboardingEmail'); // e.g. 'verify-email' | 'complete-profile'
    table.timestamp('latestOnboardingEmailDate', { useTz: true }).nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.dropColumn('latestOnboardingEmail');
    table.dropColumn('latestOnboardingEmailDate');
});
