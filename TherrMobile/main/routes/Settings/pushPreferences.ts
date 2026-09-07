/**
 * Initial state for the HABITS push toggles on ManageNotifications.
 *
 * Kept RN-free so it can be exercised without a renderer, matching
 * `HabitsDashboardPactState` and `checkinDayDetail`.
 *
 * The rule that matters: both columns default to `true` in the schema
 * (`20260126000010_main.users_habits`), and the digest treats **only an explicit
 * `false`** as a mute — see `settingsPushHabitReminders` / `settingsPushStreakAlerts`
 * in users-service `handlers/habitsDigest`. A user who has never opened this screen is
 * therefore opted *in*.
 *
 * So an absent value has to render as On. Rendering it Off would tell the user their
 * reminders are disabled while the reminders keep arriving — and worse, submitting the
 * form would then write the `false` the screen invented and make the lie true. `undefined`
 * is the common case today: until the users-service half of this ships, nothing returns
 * these columns to the client at all.
 */
export interface IHabitsPushPreferences {
    settingsPushHabitReminders: boolean;
    settingsPushStreakAlerts: boolean;
}

const getHabitsPushPreferences = (settings: any): IHabitsPushPreferences => ({
    settingsPushHabitReminders: settings?.settingsPushHabitReminders !== false,
    settingsPushStreakAlerts: settings?.settingsPushStreakAlerts !== false,
});

export default getHabitsPushPreferences;
