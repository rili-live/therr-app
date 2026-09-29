/**
 * The weekly pledge verdict (WORK_IN_PROGRESS § 2.8, Phase A, #2990): did a member who pledged
 * against a pact habit miss the Monday–Sunday week that just closed?
 *
 * Pure, so every rule below is pinned by a unit test rather than by a digest run. The digest
 * pass (`handlers/helpers/pledgeVerdictDigest.ts`) gathers the inputs and acts on the answer.
 *
 * THE TWO RULES
 *
 *   - A measured habit with a weekly target (`isMeasuredHabitGoal` plus a positive
 *     `targetAmount`) misses when the week's amount fell short of the target. The pledge was
 *     about the amount, so a streak freeze does not enter into it: a freeze covers a missed
 *     *day*, and says nothing about an amount.
 *   - Every other habit misses when its cadence was not met — `isPeriodSatisfied`, the one
 *     definition of "did you hold up your end" (utilities/habitCadence.ts). Days the pact
 *     carried (a majority of members checked in) count as done, exactly as they do for the
 *     member's streak.
 *
 * THE RULE THAT MUST NOT BE BROKEN
 *
 * A week a streak freeze covered is not a miss. The user was told, in advance, that the first
 * bad day happens inside the rules (§ 2.6.4). A pledge that called that same day a failure
 * would contradict the promise the app already made them — and, for Phase B, charge them for it.
 *
 * Freezes are spent lazily, at the next check-in after a gap, so at week close the days of a
 * missed week fall into two groups:
 *
 *   - **Settled** — days before the last check-in inside the week. The check-in that closed
 *     their gap already decided them, and `habits.streak_history` recorded how: `grace_used`
 *     (a freeze saved the streak) or `missed` (it reset). A reset inside the week is a miss;
 *     otherwise the settled days are covered only if a freeze was actually recorded for them.
 *   - **Trailing** — required days after the last check-in, which nothing has judged yet. They
 *     are covered if the freezes the member holds right now would cover them when they next
 *     check in, which is what that check-in will do — unless it already happened, on the Monday
 *     before this verdict ran, in which case its own `grace_used` / `missed` event (dated that
 *     Monday) is the answer. A weekly quota is always trailing: the
 *     check-in flow only judges a quota week once it has closed.
 *
 * When the streak is at zero there is nothing for a freeze to save, and the check-in flow
 * spends none (`habitCheckins.ts` only evaluates a gap when `currentStreak > 0`), so nothing
 * is covered.
 *
 * WHEN A WEEK IS NOT JUDGED AT ALL
 *
 * Only weeks the pledge governed from their first day. A pledge set on Wednesday first applies
 * the following Monday; a pact that started mid-week, or a cadence changed mid-week, likewise
 * waits for the next full week. Every miss must be something the member saw coming.
 */

import {
    addDays,
    getLocalDate,
    getWeekStart,
    isDateString,
} from './dailyStreak';
import {
    Cadence,
    getCadenceEffectiveFrom,
    getDayOfWeekSundayFirst,
    getWeekDates,
    isPeriodSatisfied,
    ICadenceSource,
} from './habitCadence';

export type PledgeVerdict =
    /** The pledge did not govern the whole week, so the week is not the pledge's to judge. */
    | 'notJudged'
    /** The week met its target or its cadence. */
    | 'kept'
    /** The week fell short, but a streak freeze covered it — or will, at the next check-in. */
    | 'covered'
    /** The week fell short and nothing covered it. The one verdict that notifies. */
    | 'missed';

export interface IPledgeWeekInput {
    /** The Monday of the closed week, YYYY-MM-DD, in the member's own zone. */
    weekStart: string;
    cadence: Cadence;
    goal: ICadenceSource & { isMeasured: boolean; targetAmount?: number | string | null };
    /** When the pledge was set (ISO 8601) and the member's zone, to find its local day. */
    pledgedAt: string;
    timeZone: string;
    /** The pact's first day, YYYY-MM-DD, or null. */
    pactStartDate: string | null;
    /** Local dates in the week with a completed check-in on this habit. */
    completedDates: Set<string>;
    /** Local dates in the week the pact carried (pact_streak_days). */
    coveredDates: Set<string>;
    /** Sum of the week's recorded amounts on this habit. */
    weekAmount: number;
    /** The member's streak on this habit, or null when none exists. */
    streak: { currentStreak: number; gracePeriodDays: number; graceDaysUsed: number } | null;
    /**
     * `habits.streak_history` events for this streak, from the week onward. Events dated after
     * the week matter: a check-in on the Monday itself, before this verdict ran, may already
     * have judged the week's trailing gap — and it dates its event on the check-in day.
     */
    streakEvents: { eventType: string; eventDate: string }[];
}

/** The pledge's local start day, or null when `pledgedAt` is unusable. */
const getPledgeLocalDate = (pledgedAt: string, timeZone: string): string | null => {
    const at = new Date(pledgedAt);
    if (Number.isNaN(at.getTime())) {
        return null;
    }
    return getLocalDate(timeZone, at);
};

/** The dedupe key for one member's pledge verdict on one week. Period-stamped, no clock. */
export const pledgeMissedDedupeKey = (pactId: string, weekStart: string): string => `pledge-missed:${pactId}:${weekStart}`;

/** Required days of a day-unit cadence (daily or fixed weekdays) that the week left undone. */
const getUnmetRequiredDays = (cadence: Cadence, weekStart: string, done: Set<string>): string[] => getWeekDates(weekStart)
    .filter((date) => cadence.kind === 'daily'
        || (cadence.kind === 'weekdays' && cadence.days.includes(getDayOfWeekSundayFirst(date))))
    .filter((date) => !done.has(date));

export const judgePledgeWeek = (input: IPledgeWeekInput): PledgeVerdict => {
    const {
        weekStart,
        cadence,
        goal,
        streak,
    } = input;

    if (!isDateString(weekStart) || getWeekStart(weekStart) !== weekStart) {
        return 'notJudged';
    }

    const pledgedOn = getPledgeLocalDate(input.pledgedAt, input.timeZone);
    if (!pledgedOn || pledgedOn > weekStart) {
        return 'notJudged';
    }
    if (input.pactStartDate && input.pactStartDate > weekStart) {
        return 'notJudged';
    }
    const effectiveFrom = getCadenceEffectiveFrom(goal);
    if (effectiveFrom && effectiveFrom > weekStart) {
        return 'notJudged';
    }

    const targetAmount = Number(goal.targetAmount);
    if (goal.isMeasured && Number.isFinite(targetAmount) && targetAmount > 0) {
        return input.weekAmount >= targetAmount ? 'kept' : 'missed';
    }

    const done = new Set<string>([...input.completedDates, ...input.coveredDates]);
    if (isPeriodSatisfied(cadence, weekStart, done)) {
        return 'kept';
    }

    if (!streak || streak.currentStreak <= 0) {
        return 'missed';
    }

    const weekEnd = addDays(weekStart, 6);
    const eventsInWeek = input.streakEvents.filter((event) => event.eventDate >= weekStart && event.eventDate <= weekEnd);
    if (eventsInWeek.some((event) => event.eventType === 'missed')) {
        return 'missed';
    }

    // The trailing gap may already be settled. The first check-in after the week closed judges
    // it — spending freezes (`grace_used`) or resetting the streak (`missed`) — and dates the
    // event on that check-in's own day. A member who checks in on Monday before this pass
    // reaches them has already spent the freeze, so `freezesHeld` below no longer counts it.
    const judgedAfterWeek = input.streakEvents
        .filter((event) => event.eventDate > weekEnd
            && (event.eventType === 'grace_used' || event.eventType === 'missed'))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];

    const freezesHeld = Math.max(0, (streak.gracePeriodDays || 0) - (streak.graceDaysUsed || 0));
    const trailingCoverable = (trailingCount: number): boolean => {
        if (trailingCount <= 0) {
            return true;
        }
        return judgedAfterWeek
            ? judgedAfterWeek.eventType === 'grace_used'
            : trailingCount <= freezesHeld;
    };

    if (cadence.kind === 'weeklyQuota') {
        // One missed period, judged at the next check-in — trailing by definition.
        return trailingCoverable(1) ? 'covered' : 'missed';
    }

    const lastCompleted = [...input.completedDates]
        .filter((date) => date >= weekStart && date <= weekEnd)
        .sort()
        .pop();
    const unmet = getUnmetRequiredDays(cadence, weekStart, done);
    const settled = lastCompleted ? unmet.filter((date) => date < lastCompleted) : [];
    const trailing = lastCompleted ? unmet.filter((date) => date > lastCompleted) : unmet;

    if (settled.length) {
        const freezeRecorded = eventsInWeek.some((event) => event.eventType === 'grace_used'
            && event.eventDate > settled[0]
            && event.eventDate <= (lastCompleted as string));
        if (!freezeRecorded) {
            return 'missed';
        }
    }

    return trailingCoverable(trailing.length) ? 'covered' : 'missed';
};
