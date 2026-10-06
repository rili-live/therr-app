/**
 * When, in real UTC instants, a habit reminder should land for one user.
 *
 * ## Why this exists
 *
 * The habits digest is poked once a day by a single Cloud Scheduler job
 * (`0 9 * * *` `America/Chicago`), and every row it queued carried
 * `scheduledFor = now()`. So "run it in the evening" — the comment
 * `habitsDigest.ts` has carried since it was written — meant evening in exactly
 * one timezone. A user in Auckland got "your streak is on the line, check in
 * before midnight" at 02:00, six hours after the midnight it was warning them
 * about; a user in Berlin got their *morning* nudge at 16:00.
 *
 * `main.notificationQueue.scheduledFor` was built for precisely this and its
 * migration says so ("`scheduledFor` decouples *decide to notify* from
 * *notify*"). It could not mean anything, though, until something knew a user's
 * timezone. `main.users.settingsTimezone` has existed since the habits schema
 * landed and nothing ever wrote it; the mobile client now reports it on every
 * push registration, so this module is what turns that column into delivery
 * times.
 *
 * ## What it decides
 *
 * Two slots per local day, from one digest run:
 *
 *   - **morning** — the streak-status nudge. Where it used to fire at the
 *     digest's own clock time, it now lands at the user's preferred morning
 *     time (`settingsPreferredReminderTime`, else 08:00 local), and is pushed
 *     to the end of quiet hours rather than delivered at 02:00.
 *   - **last chance** — the evening reminder. At the user's preferred evening
 *     time (`settingsPreferredEveningReminderTime`, else 19:30 local), while
 *     there is still time to act on it, and never once their local day is
 *     effectively over.
 *
 * Both preference columns are set from the Friends with Habits notification
 * settings screen. NULL means "not chosen", and is deliberately different from
 * any time: an explicit choice is allowed to sit inside the *default* quiet
 * hours (the user told us when they are awake, which beats our guess), while
 * the default never is. A stored value outside the window that screen offers
 * (`MORNING_REMINDER_WINDOW` / `EVENING_REMINDER_WINDOW`) is ignored rather
 * than honoured — it can only have arrived some other way, and a 03:00 push is
 * the failure this module exists to prevent.
 *
 * ## Daily jitter
 *
 * A reminder at exactly 09:30 every day stops being read; it becomes part of
 * the furniture, and then it becomes the reason notifications get turned off.
 * So each slot moves by up to `REMINDER_JITTER_MINUTES` either side of its
 * target, by a different amount each day. The offset is derived from
 * (user, local date, slot) rather than `Math.random()`, which keeps a re-run of
 * the digest on the same day computing the same instant and keeps every test
 * deterministic. It is opt-in per call (`jitterSeed`), and
 * `HABIT_REMINDER_JITTER_MINUTES=0` turns it off everywhere.
 *
 * Jitter never changes *how many* reminders anyone gets: dedupe keys are
 * stamped with the date, not the time, so a moved slot cannot produce a second
 * row.
 *
 * ## The rules, and why each one is a rule
 *
 * 1. **Never schedule into the past.** A slot whose time has already passed
 *    locally becomes "as soon as possible", not "tomorrow". Deferring a whole
 *    day would make the decision (streak counts, which habits are outstanding)
 *    a day stale by the time it is sent, and the digest re-decides tomorrow
 *    anyway.
 * 2. **Never schedule inside quiet hours.** A reminder at 03:00 is not a
 *    reminder, it is the reason someone turns notifications off. A morning slot
 *    that lands in quiet hours moves to the *end* of them — bounded by roughly
 *    half a day, not by a full one.
 * 3. **The last-chance slot may be dropped; the morning slot may not.** "Last
 *    chance to keep today's streak" delivered tomorrow morning is nonsense, so
 *    when the user's local day has no room left this returns `null` and the
 *    digest queues nothing. Silence is the correct output here.
 * 4. **The two slots are at least `MIN_MINUTES_BETWEEN_SLOTS` apart.** A user
 *    whose morning nudge was itself deferred to 18:00 must not then get a
 *    "last chance" at 19:30. Two pushes 90 minutes apart saying the same thing
 *    is the spam this feature is otherwise designed to avoid.
 *
 * Everything here is pure — no database, no clock of its own — because the
 * interesting cases (DST boundaries, the far side of the date line, quiet hours
 * that wrap midnight) are only reachable in a test if the instant and the zone
 * are both arguments.
 */

import { createHash } from 'crypto';

/** Minutes past local midnight. */
export type MinutesOfDay = number;

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Where a user lands when `settingsTimezone` is unset.
 *
 * `America/Chicago` rather than UTC on purpose: it is the zone the single
 * Cloud Scheduler job already fires in, so a user with no timezone keeps
 * receiving reminders at exactly the hour they receive them today. The change
 * is then strictly additive — nobody's delivery time moves until we actually
 * know something about them.
 */
export const FALLBACK_TIME_ZONE = process.env.HABIT_REMINDER_DEFAULT_TIMEZONE || 'America/Chicago';

export const DEFAULT_MORNING_LOCAL_TIME = process.env.HABIT_MORNING_REMINDER_LOCAL_TIME || '08:00';
export const DEFAULT_LAST_CHANCE_LOCAL_TIME = process.env.HABIT_LAST_CHANCE_LOCAL_TIME || '19:30';
export const DEFAULT_QUIET_HOURS_START = process.env.HABIT_REMINDER_QUIET_HOURS_START || '21:30';
export const DEFAULT_QUIET_HOURS_END = process.env.HABIT_REMINDER_QUIET_HOURS_END || '08:00';

/**
 * Minimum spacing between the morning nudge and the last-chance nudge, in
 * minutes. Distinct from the queue worker's `MIN_GAP_BETWEEN_SENDS_MS`, which
 * spaces *unrelated* notifications by 15 minutes: these two say the same thing
 * about the same habits, so they need a gap measured in hours, and it has to be
 * decided here — the worker only sees two due rows and cannot tell they are a
 * pair.
 */
export const MIN_MINUTES_BETWEEN_SLOTS = 4 * 60;

/**
 * How far before quiet hours the last-chance nudge is still allowed to land.
 *
 * Only reachable for a user whose own `settingsQuietHoursStart` is earlier than
 * the last-chance time — an early sleeper. Clamping rather than dropping keeps
 * them reachable; the alternative silently excludes exactly the users who set
 * a preference.
 */
export const LAST_CHANCE_QUIET_BUFFER_MINUTES = 30;

/** Upper bound on the jitter an operator can configure; past an hour it stops being "around" a time. */
const MAX_REMINDER_JITTER_MINUTES = 60;

const parseJitterMinutes = (value: string | undefined): number => {
    const parsed = Number(value);
    if (value === undefined || value === '' || !Number.isFinite(parsed)) {
        return 15;
    }
    return Math.min(Math.max(Math.round(parsed), 0), MAX_REMINDER_JITTER_MINUTES);
};

/**
 * How far either side of its target a slot may move from one day to the next.
 * `HABIT_REMINDER_JITTER_MINUTES=0` restores exact, fixed-time delivery.
 */
export const REMINDER_JITTER_MINUTES = parseJitterMinutes(process.env.HABIT_REMINDER_JITTER_MINUTES);

export interface IReminderWindow {
    earliest: MinutesOfDay;
    latest: MinutesOfDay;
}

/**
 * The times a user may choose, inclusive. Wider than "morning" and "evening"
 * strictly need to be, but chosen so that the two never come within
 * `MIN_MINUTES_BETWEEN_SLOTS` of each other even at the edges of the jitter
 * (11:30 + 15 → 11:45 against 16:00 − 15 → 15:45 is exactly four hours): a
 * pair of choices the settings screen offers must never silently cost the user
 * their evening reminder. The users handler validates against these, and the
 * scheduler ignores a stored value outside them.
 */
export const MORNING_REMINDER_WINDOW: IReminderWindow = { earliest: 5 * 60, latest: 11 * 60 + 30 };
export const EVENING_REMINDER_WINDOW: IReminderWindow = { earliest: 16 * 60, latest: 23 * 60 };

export type ReminderSlot = 'morning' | 'evening';

const REMINDER_WINDOWS: Record<ReminderSlot, IReminderWindow> = {
    morning: MORNING_REMINDER_WINDOW,
    evening: EVENING_REMINDER_WINDOW,
};

export interface IReminderPreferences {
    /** IANA zone, e.g. 'America/New_York'. Null/invalid falls back. */
    settingsTimezone?: string | null;
    /** Postgres `time`, e.g. '07:15:00'. The user's morning target; null means the default. */
    settingsPreferredReminderTime?: string | null;
    /** Postgres `time`, e.g. '20:45:00'. The user's evening target; null means the default. */
    settingsPreferredEveningReminderTime?: string | null;
    settingsQuietHoursStart?: string | null;
    settingsQuietHoursEnd?: string | null;
}

export interface IReminderScheduleOptions {
    /**
     * Stable per-user value (the user id) that makes each slot move by a
     * different, reproducible amount each day. Omitted means no jitter.
     */
    jitterSeed?: string | null;
    /** Overrides `REMINDER_JITTER_MINUTES`; for tests. */
    jitterMinutes?: number;
}

export interface IReminderSchedule {
    /** The zone actually used — the fallback when the user's is missing or invalid. */
    timeZone: string;
    /** True when `settingsTimezone` was absent or unusable. Counted by the digest. */
    usedFallbackTimeZone: boolean;
    /** True when the morning slot targeted the user's own chosen time rather than the default. */
    usedPreferredMorningTime: boolean;
    /** True when the evening slot targeted the user's own chosen time rather than the default. */
    usedPreferredEveningTime: boolean;
    /** The user's calendar date at `at`, YYYY-MM-DD — the day the digest is deciding about. */
    localDate: string;
    /** When to deliver the streak-status nudge. Never null — everyone gets one. */
    morningAt: Date;
    /**
     * The user's calendar date *at* `morningAt`. Usually `localDate`, but one
     * day later when the slot was pushed past midnight by quiet hours. This is
     * the date the send-time freshness gate must check: the notification is
     * about the day it lands on, not the day it was decided on.
     */
    morningLocalDate: string;
    /**
     * When to deliver the "last chance" nudge, or null when the user's local day
     * has no room left for one. Null is a normal, expected outcome.
     */
    lastChanceAt: Date | null;
    /** The user's calendar date at `lastChanceAt`, or null alongside it. */
    lastChanceLocalDate: string | null;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * The zone's UTC offset, in minutes, *at a particular instant* — which is the
 * only way to ask the question correctly. A zone does not have "an" offset;
 * `America/Chicago` is -300 in July and -360 in January, and getting that wrong
 * is a one-hour delivery error twice a year in every zone that observes DST.
 *
 * Returns null for a zone `Intl` does not recognise, which is how an
 * unvalidated value out of the database is detected. (Node ships full ICU, so
 * every IANA zone resolves; a null here means the string is junk.)
 */
export const getTimeZoneOffsetMinutes = (timeZone: string, at: Date): number | null => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).formatToParts(at);

        const lookup: Record<string, number> = {};
        parts.forEach((part) => {
            if (part.type !== 'literal') {
                lookup[part.type] = Number(part.value);
            }
        });

        if (Number.isNaN(lookup.year) || lookup.year === undefined) {
            return null;
        }

        // `hour: '2-digit'` with hour12: false renders midnight as '24' in some
        // ICU versions. Normalizing keeps the arithmetic below on the right day.
        const hour = lookup.hour === 24 ? 0 : lookup.hour;

        const asIfUtc = Date.UTC(lookup.year, lookup.month - 1, lookup.day, hour, lookup.minute, lookup.second);

        return Math.round((asIfUtc - at.getTime()) / MS_PER_MINUTE);
    } catch (err) {
        // RangeError for an unknown timeZone. Never throws to the caller: a bad
        // value in one user's row must not take down a digest run.
        return null;
    }
};

export const isValidTimeZone = (timeZone: unknown): timeZone is string => (
    typeof timeZone === 'string'
    && !!timeZone.trim()
    && getTimeZoneOffsetMinutes(timeZone.trim(), new Date()) !== null
);

export interface ILocalParts {
    year: number;
    month: number;
    day: number;
    /** YYYY-MM-DD in the user's zone. */
    date: string;
    minutesOfDay: MinutesOfDay;
}

/** Break an instant into the user's local calendar date and time-of-day. */
export const getLocalParts = (timeZone: string, at: Date): ILocalParts | null => {
    const offset = getTimeZoneOffsetMinutes(timeZone, at);
    if (offset === null) {
        return null;
    }

    const shifted = new Date(at.getTime() + offset * MS_PER_MINUTE);

    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        date: `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`,
        minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    };
};

/**
 * Parse 'HH:MM' or Postgres' 'HH:MM:SS' into minutes past midnight.
 * Returns null for anything else — including the empty string a nullable
 * `time` column round-trips as through some drivers.
 */
export const parseTimeOfDay = (value: unknown): MinutesOfDay | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
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
 * The UTC instant of a local wall-clock time on a given local calendar date.
 *
 * Resolved twice on purpose. The offset has to be sampled at *some* instant,
 * and the first sample is taken at the naive UTC reading of the wall clock,
 * which sits on the wrong side of a DST transition for exactly the times near
 * one. Re-sampling at the candidate instant and recomputing corrects that. A
 * wall-clock time that does not exist (the skipped hour in spring) lands on the
 * instant just after the jump, which is the conventional and harmless answer
 * for a notification.
 */
export const localTimeToInstant = (
    timeZone: string,
    parts: { year: number; month: number; day: number },
    minutesOfDay: MinutesOfDay,
): Date | null => {
    const naive = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) + minutesOfDay * MS_PER_MINUTE;

    const firstOffset = getTimeZoneOffsetMinutes(timeZone, new Date(naive));
    if (firstOffset === null) {
        return null;
    }

    const candidate = naive - firstOffset * MS_PER_MINUTE;
    const secondOffset = getTimeZoneOffsetMinutes(timeZone, new Date(candidate));
    if (secondOffset === null || secondOffset === firstOffset) {
        return new Date(candidate);
    }

    return new Date(naive - secondOffset * MS_PER_MINUTE);
};

/**
 * Is this minute-of-day inside the user's quiet hours?
 *
 * Quiet hours normally wrap midnight (21:30 → 08:00), so the comparison is a
 * union of two ranges rather than a single interval. A degenerate window where
 * start equals end is read as "no quiet hours" rather than "always quiet" —
 * the alternative silences the user permanently on a value they probably did
 * not mean to set.
 */
export const isWithinQuietHours = (
    minutesOfDay: MinutesOfDay,
    quietStart: MinutesOfDay,
    quietEnd: MinutesOfDay,
): boolean => {
    if (quietStart === quietEnd) {
        return false;
    }
    if (quietStart > quietEnd) {
        return minutesOfDay >= quietStart || minutesOfDay < quietEnd;
    }
    return minutesOfDay >= quietStart && minutesOfDay < quietEnd;
};

/**
 * Read a user's chosen reminder time for one slot: minutes past midnight, or
 * null when it is unset, unreadable or outside the window the settings screen
 * offers. Null always means "use the default", so a bad value degrades to the
 * behaviour every user had before the preference existed.
 */
export const readPreferredReminderTime = (value: unknown, slot: ReminderSlot): MinutesOfDay | null => {
    const minutes = parseTimeOfDay(value);
    const window = REMINDER_WINDOWS[slot];
    if (minutes === null || minutes < window.earliest || minutes > window.latest) {
        return null;
    }
    return minutes;
};

export type PreferredReminderTimeInput =
    | { isValid: true; value: string | null }
    | { isValid: false };

/**
 * Validate a preferred reminder time from a settings update and normalise it to
 * what is stored. `null` and `''` clear the preference (back to the default);
 * anything else must be 'HH:MM' or 'HH:MM:SS' inside the slot's window.
 * Callers treat `undefined` as "not part of this update" before calling this.
 */
export const normalizePreferredReminderTimeInput = (value: unknown, slot: ReminderSlot): PreferredReminderTimeInput => {
    if (value === null || value === '') {
        return { isValid: true, value: null };
    }
    const minutes = readPreferredReminderTime(value, slot);
    if (minutes === null) {
        return { isValid: false };
    }
    return { isValid: true, value: `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}` };
};

/**
 * This slot's offset for this user on this local day, in whole minutes within
 * ±`maxMinutes`. Reproducible — the same inputs always give the same offset —
 * so the digest re-deciding on a re-run lands on the same instant, and the
 * morning and evening slots move independently of one another.
 */
export const getDailyJitterMinutes = (
    seed: string | null | undefined,
    localDate: string,
    slot: ReminderSlot,
    maxMinutes: number = REMINDER_JITTER_MINUTES,
): number => {
    if (!seed || maxMinutes <= 0) {
        return 0;
    }
    const digest = createHash('sha256').update(`${seed}:${localDate}:${slot}`).digest();
    return (digest.readUInt32BE(0) % (2 * maxMinutes + 1)) - maxMinutes;
};

/**
 * Both delivery instants for one user, from one digest run.
 *
 * `at` is the moment the digest is deciding — passed in rather than read from
 * the clock so the DST and date-line cases are reachable from a test.
 */
export const resolveReminderSchedule = (
    preferences: IReminderPreferences,
    at: Date,
    options: IReminderScheduleOptions = {},
): IReminderSchedule => {
    const requested = typeof preferences.settingsTimezone === 'string' ? preferences.settingsTimezone.trim() : '';
    const usedFallbackTimeZone = !requested || getTimeZoneOffsetMinutes(requested, at) === null;
    const preferredZone = usedFallbackTimeZone ? FALLBACK_TIME_ZONE : requested;

    // FALLBACK_TIME_ZONE is a constant in the happy path, but an operator can
    // override it with an env var, so a bad value there must not throw either.
    // UTC is the last resort — it always resolves.
    const preferredParts = getLocalParts(preferredZone, at);
    const resolvedZone = preferredParts ? preferredZone : 'UTC';
    const local = preferredParts || getLocalParts('UTC', at) as ILocalParts;

    const jitterMinutes = options.jitterMinutes ?? REMINDER_JITTER_MINUTES;
    const morningJitter = getDailyJitterMinutes(options.jitterSeed, local.date, 'morning', jitterMinutes);
    const eveningJitter = getDailyJitterMinutes(options.jitterSeed, local.date, 'evening', jitterMinutes);

    const explicitMorning = readPreferredReminderTime(preferences.settingsPreferredReminderTime, 'morning');
    const explicitEvening = readPreferredReminderTime(preferences.settingsPreferredEveningReminderTime, 'evening');

    const ownQuietStart = parseTimeOfDay(preferences.settingsQuietHoursStart);
    const ownQuietEnd = parseTimeOfDay(preferences.settingsQuietHoursEnd);
    let quietStart = ownQuietStart ?? parseTimeOfDay(DEFAULT_QUIET_HOURS_START) as MinutesOfDay;
    let quietEnd = ownQuietEnd ?? parseTimeOfDay(DEFAULT_QUIET_HOURS_END) as MinutesOfDay;

    // The default quiet window is our guess at when people sleep; a reminder
    // time the user picked is better evidence. So when they have not set quiet
    // hours of their own, the window shrinks to keep their chosen times (and
    // the jitter around them) outside it — otherwise a 07:00 or 22:30 choice
    // would be clamped back to 08:00 / 21:00 and the setting would do nothing.
    // Quiet hours the user set themselves are never overridden.
    if (ownQuietStart === null && ownQuietEnd === null && quietStart > quietEnd) {
        if (explicitMorning !== null) {
            quietEnd = Math.max(0, Math.min(quietEnd, explicitMorning - jitterMinutes));
        }
        if (explicitEvening !== null) {
            quietStart = Math.min(
                MINUTES_PER_DAY - 1,
                Math.max(quietStart, explicitEvening + jitterMinutes + LAST_CHANCE_QUIET_BUFFER_MINUTES),
            );
        }
    }

    // ---- Morning slot -------------------------------------------------------
    const morningTarget = explicitMorning ?? parseTimeOfDay(DEFAULT_MORNING_LOCAL_TIME) as MinutesOfDay;
    let jitteredMorning = morningTarget + morningJitter;
    // The default target sits exactly on the default quiet-hours end, so a
    // negative offset would jitter it *into* quiet hours. Mirror it forward.
    if (explicitMorning === null
        && isWithinQuietHours(jitteredMorning, quietStart, quietEnd)
        && !isWithinQuietHours(morningTarget, quietStart, quietEnd)) {
        jitteredMorning = morningTarget + Math.abs(morningJitter);
    }

    let morningMinutes: MinutesOfDay;
    let morningDayOffset = 0;

    if (jitteredMorning >= local.minutesOfDay) {
        // Still ahead: deliver at the target. A time the user asked for is
        // honoured as-is — no quiet window has any business overriding it.
        morningMinutes = jitteredMorning;
    } else {
        // Rule 1: the target has passed locally, so "as soon as possible" — not
        // tomorrow. Spread forward by the day's jitter so even this case is not
        // the same minute every day.
        morningMinutes = Math.min(local.minutesOfDay + Math.abs(morningJitter), MINUTES_PER_DAY - 1);

        // Rule 2: never inside quiet hours. A slot that lands there moves to the
        // next moment the user has agreed to hear from us.
        if (isWithinQuietHours(morningMinutes, quietStart, quietEnd)) {
            // Late-evening decisions sit *after* quiet hours begin, so the next
            // quiet-hours end is tomorrow's. Early-morning ones are before it and
            // stay on today.
            if (local.minutesOfDay >= quietEnd) {
                morningDayOffset = 1;
                // Tomorrow morning is a fresh target, so a time the user chose
                // applies to it in full.
                morningMinutes = explicitMorning !== null
                    ? jitteredMorning
                    : quietEnd + Math.abs(morningJitter);
            } else {
                morningMinutes = quietEnd + Math.abs(morningJitter);
            }
        }
    }

    const morningAt = localTimeToInstant(
        resolvedZone,
        { year: local.year, month: local.month, day: local.day + morningDayOffset },
        morningMinutes,
    ) || at;

    // ---- Last-chance slot ---------------------------------------------------
    // Deliberately allowed to come back null. This nudge is about *today*, so
    // "later" is not a valid answer for it the way it is for the morning one.
    let lastChanceAt: Date | null = null;

    // An early sleeper's own quiet hours can begin before the evening target.
    // Pull the slot earlier rather than dropping them from the feature — the
    // alternative silently excludes exactly the users who bothered to set a
    // preference.
    const latestUsable = quietStart > quietEnd
        ? quietStart - LAST_CHANCE_QUIET_BUFFER_MINUTES
        : MINUTES_PER_DAY - 1;
    const eveningTarget = explicitEvening ?? parseTimeOfDay(DEFAULT_LAST_CHANCE_LOCAL_TIME) as MinutesOfDay;
    const jitteredEvening = eveningTarget + eveningJitter;
    const lastChanceMinutes = Math.min(
        jitteredEvening >= local.minutesOfDay
            ? jitteredEvening
            : local.minutesOfDay + Math.abs(eveningJitter),
        latestUsable,
    );

    const isSameLocalDay = morningDayOffset === 0;
    // Clamping to `latestUsable` must never push the slot into the past.
    const isStillAhead = lastChanceMinutes >= local.minutesOfDay && lastChanceMinutes < MINUTES_PER_DAY;
    const isAwake = !isWithinQuietHours(lastChanceMinutes, quietStart, quietEnd);
    const isFarEnoughFromMorning = lastChanceMinutes - morningMinutes >= MIN_MINUTES_BETWEEN_SLOTS;

    if (isSameLocalDay && isStillAhead && isAwake && isFarEnoughFromMorning) {
        lastChanceAt = localTimeToInstant(
            resolvedZone,
            { year: local.year, month: local.month, day: local.day },
            lastChanceMinutes,
        );
    }

    return {
        timeZone: resolvedZone,
        usedFallbackTimeZone,
        usedPreferredMorningTime: explicitMorning !== null,
        usedPreferredEveningTime: explicitEvening !== null,
        localDate: local.date,
        morningAt,
        morningLocalDate: getLocalParts(resolvedZone, morningAt)?.date || local.date,
        lastChanceAt,
        lastChanceLocalDate: lastChanceAt
            ? getLocalParts(resolvedZone, lastChanceAt)?.date || local.date
            : null,
    };
};
