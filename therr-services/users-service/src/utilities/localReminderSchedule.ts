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
 *     digest's own clock time, it now lands at the user's preferred reminder
 *     time (or 08:00 local), and is pushed to the end of quiet hours rather
 *     than delivered at 02:00.
 *   - **last chance** — the new evening reminder. Mid-to-late in the *user's*
 *     day, while there is still time to act on it, and never once their local
 *     day is effectively over.
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

export interface IReminderPreferences {
    /** IANA zone, e.g. 'America/New_York'. Null/invalid falls back. */
    settingsTimezone?: string | null;
    /** Postgres `time`, e.g. '07:15:00'. Overrides the morning default. */
    settingsPreferredReminderTime?: string | null;
    settingsQuietHoursStart?: string | null;
    settingsQuietHoursEnd?: string | null;
}

export interface IReminderSchedule {
    /** The zone actually used — the fallback when the user's is missing or invalid. */
    timeZone: string;
    /** True when `settingsTimezone` was absent or unusable. Counted by the digest. */
    usedFallbackTimeZone: boolean;
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
 * Both delivery instants for one user, from one digest run.
 *
 * `at` is the moment the digest is deciding — passed in rather than read from
 * the clock so the DST and date-line cases are reachable from a test.
 */
export const resolveReminderSchedule = (
    preferences: IReminderPreferences,
    at: Date,
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

    const quietStart = parseTimeOfDay(preferences.settingsQuietHoursStart)
        ?? parseTimeOfDay(DEFAULT_QUIET_HOURS_START) as MinutesOfDay;
    const quietEnd = parseTimeOfDay(preferences.settingsQuietHoursEnd)
        ?? parseTimeOfDay(DEFAULT_QUIET_HOURS_END) as MinutesOfDay;

    const morningPreferred = parseTimeOfDay(preferences.settingsPreferredReminderTime)
        ?? parseTimeOfDay(DEFAULT_MORNING_LOCAL_TIME) as MinutesOfDay;
    const lastChancePreferred = parseTimeOfDay(DEFAULT_LAST_CHANCE_LOCAL_TIME) as MinutesOfDay;

    // ---- Morning slot -------------------------------------------------------
    // Rule 1: never in the past. Rule 2: never inside quiet hours — a slot that
    // lands there moves to the end of them, which is the next moment the user
    // has agreed to hear from us.
    let morningMinutes = Math.max(morningPreferred, local.minutesOfDay);
    let morningDayOffset = 0;

    // The quiet-hours clamp applies only when the slot had to be *moved* — i.e.
    // the preferred hour has already gone past locally. A preferred hour that is
    // still ahead is a time the user themselves asked for, and a default quiet
    // window has no business overriding it: someone who sets a 07:15 reminder
    // against the default 08:00 quiet-hours end means 07:15, and clamping it
    // would silently make their explicit setting do nothing.
    const isMorningAtPreferredHour = morningMinutes === morningPreferred;
    if (!isMorningAtPreferredHour && isWithinQuietHours(morningMinutes, quietStart, quietEnd)) {
        morningMinutes = quietEnd;
        // Late-evening decisions sit *after* quiet hours begin, so the next
        // quiet-hours end is tomorrow's. Early-morning ones are before it and
        // stay on today.
        if (local.minutesOfDay >= quietEnd) {
            morningDayOffset = 1;
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

    // An early sleeper's own quiet hours can begin before the default
    // last-chance time. Pull the slot earlier rather than dropping them from
    // the feature — the alternative silently excludes exactly the users who
    // bothered to set a preference.
    const latestUsable = quietStart > quietEnd
        ? quietStart - LAST_CHANCE_QUIET_BUFFER_MINUTES
        : MINUTES_PER_DAY - 1;
    const lastChanceMinutes = Math.min(
        Math.max(lastChancePreferred, local.minutesOfDay),
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
        localDate: local.date,
        morningAt,
        morningLocalDate: getLocalParts(resolvedZone, morningAt)?.date || local.date,
        lastChanceAt,
        lastChanceLocalDate: lastChanceAt
            ? getLocalParts(resolvedZone, lastChanceAt)?.date || local.date
            : null,
    };
};
