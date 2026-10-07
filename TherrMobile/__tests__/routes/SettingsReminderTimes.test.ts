import {
    buildReminderTimeOptions,
    formatReminderTime,
    getReminderTimeInputs,
    REMINDER_TIME_WINDOWS,
    toReminderTimePayload,
} from '../../main/routes/Settings/reminderTimes';

/**
 * The reminder-time pickers on ManageNotifications.
 *
 * What these pin is the contract with users-service: every option offered is a time
 * its handler accepts (anything else is a 400 and a failed save), "Default" travels as
 * `null` (the only value that clears a previous choice), and a stored value the digest
 * would ignore is shown as "Default" rather than as a time that will not be honoured.
 */
describe('reminderTimes', () => {
    const defaultLabel = (time: string) => `Default (around ${time})`;

    it('offers "Default" first, then every quarter hour inside each window', () => {
        const morning = buildReminderTimeOptions('morning', 'en-us', defaultLabel);
        expect(morning[0]).toEqual({ id: 'morning-default', label: 'Default (around 8:00 AM)', value: '' });
        expect(morning[1].value).toBe('05:00');
        expect(morning[morning.length - 1].value).toBe('11:30');

        const evening = buildReminderTimeOptions('evening', 'en-us', defaultLabel);
        expect(evening[0].label).toBe('Default (around 7:30 PM)');
        expect(evening[1].value).toBe('16:00');
        expect(evening[evening.length - 1].value).toBe('23:00');
        // Quarter-hour steps, nothing outside the window the server enforces.
        evening.slice(1).forEach((option) => {
            const [hours, minutes] = option.value.split(':').map(Number);
            const total = hours * 60 + minutes;
            expect(minutes % 15).toBe(0);
            expect(total).toBeGreaterThanOrEqual(REMINDER_TIME_WINDOWS.evening.earliest);
            expect(total).toBeLessThanOrEqual(REMINDER_TIME_WINDOWS.evening.latest);
        });
    });

    it('keeps the latest morning and earliest evening choice four hours apart, jitter included', () => {
        // The digest drops the evening slot when the two are under four hours apart.
        // No pair the screen offers may ever cost the user their evening reminder.
        const gap = (REMINDER_TIME_WINDOWS.evening.earliest - 15) - (REMINDER_TIME_WINDOWS.morning.latest + 15);
        expect(gap).toBeGreaterThanOrEqual(4 * 60);
    });

    it('reads the stored Postgres time, and shows anything the digest would ignore as Default', () => {
        expect(getReminderTimeInputs({
            settingsPreferredReminderTime: '07:15:00',
            settingsPreferredEveningReminderTime: '21:30:00',
        })).toEqual({
            settingsPreferredReminderTime: '07:15',
            settingsPreferredEveningReminderTime: '21:30',
        });
        expect(getReminderTimeInputs({
            settingsPreferredReminderTime: '03:00:00',
            settingsPreferredEveningReminderTime: null,
        })).toEqual({
            settingsPreferredReminderTime: '',
            settingsPreferredEveningReminderTime: '',
        });
        expect(getReminderTimeInputs(undefined)).toEqual({
            settingsPreferredReminderTime: '',
            settingsPreferredEveningReminderTime: '',
        });
    });

    it('sends Default as null so a previous choice is cleared', () => {
        expect(toReminderTimePayload({
            settingsPreferredReminderTime: '',
            settingsPreferredEveningReminderTime: '20:45',
        })).toEqual({
            settingsPreferredReminderTime: null,
            settingsPreferredEveningReminderTime: '20:45',
        });
    });

    it('writes times the way each locale does', () => {
        expect(formatReminderTime(7 * 60, 'en-us')).toBe('7:00 AM');
        expect(formatReminderTime(12 * 60 + 15, 'en-us')).toBe('12:15 PM');
        expect(formatReminderTime(21 * 60 + 30, 'en-us')).toBe('9:30 PM');
        expect(formatReminderTime(21 * 60 + 30, 'es')).toBe('21:30');
        expect(formatReminderTime(21 * 60 + 30, 'fr-ca')).toBe('21 h 30');
    });
});
