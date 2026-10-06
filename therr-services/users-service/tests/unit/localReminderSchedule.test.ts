import { expect } from 'chai';
import {
    EVENING_REMINDER_WINDOW,
    FALLBACK_TIME_ZONE,
    MIN_MINUTES_BETWEEN_SLOTS,
    MORNING_REMINDER_WINDOW,
    getDailyJitterMinutes,
    normalizePreferredReminderTimeInput,
    readPreferredReminderTime,
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
    describe('preferred reminder times', () => {
        it('normalizes what the settings screen sends and rejects what it never offers', () => {
            expect(normalizePreferredReminderTimeInput('07:15', 'morning')).to.deep.equal({ isValid: true, value: '07:15' });
            expect(normalizePreferredReminderTimeInput('21:30:00', 'evening')).to.deep.equal({ isValid: true, value: '21:30' });
            // null and '' are "back to the default", not errors.
            expect(normalizePreferredReminderTimeInput(null, 'morning')).to.deep.equal({ isValid: true, value: null });
            expect(normalizePreferredReminderTimeInput('', 'evening')).to.deep.equal({ isValid: true, value: null });
            ['03:00', '12:00', 'morning', 715, true].forEach((value) => {
                expect(normalizePreferredReminderTimeInput(value, 'morning').isValid, String(value)).to.equal(false);
            });
            // A morning time is not a valid evening time, and vice versa.
            expect(normalizePreferredReminderTimeInput('09:00', 'evening').isValid).to.equal(false);
            expect(normalizePreferredReminderTimeInput('20:00', 'morning').isValid).to.equal(false);
        });

        it('keeps the two windows far enough apart that no offered pair can cost the evening slot', () => {
            // The latest morning and earliest evening choice, each at the worst
            // edge of the jitter, must still be MIN_MINUTES_BETWEEN_SLOTS apart.
            const worstGap = (EVENING_REMINDER_WINDOW.earliest - 15) - (MORNING_REMINDER_WINDOW.latest + 15);
            expect(worstGap).to.be.at.least(MIN_MINUTES_BETWEEN_SLOTS);
        });

        it('ignores a stored value outside the window rather than honouring it', () => {
            expect(readPreferredReminderTime('03:00:00', 'morning')).to.equal(null);
            expect(readPreferredReminderTime('07:00:00', 'morning')).to.equal(420);
        });

        it('honours a chosen evening time past the default quiet-hours start', () => {
            // Honolulu at 14:00 UTC is 04:00, so the whole day is ahead. 22:30 is
            // after the default quiet start (21:30) and must not be clamped to 21:00.
            const schedule = resolveReminderSchedule({
                settingsTimezone: 'Pacific/Honolulu',
                settingsPreferredEveningReminderTime: '22:30:00',
            }, digestRunAt('2026-07-15'));

            expect(schedule.usedPreferredEveningTime).to.equal(true);
            expect(localHourIn('Pacific/Honolulu', schedule.lastChanceAt)).to.equal(22.5);
        });

        it('still lets the user\'s own quiet hours win over their chosen evening time', () => {
            const schedule = resolveReminderSchedule({
                settingsTimezone: 'Pacific/Honolulu',
                settingsPreferredEveningReminderTime: '22:30:00',
                settingsQuietHoursStart: '21:00:00',
                settingsQuietHoursEnd: '07:00:00',
            }, digestRunAt('2026-07-15'));

            expect(localHourIn('Pacific/Honolulu', schedule.lastChanceAt)).to.equal(20.5);
        });

        it('uses the chosen morning time for tomorrow when the decision is made late at night', () => {
            // Tokyo at 14:00 UTC is 23:00. The default case waits for the end of
            // quiet hours (08:00); a user who chose 06:30 gets 06:30.
            const schedule = resolveReminderSchedule({
                settingsTimezone: 'Asia/Tokyo',
                settingsPreferredReminderTime: '06:30:00',
            }, digestRunAt('2026-07-15'));

            expect(localHourIn('Asia/Tokyo', schedule.morningAt)).to.equal(6.5);
            expect(schedule.morningLocalDate).to.equal('2026-07-16');
            expect(schedule.lastChanceAt).to.equal(null);
        });

        it('sends as soon as possible, not tomorrow, once the chosen morning time has passed', () => {
            // Berlin at 14:00 UTC is 16:00. Rule 1 still holds for a chosen time:
            // a day's deferral would make the streak counts stale.
            const schedule = resolveReminderSchedule({
                settingsTimezone: 'Europe/Berlin',
                settingsPreferredReminderTime: '07:00:00',
            }, digestRunAt('2026-07-15'));

            expect(localHourIn('Europe/Berlin', schedule.morningAt)).to.equal(16);
            expect(schedule.morningLocalDate).to.equal('2026-07-15');
        });
    });

    describe('daily jitter', () => {
        const seeds = Array.from({ length: 200 }, (_, i) => `user-${i}`);

        it('is reproducible, bounded and different from day to day', () => {
            expect(getDailyJitterMinutes('user-1', '2026-07-15', 'morning', 15))
                .to.equal(getDailyJitterMinutes('user-1', '2026-07-15', 'morning', 15));

            const days = Array.from({ length: 14 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`);
            const offsets = days.map((day) => getDailyJitterMinutes('user-1', day, 'morning', 15));
            offsets.forEach((offset) => expect(Math.abs(offset)).to.be.at.most(15));
            expect(new Set(offsets).size).to.be.greaterThan(3);

            const all = seeds.map((seed) => getDailyJitterMinutes(seed, '2026-07-15', 'morning', 15));
            expect(Math.min(...all)).to.equal(-15);
            expect(Math.max(...all)).to.equal(15);
        });

        it('is off without a seed or with a zero range', () => {
            expect(getDailyJitterMinutes(null, '2026-07-15', 'morning', 15)).to.equal(0);
            expect(getDailyJitterMinutes('user-1', '2026-07-15', 'morning', 0)).to.equal(0);
        });

        it('moves a chosen time within the range and never into the past', () => {
            const at = new Date('2026-07-15T11:00:00.000Z'); // 06:00 CDT
            seeds.forEach((seed) => {
                const schedule = resolveReminderSchedule({
                    settingsTimezone: 'America/Chicago',
                    settingsPreferredReminderTime: '07:00:00',
                    settingsPreferredEveningReminderTime: '20:00:00',
                }, at, { jitterSeed: seed, jitterMinutes: 15 });

                expect(Math.abs(localHourIn('America/Chicago', schedule.morningAt) - 7)).to.be.at.most(0.25);
                expect(Math.abs(localHourIn('America/Chicago', schedule.lastChanceAt) - 20)).to.be.at.most(0.25);
                expect(schedule.morningAt.getTime()).to.be.at.least(at.getTime());
            });
        });

        it('never jitters the default morning slot into the default quiet hours', () => {
            // The default 08:00 target sits exactly on the default quiet-hours end.
            const at = new Date('2026-07-15T11:00:00.000Z'); // 06:00 CDT
            seeds.forEach((seed) => {
                const schedule = resolveReminderSchedule({ settingsTimezone: 'America/Chicago' }, at, { jitterSeed: seed });
                const hour = localHourIn('America/Chicago', schedule.morningAt);
                expect(hour).to.be.at.least(8);
                expect(hour).to.be.at.most(8.25);
            });
        });

        it('spreads an as-soon-as-possible slot forward rather than pinning it to the digest\'s minute', () => {
            const minutes = seeds.map((seed) => localHourIn(
                'Europe/Berlin',
                resolveReminderSchedule({ settingsTimezone: 'Europe/Berlin' }, digestRunAt('2026-07-15'), {
                    jitterSeed: seed,
                    jitterMinutes: 15,
                }).morningAt,
            ));
            minutes.forEach((hour) => {
                expect(hour).to.be.at.least(16);
                expect(hour).to.be.at.most(16.25);
            });
            expect(new Set(minutes).size).to.be.greaterThan(5);
        });

        it('cannot cost the evening slot for the closest pair of times the screen offers', () => {
            const at = new Date('2026-07-15T14:00:00.000Z'); // 04:00 in Honolulu
            seeds.forEach((seed) => {
                const schedule = resolveReminderSchedule({
                    settingsTimezone: 'Pacific/Honolulu',
                    settingsPreferredReminderTime: '11:30:00',
                    settingsPreferredEveningReminderTime: '16:00:00',
                }, at, { jitterSeed: seed, jitterMinutes: 15 });
                expect(schedule.lastChanceAt, seed).to.not.equal(null);
            });
        });
    });
});
