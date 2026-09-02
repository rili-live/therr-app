import getDeviceTimeZone from '../../main/utilities/deviceTimeZone';

/**
 * The device's timezone report.
 *
 * This one value is what turns `main.notificationQueue.scheduledFor` from a
 * column that can only ever mean "now" into per-user delivery times: without
 * it, every scheduled notification fires at the habits digest's single Cloud
 * Scheduler hour, which is evening in America/Chicago and 02:00 in Auckland.
 *
 * It rides on the FCM registration call, so the two failure modes worth pinning
 * are both about not breaking that call: never throw, and never send a value the
 * server will reject with a 400 — which would take the device-token write down
 * with it and stop push working at all.
 */
describe('getDeviceTimeZone', () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;

    afterEach(() => {
        (Intl as any).DateTimeFormat = originalDateTimeFormat;
    });

    it('returns the IANA zone the platform resolves', () => {
        (Intl as any).DateTimeFormat = function DateTimeFormatMock() {
            return { resolvedOptions: () => ({ timeZone: 'America/New_York' }) };
        };

        expect(getDeviceTimeZone()).toBe('America/New_York');
    });

    it('returns null rather than a guess when the platform gives nothing', () => {
        // A wrong timezone is worse than none: the server falls back to a known
        // default and the user keeps the delivery time they already have,
        // whereas a fabricated zone moves their reminders somewhere nobody
        // chose and nothing anywhere reports it.
        (Intl as any).DateTimeFormat = function DateTimeFormatMock() {
            return { resolvedOptions: () => ({ timeZone: '   ' }) };
        };

        expect(getDeviceTimeZone()).toBeNull();
    });

    it('swallows a throwing runtime instead of failing push registration', () => {
        // This runs inside the FCM registration chain. A throw here would lose
        // the device-token write, which is the reason that call exists.
        (Intl as any).DateTimeFormat = function DateTimeFormatMock() {
            throw new Error('no ICU data');
        };

        expect(getDeviceTimeZone()).toBeNull();
    });
});
