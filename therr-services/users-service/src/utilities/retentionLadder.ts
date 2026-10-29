/**
 * Retention messaging at the measured drop-off points — the pure half.
 *
 * Decides, from a user's check-in history alone, which of four moments they are at and therefore
 * what the habits digest may say to them today. No database, no clock of its own: the digest
 * passes `today` in. `handlers/helpers/retentionMessaging.ts` does the reads and the sending.
 *
 * ## The evidence (production, 30 days to 2026-10-29, internal accounts excluded)
 *
 * Queued pushes sent to real users, by how many days the recipient had gone without a check-in:
 *
 *   | Days since last check-in | Sent | Opened |
 *   |--------------------------|------|--------|
 *   | 0–1                      |   62 |      0 |
 *   | 2                        |   54 |      0 |
 *   | 3–6                      |  166 |      0 |
 *   | 7–13                     |  226 |      0 |
 *   | 14+                      |  285 |      1 |
 *   | never checked in         |  109 |      0 |
 *
 * Opens are a weak signal here (one in 902; tap reporting is recent and needs a current build), so the case
 * is volume and returns, not open rate: 677 of the 902 — three in four — went to people already
 * three or more days gone. And people do come back from a gap, just rarely: of every gap between
 * two check-in days by a real user, 40 closed within 2 days and 14 after 3 or more (7 at 3–6
 * days, 6 at 7–13, 1 at 14+), while 35 users never returned at all. So from day 3
 * (`HABIT_LAPSE_BACKOFF_DAYS`) the daily reminder, streak-at-risk, last-chance and
 * partner-missed-day pushes stop, and a short comeback ladder (day 3, 7, 14 —
 * `HABIT_COMEBACK_LADDER_DAYS`) takes their place, aimed at the window those 14 returns came in.
 * After the last rung: silence.
 *
 * The other two moments are the cliffs either side of the first check-in: 111 of 125 real
 * accounts older than 35 days never completed one, and of those who did, 35 checked in on day 0
 * and 7 on days 1–2. Each gets one message, once ever: `first-checkin` and `day-two`.
 */
import { addDays, daysBetween } from './dailyStreak';

/** The copy variants the digest stamps on a `dailyHabitReminder` row (`payload.messageVariant`). */
export type RetentionMessageVariant = 'first-checkin' | 'day-two' | 'comeback' | 'comeback-no-bonus' | 'fresh-start';

export type RetentionState =
    /** Checked in within the back-off window, or not yet old enough to be judged. */
    | 'active'
    /** Has checked in before, but not for `lapseDays` or more. */
    | 'lapsed'
    /** Has never completed a check-in, and has had a habit for `lapseDays` or more. */
    | 'never-lapsed'
    /** Has never completed a check-in, and picked their first habit recently. */
    | 'never-new';

export interface IRetentionHistory {
    /** Most recent completed check-in, any habit (YYYY-MM-DD, the check-in's own local day). */
    lastCheckinDate: string | null;
    /** First-ever completed check-in, any habit. */
    firstCheckinDate: string | null;
    /** When they started their earliest still-active habit — the anchor for someone who never checked in. */
    firstHabitStartedDate: string | null;
}

export interface IRetentionClassification {
    state: RetentionState;
    /** Days since the last check-in, or since the first habit was started for someone who never checked in. */
    daysSince: number | null;
    /**
     * The date this lapse is measured from. Part of every comeback key, so a user who comes back
     * and lapses again later gets the ladder again — against the new lapse, not the old one.
     */
    anchorDate: string | null;
    /** Their first-ever check-in was yesterday: today is day 2, the 35 → 7 cliff. */
    isDayTwo: boolean;
}

const DEFAULT_LAPSE_DAYS = 3;
const DEFAULT_LADDER = [3, 7, 14];
/** How long the last rung stays sendable, so a skipped digest run delays it rather than drops it. */
export const COMEBACK_LAST_RUNG_WINDOW_DAYS = 7;

/**
 * Kill switch for the back-off. Defaults **on**: it is a volume *reduction*, and the table above
 * is the case for it. `HABIT_LAPSE_BACKOFF_ENABLED=false` restores daily nudges to everyone without
 * a deploy.
 */
export const isLapseBackoffEnabled = (): boolean => process.env.HABIT_LAPSE_BACKOFF_ENABLED !== 'false';

/**
 * Kill switch for the new messages (first-checkin, day-two, the comeback ladder). Defaults on:
 * each is at most once per user, or once per rung per lapse. Separate from the back-off so either
 * half can be turned off without the other — with this off and the back-off on, a lapsed user
 * simply hears nothing.
 */
export const areRetentionMessagesEnabled = (): boolean => process.env.HABIT_RETENTION_MESSAGES_ENABLED !== 'false';

/**
 * Days without a check-in after which a user counts as lapsed. Also the gap that earns the
 * comeback bonus (`handlers/helpers/dailyBonus.ts`), so the comeback copy's promise of one is
 * true by construction. An unparseable or non-positive value falls back to the default.
 */
export const getLapseBackoffDays = (): number => {
    const parsed = Number.parseInt(process.env.HABIT_LAPSE_BACKOFF_DAYS || '', 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_LAPSE_DAYS;
};

/**
 * The comeback ladder, in days since the last check-in. Comma-separated; sorted and de-duplicated
 * here. A rung below the back-off threshold is dropped — the user is still getting daily nudges
 * then, and a comeback message beside them would contradict one. An empty or garbled value falls
 * back to the default rather than to "no ladder", which would make the back-off pure silence.
 */
export const getComebackLadderDays = (lapseDays: number = getLapseBackoffDays()): number[] => {
    const raw = process.env.HABIT_COMEBACK_LADDER_DAYS;
    const parsed = (raw || '')
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((value) => Number.isFinite(value) && value >= lapseDays);
    const rungs = parsed.length ? parsed : DEFAULT_LADDER.filter((value) => value >= lapseDays);
    const unique = Array.from(new Set(rungs)).sort((a, b) => a - b);
    return unique.length ? unique : [lapseDays];
};

export const classifyRetention = (
    history: IRetentionHistory,
    today: string,
    lapseDays: number = getLapseBackoffDays(),
): IRetentionClassification => {
    const yesterday = addDays(today, -1);
    if (history.lastCheckinDate) {
        const daysSince = Math.max(0, daysBetween(history.lastCheckinDate, today));
        return {
            state: daysSince >= lapseDays ? 'lapsed' : 'active',
            daysSince,
            anchorDate: history.lastCheckinDate,
            isDayTwo: history.firstCheckinDate === yesterday,
        };
    }
    if (history.firstHabitStartedDate) {
        const daysSince = Math.max(0, daysBetween(history.firstHabitStartedDate, today));
        return {
            state: daysSince >= lapseDays ? 'never-lapsed' : 'never-new',
            daysSince,
            anchorDate: history.firstHabitStartedDate,
            isDayTwo: false,
        };
    }
    return {
        state: 'active', daysSince: null, anchorDate: null, isDayTwo: false,
    };
};

/** True when the daily check-in nudges should stop for this user. */
export const isBackedOff = (classification: IRetentionClassification): boolean => (
    classification.state === 'lapsed' || classification.state === 'never-lapsed'
);

/**
 * The comeback rung due today, or null. A rung is due from its own day until the next rung's
 * (the last one for `COMEBACK_LAST_RUNG_WINDOW_DAYS`), so a missed digest run sends it late rather
 * than never. Only the *highest* due rung is ever offered: a user found at day 9 gets the day-7
 * message, not a burst of day 3 and day 7. Past the last rung's window: null, permanently.
 */
export const getDueComebackRung = (daysSince: number | null, ladder: number[]): number | null => {
    if (daysSince === null || !ladder.length) {
        return null;
    }
    for (let i = ladder.length - 1; i >= 0; i -= 1) {
        const rung = ladder[i];
        const windowEnd = i === ladder.length - 1 ? rung + COMEBACK_LAST_RUNG_WINDOW_DAYS : ladder[i + 1];
        if (daysSince >= rung && daysSince < windowEnd) {
            return rung;
        }
    }
    return null;
};

/** True when the user is past the last rung's window — nothing more will be sent this lapse. */
export const isLadderExhausted = (daysSince: number | null, ladder: number[]): boolean => (
    daysSince !== null && !!ladder.length
        && daysSince >= ladder[ladder.length - 1] + COMEBACK_LAST_RUNG_WINDOW_DAYS
);

// ---- Ledger keys (habits.onboarding_messages.messageKey, and the queue dedupeKey) -------------
//
// Stable and clock-free (CLAUDE.md § Sibling Repos, rule 4). The once-ever messages carry no date
// at all; a comeback rung carries the lapse's anchor date, which is a fact about the user's
// history and does not change between runs.

export const FIRST_CHECKIN_MESSAGE_KEY = 'onboarding:first-checkin';
export const DAY_TWO_MESSAGE_KEY = 'retention:day-two';
export const comebackMessageKey = (anchorDate: string, rung: number): string => `retention:comeback:${anchorDate}:d${rung}`;
