import { expect } from 'chai';
import {
    FALLBACK_TIME_ZONE,
    MIN_MINUTES_BETWEEN_SLOTS,
    getLocalParts,
    getTimeZoneOffsetMinutes,
    isValidTimeZone,
    isWithinQuietHours,
    localTimeToInstant,
    parseTimeOfDay,
    resolveReminderSchedule,
} from '../../src/utilities/localReminderSchedule';

/**
 * Per-user reminder scheduling.
 *
 * The digest fires once a day from one Cloud Scheduler job, so before this
 * existed "run it in the evening" was evening in America/Chicago and nowhere
 * else. These tests pin the decisions that make a single global firing produce
 * per-user local delivery times — and, just as importantly, the cases where the
 * correct output is *no* notification at all.
 *
 * Every case passes the deciding instant in explicitly. A test that read the
 * clock could not reach a DST boundary or the far side of the date line, which
 * is where all the interesting failures live.
 */

/** 14:00 UTC — the hour the habits Cloud Scheduler job actually fires (09:00 CDT). */
const digestRunAt = (isoDate: string) => new Date(`${isoDate}T14:00:00.000Z`);

const localHourIn = (timeZone: string, at: Date | null): number => {
    if (!at) throw new Error('expected an instant');
    const parts = getLocalParts(timeZone, at as Date);
    if (!parts) throw new Error('expected local parts');
    return parts.minutesOfDay / 60;
};

describe('localReminderSchedule', () => {
    describe('getTimeZoneOffsetMinutes', () => {
        it('resolves the offset at the given instant, not a fixed one per zone', () => {
            // The whole reason the offset takes an instant: Chicago is -300 in
            // July and -360 in January. A single cached offset per zone is a
            // one-hour delivery error for half the year.
            expect(getTimeZoneOffsetMinutes('America/Chicago', new Date('2026-07-15T12:00:00Z'))).to.equal(-300);
            expect(getTimeZoneOffsetMinutes('America/Chicago', new Date('2026-01-15T12:00:00Z'))).to.equal(-360);
        });

        it('handles zones east of UTC and half-hour offsets', () => {
            expect(getTimeZoneOffsetMinutes('Asia/Tokyo', new Date('2026-07-15T12:00:00Z'))).to.equal(540);
            expect(getTimeZoneOffsetMinutes('Asia/Kolkata', new Date('2026-07-15T12:00:00Z'))).to.equal(330);
        });

        it('returns null rather than throwing for a junk zone', () => {
            expect(getTimeZoneOffsetMinutes('Not/AZone', new Date())).to.equal(null);
            expect(isValidTimeZone('Not/AZone')).to.equal(false);
            expect(isValidTimeZone('America/New_York')).to.equal(true);
            expect(isValidTimeZone('')).to.equal(false);
            expect(isValidTimeZone(null)).to.equal(false);
        });
    });

    describe('parseTimeOfDay', () => {
        it('accepts HH:MM and the HH:MM:SS a Postgres `time` column returns', () => {
            expect(parseTimeOfDay('08:00')).to.equal(480);
            expect(parseTimeOfDay('19:30:00')).to.equal(1170);
            expect(parseTimeOfDay('00:00')).to.equal(0);
        });

        it('rejects anything it cannot read instead of guessing', () => {
            ['', 'evening', '25:00', '08:99', null, undefined, 480].forEach((value) => {
                expect(parseTimeOfDay(value as any), String(value)).to.equal(null);
            });
        });
    });

    describe('isWithinQuietHours', () => {
        it('treats the normal overnight window as wrapping midnight', () => {
            const start = 21 * 60 + 30;
            const end = 8 * 60;
            expect(isWithinQuietHours(23 * 60, start, end)).to.equal(true);
            expect(isWithinQuietHours(3 * 60, start, end)).to.equal(true);
            expect(isWithinQuietHours(12 * 60, start, end)).to.equal(false);
            expect(isWithinQuietHours(end, start, end)).to.equal(false);
        });

        it('reads an empty window as "no quiet hours", never as "always quiet"', () => {
            // A user whose start equals their end has almost certainly not asked
            // to be silenced forever, and silencing them permanently is the one
            // failure here nobody would ever report as a bug.
            expect(isWithinQuietHours(3 * 60, 480, 480)).to.equal(false);
        });
    });

    describe('localTimeToInstant', () => {
        it('round-trips a wall-clock time through the zone', () => {
            const at = localTimeToInstant('America/New_York', { year: 2026, month: 7, day: 15 }, 19 * 60 + 30);
            expect(at?.toISOString()).to.equal('2026-07-15T23:30:00.000Z');
        });

        it('resolves the offset at the candidate instant, not at the naive reading', () => {
            // 2026-11-01 is the US fall-back. A single-pass conversion samples
            // the offset at 19:30 UTC — still EDT — and delivers an hour early.
            const at = localTimeToInstant('America/New_York', { year: 2026, month: 11, day: 1 }, 19 * 60 + 30);
            expect(at?.toISOString()).to.equal('2026-11-02T00:30:00.000Z');
        });
    });

    describe('resolveReminderSchedule', () => {
        it('delivers the morning nudge at the local morning for a user east of the digest', () => {
            // Berlin at 14:00 UTC is 16:00 local, so 08:00 has passed: the rule
            // is "as soon as possible", not "tomorrow" — deferring a full day
            // would make the streak counts a day stale before they are sent.
            const schedule = resolveReminderSchedule({ settingsTimezone: 'Europe/Berlin' }, digestRunAt('2026-07-15'));

            expect(schedule.timeZone).to.equal('Europe/Berlin');
            expect(schedule.usedFallbackTimeZone).to.equal(false);
            expect(schedule.localDate).to.equal('2026-07-15');
            expect(localHourIn('Europe/Berlin', schedule.morningAt)).to.equal(16);
        });

        it('never delivers inside quiet hours — the antipodal case the feature exists for', () => {
            // Auckland at 14:00 UTC is 02:00 the next local day. Before this,
            // the nudge went out at 02:00 local; now it waits for 08:00.
            const schedule = resolveReminderSchedule({ settingsTimezone: 'Pacific/Auckland' }, digestRunAt('2026-07-15'));

            expect(schedule.localDate).to.equal('2026-07-16');
            expect(localHourIn('Pacific/Auckland', schedule.morningAt)).to.equal(8);
            expect(getLocalParts('Pacific/Auckland', schedule.morningAt)?.date).to.equal('2026-07-16');
        });

        it('schedules both slots for a user whose local day is still ahead of them', () => {
            // Honolulu at 14:00 UTC is 04:00 local — inside quiet hours, so the
            // morning slot moves to 08:00 and the whole day is still available.
            const schedule = resolveReminderSchedule({ settingsTimezone: 'Pacific/Honolulu' }, digestRunAt('2026-07-15'));

            expect(localHourIn('Pacific/Honolulu', schedule.morningAt)).to.equal(8);
            expect(localHourIn('Pacific/Honolulu', schedule.lastChanceAt)).to.equal(19.5);
            expect(getLocalParts('Pacific/Honolulu', schedule.lastChanceAt as Date)?.date).to.equal('2026-07-15');
        });

        it('drops the last-chance slot once the local day has no room left', () => {
            // Tokyo at 14:00 UTC is 23:00 local. "Last chance to keep today's
            // streak" delivered tomorrow morning is nonsense, so the correct
            // output is nothing at all.
            const schedule = resolveReminderSchedule({ settingsTimezone: 'Asia/Tokyo' }, digestRunAt('2026-07-15'));

            expect(schedule.lastChanceAt).to.equal(null);
            // The morning nudge still lands, at the next hour the user has
            // agreed to hear from us.
            expect(localHourIn('Asia/Tokyo', schedule.morningAt)).to.equal(8);
        });

        it('keeps the two slots at least MIN_MINUTES_BETWEEN_SLOTS apart', () => {
            // A user whose morning nudge was itself deferred to 17:00 must not
            // then be told "last chance" at 19:30 — two pushes 150 minutes
            // apart saying the same thing is the spam this is designed around.
            const lateAfternoonUtc = new Date('2026-07-15T21:00:00.000Z'); // 16:00 CDT
            const schedule = resolveReminderSchedule({ settingsTimezone: 'America/Chicago' }, lateAfternoonUtc);

            expect(localHourIn('America/Chicago', schedule.morningAt)).to.equal(16);
            expect(schedule.lastChanceAt).to.equal(null);
            expect(MIN_MINUTES_BETWEEN_SLOTS).to.equal(240);
        });

        it('honours settingsPreferredReminderTime even against the default quiet-hours end', () => {
            // 11:00 UTC is 06:00 CDT, so a 07:15 preference is still ahead. It
            // also sits inside the *default* quiet window (which ends at 08:00),
            // and the user's own explicit setting has to win — clamping it would
            // make the preference silently do nothing.
            const schedule = resolveReminderSchedule({
                settingsTimezone: 'America/Chicago',
                settingsPreferredReminderTime: '07:15:00',
            }, new Date('2026-07-15T11:00:00.000Z'));

            expect(localHourIn('America/Chicago', schedule.morningAt)).to.equal(7.25);
        });

        it('pulls the last-chance slot earlier for a user whose quiet hours start early', () => {
            // An early sleeper (quiet from 18:00) would otherwise be silently
            // excluded from the feature entirely.
            const schedule = resolveReminderSchedule({
                settingsTimezone: 'Pacific/Honolulu',
                settingsQuietHoursStart: '18:00:00',
                settingsQuietHoursEnd: '06:00:00',
            }, digestRunAt('2026-07-15'));

            expect(localHourIn('Pacific/Honolulu', schedule.lastChanceAt)).to.equal(17.5);
        });

        it('falls back to the digest\'s own zone when the user has no timezone', () => {
            // The fallback is America/Chicago rather than UTC on purpose: it is
            // the zone the scheduler already fires in, so a user we know nothing
            // about keeps the delivery time they have today.
            const schedule = resolveReminderSchedule({ settingsTimezone: null }, digestRunAt('2026-07-15'));

            expect(schedule.usedFallbackTimeZone).to.equal(true);
            expect(schedule.timeZone).to.equal(FALLBACK_TIME_ZONE);
            expect(localHourIn(FALLBACK_TIME_ZONE, schedule.morningAt)).to.equal(9);
            expect(localHourIn(FALLBACK_TIME_ZONE, schedule.lastChanceAt)).to.equal(19.5);
        });

        it('falls back rather than throwing on a junk timezone in the row', () => {
            const schedule = resolveReminderSchedule({ settingsTimezone: 'Mars/Olympus_Mons' }, digestRunAt('2026-07-15'));

            expect(schedule.usedFallbackTimeZone).to.equal(true);
            expect(schedule.timeZone).to.equal(FALLBACK_TIME_ZONE);
        });
    });
});
