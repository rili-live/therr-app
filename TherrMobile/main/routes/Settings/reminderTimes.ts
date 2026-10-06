/**
 * Options and form state for the habit reminder-time pickers on ManageNotifications.
 *
 * Kept RN-free so it can be exercised without a renderer, like `pushPreferences`.
 *
 * The windows mirror `MORNING_REMINDER_WINDOW` / `EVENING_REMINDER_WINDOW` in users-service
 * `utilities/localReminderSchedule.ts`, which rejects (on save) and ignores (when scheduling)
 * anything outside them. They are chosen so that no pair offered here can fall under the
 * digest's four-hour minimum gap between the two slots and silently cost the user their
 * evening reminder. Change both sides together.
 *
 * The form holds `''` for "Default" because a picker value cannot be null; the payload turns
 * it back into `null`, which is what clears the column and hands the slot back to the
 * digest's default (08:00 / 19:30 local).
 */
export type ReminderSlot = 'morning' | 'evening';

export interface IReminderTimeOption {
    id: string;
    label: string;
    value: string;
}

export interface IReminderTimeInputs {
    settingsPreferredReminderTime: string;
    settingsPreferredEveningReminderTime: string;
}

const STEP_MINUTES = 15;

export const REMINDER_TIME_WINDOWS: Record<ReminderSlot, { earliest: number; latest: number }> = {
    morning: { earliest: 5 * 60, latest: 11 * 60 + 30 },
    evening: { earliest: 16 * 60, latest: 23 * 60 },
};

/** The digest's own targets when the user has not chosen — shown on the "Default" option. */
export const DEFAULT_REMINDER_MINUTES: Record<ReminderSlot, number> = {
    morning: 8 * 60,
    evening: 19 * 60 + 30,
};

export const DEFAULT_REMINDER_OPTION_VALUE = '';

const pad2 = (value: number) => String(value).padStart(2, '0');

const toTimeValue = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

/** 'HH:MM' or Postgres' 'HH:MM:SS' → minutes past midnight, or null. */
const parseTime = (value: unknown): number | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
    if (!match) {
        return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
        return null;
    }
    return hours * 60 + minutes;
};

/**
 * The picker value for a stored time: 'HH:MM', or '' (Default) when unset or outside the
 * window — which is exactly when the digest would ignore it too, so showing "Default" is the
 * truth rather than a guess.
 */
export const toReminderTimeInput = (stored: unknown, slot: ReminderSlot): string => {
    const minutes = parseTime(stored);
    const window = REMINDER_TIME_WINDOWS[slot];
    if (minutes === null || minutes < window.earliest || minutes > window.latest) {
        return DEFAULT_REMINDER_OPTION_VALUE;
    }
    return toTimeValue(minutes);
};

export const getReminderTimeInputs = (settings: any): IReminderTimeInputs => ({
    settingsPreferredReminderTime: toReminderTimeInput(settings?.settingsPreferredReminderTime, 'morning'),
    settingsPreferredEveningReminderTime: toReminderTimeInput(settings?.settingsPreferredEveningReminderTime, 'evening'),
});

/** What the update request sends: the 'HH:MM' choice, or null to go back to the default. */
export const toReminderTimePayload = (inputs: IReminderTimeInputs) => ({
    settingsPreferredReminderTime: inputs.settingsPreferredReminderTime || null,
    settingsPreferredEveningReminderTime: inputs.settingsPreferredEveningReminderTime || null,
});

/**
 * A time of day the way each locale writes it: '7:15 AM' (en-us), '7:15' / '19:30' (es),
 * '7 h 15' / '19 h 30' (fr-ca). Hand-rolled rather than `toLocaleTimeString`, whose output
 * depends on the ICU data Hermes was built with and differs between Android versions.
 */
export const formatReminderTime = (minutes: number, locale: string): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (locale === 'fr-ca') {
        return `${hours} h ${pad2(mins)}`;
    }
    if (locale === 'es') {
        return `${hours}:${pad2(mins)}`;
    }
    const suffix = hours < 12 ? 'AM' : 'PM';
    const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${twelveHour}:${pad2(mins)} ${suffix}`;
};

/**
 * "Default (around 8:00 AM)" first, then every quarter hour in the slot's window.
 * `defaultLabel` receives the formatted default time so the copy can live in the locale files.
 */
export const buildReminderTimeOptions = (
    slot: ReminderSlot,
    locale: string,
    defaultLabel: (formattedDefaultTime: string) => string,
): IReminderTimeOption[] => {
    const window = REMINDER_TIME_WINDOWS[slot];
    const options: IReminderTimeOption[] = [{
        id: `${slot}-default`,
        label: defaultLabel(formatReminderTime(DEFAULT_REMINDER_MINUTES[slot], locale)),
        value: DEFAULT_REMINDER_OPTION_VALUE,
    }];
    for (let minutes = window.earliest; minutes <= window.latest; minutes += STEP_MINUTES) {
        options.push({
            id: `${slot}-${minutes}`,
            label: formatReminderTime(minutes, locale),
            value: toTimeValue(minutes),
        });
    }
    return options;
};
