/**
 * The device's IANA timezone, e.g. 'America/New_York'.
 *
 * Reported to the server on push registration (`Layout.registerDeviceForFCM`)
 * and stored on `main.users.settingsTimezone`, which is the only input to
 * per-user reminder scheduling in users-service
 * (`utilities/localReminderSchedule.ts`). Until it was written, every scheduled
 * notification fired at one global hour: the habits digest's single Cloud
 * Scheduler firing, which is evening in America/Chicago and 02:00 in Auckland.
 *
 * Returns null rather than a guess when the platform cannot answer. A wrong
 * timezone is worse than none — the server falls back to a known default and
 * the user keeps the delivery time they already have, whereas a fabricated zone
 * would move their reminders somewhere nobody chose and nothing would report it.
 *
 * Wrapped in try/catch because this runs inside the FCM registration chain: a
 * throw here would take the device-token write down with it, and that write is
 * the reason the call exists. Hermes ships full ICU, so the throw path is only
 * reachable on an unusual runtime — which is exactly when a silent degradation
 * beats a crash.
 */
const getDeviceTimeZone = (): string | null => {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : null;
    } catch {
        return null;
    }
};

export default getDeviceTimeZone;
