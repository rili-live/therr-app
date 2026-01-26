exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    // Timezone & Reminder Preferences
    table.string('settingsTimezone', 50); // e.g., 'America/New_York'
    table.time('settingsPreferredReminderTime'); // Default reminder time
    table.time('settingsQuietHoursStart'); // Don't send notifications before
    table.time('settingsQuietHoursEnd'); // Don't send notifications after

    // HABITS Notification Preferences
    table.boolean('settingsPushHabitReminders').defaultTo(true);
    table.boolean('settingsPushPartnerActivity').defaultTo(true);
    table.boolean('settingsPushStreakAlerts').defaultTo(true);

    // Streak Stats (denormalized for quick profile display)
    table.integer('currentLongestStreak').defaultTo(0);
    table.integer('allTimeLongestStreak').defaultTo(0);
    table.integer('totalHabitsCompleted').defaultTo(0);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('settingsTimezone');
    table.dropColumn('settingsPreferredReminderTime');
    table.dropColumn('settingsQuietHoursStart');
    table.dropColumn('settingsQuietHoursEnd');
    table.dropColumn('settingsPushHabitReminders');
    table.dropColumn('settingsPushPartnerActivity');
    table.dropColumn('settingsPushStreakAlerts');
    table.dropColumn('currentLongestStreak');
    table.dropColumn('allTimeLongestStreak');
    table.dropColumn('totalHabitsCompleted');
});
