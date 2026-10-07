import getHabitsPushPreferences from '../../main/routes/Settings/pushPreferences';

/**
 * The asymmetry these pin is the whole point of the helper: the digest mutes on an
 * explicit `false` and on nothing else, so anything that is not `false` must show as On.
 *
 * Getting this backwards is not a cosmetic bug. The screen would report reminders as
 * disabled while they kept arriving, and the next save would write the `false` it
 * invented — turning a display bug into a real, silent opt-out the user never chose.
 */
describe('getHabitsPushPreferences', () => {
    it('treats an explicit false as muted', () => {
        expect(getHabitsPushPreferences({
            settingsPushHabitReminders: false,
            settingsPushStreakAlerts: false,
            settingsPushLeaderboardAlerts: false,
        })).toEqual({
            settingsPushHabitReminders: false,
            settingsPushStreakAlerts: false,
            settingsPushLeaderboardAlerts: false,
        });
    });

    it('treats an explicit true as enabled', () => {
        expect(getHabitsPushPreferences({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: true,
            settingsPushLeaderboardAlerts: true,
        })).toEqual({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: true,
            settingsPushLeaderboardAlerts: true,
        });
    });

    // The common case until the users-service half ships: nothing returns these columns,
    // so both arrive undefined on every load.
    it('treats an absent value as enabled, matching the schema default', () => {
        expect(getHabitsPushPreferences({})).toEqual({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: true,
            settingsPushLeaderboardAlerts: true,
        });
    });

    it('treats a missing settings object as enabled rather than throwing', () => {
        expect(getHabitsPushPreferences(undefined)).toEqual({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: true,
            settingsPushLeaderboardAlerts: true,
        });
    });

    // null is what a column that exists but was never written comes back as.
    it('treats null as enabled', () => {
        expect(getHabitsPushPreferences({
            settingsPushHabitReminders: null,
            settingsPushStreakAlerts: null,
            settingsPushLeaderboardAlerts: null,
        })).toEqual({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: true,
            settingsPushLeaderboardAlerts: true,
        });
    });

    it('mutes each toggle independently', () => {
        expect(getHabitsPushPreferences({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: false,
            settingsPushLeaderboardAlerts: false,
        })).toEqual({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: false,
            settingsPushLeaderboardAlerts: false,
        });
    });
    it('mutes leaderboard alerts without touching the habit reminders', () => {
        expect(getHabitsPushPreferences({ settingsPushLeaderboardAlerts: false })).toEqual({
            settingsPushHabitReminders: true,
            settingsPushStreakAlerts: true,
            settingsPushLeaderboardAlerts: false,
        });
    });
});
