/**
 * The weekly pledge verdict: one pass inside the daily habits digest (WORK_IN_PROGRESS § 2.8,
 * Phase A, #2990).
 *
 * On each pledged member's local Monday it judges the week that just closed
 * (`utilities/pledgeVerdict.ts` holds every rule) and, on a miss, queues one `pledgeMissed`
 * push reminding them of their own promise. No money moves in Phase A.
 *
 * It rides the daily digest for the reason the weekly recap does (see weeklyRecapDigest.ts):
 * "Monday" is a per-user fact, there is one scheduler firing, and running daily while asking each
 * member "is it your Monday?" gives every zone its own. The dedupe key is stamped with the week,
 * so a second run — or a second firing in the same week — inserts nothing.
 *
 * The population is small by construction (pledged members of running pacts), so it is read in
 * one query rather than paged, and only the Monday cohort is read further.
 */

import {
    BrandVariations,
    isMeasuredHabitGoal,
    PushNotifications,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IPledgedPactMemberRow } from '../../store/PactMembersStore';
import { addDays, getLocalDate, resolveCheckinTimeZone } from '../../utilities/dailyStreak';
import { getCadence } from '../../utilities/habitCadence';
import { resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import { judgePledgeWeek, pledgeMissedDedupeKey, PledgeVerdict } from '../../utilities/pledgeVerdict';
import { normalizeDateString } from '../../utilities/streakHelpers';
import { getRecapWeekStart, isRecapDay } from '../../utilities/weeklyRecap';
import { QueueRecapFn } from './weeklyRecapDigest';

/**
 * Kill switch. Defaults **on**: a member who pledged asked to be held to it, and the send volume is
 * bounded at one push per pledged pact per week. It stays a flag because it is still a send, and
 * this is the lever that stops it without a deploy.
 */
export const arePledgeVerdictsEnabled = (): boolean => process.env.HABIT_PLEDGE_VERDICTS_ENABLED !== 'false';

/** Upper bound per run. Reported via `pledgeMembersCapped` rather than silently truncated. */
export const PLEDGE_VERDICT_MAX_MEMBERS = 2000;

/** How far back to read streak history for the week. The week is seven days; this is slack. */
const STREAK_HISTORY_READ_LIMIT = 50;

export interface IPledgeVerdictCounters {
    /** Pledged members of running pacts. Zero means nobody has pledged, or the pass is off. */
    pledgeMembersEvaluated: number;
    /** Whose local day was a Monday — the ~1/7 the verdict counters below are about. */
    pledgeMembersOnVerdictDay: number;
    pledgeVerdictsKept: number;
    /** Fell short, but a streak freeze covered it. Must never notify. */
    pledgeVerdictsCovered: number;
    /** The pledge did not govern the whole week (set mid-week, pact or cadence started mid-week). */
    pledgeVerdictsNotJudged: number;
    pledgeMissesQueued: number;
    /** A miss already queued for the same week. A second run of the week lands entirely here. */
    pledgeMissesDeduped: number;
    /** A miss the member's own settings suppressed. */
    pledgeMissesMutedByPreference: number;
    pledgeErrors: number;
    /** True when the read hit PLEDGE_VERDICT_MAX_MEMBERS and there is very likely a tail unread. */
    pledgeMembersCapped: boolean;
}

export const EMPTY_PLEDGE_VERDICT_COUNTERS: IPledgeVerdictCounters = {
    pledgeMembersEvaluated: 0,
    pledgeMembersOnVerdictDay: 0,
    pledgeVerdictsKept: 0,
    pledgeVerdictsCovered: 0,
    pledgeVerdictsNotJudged: 0,
    pledgeMissesQueued: 0,
    pledgeMissesDeduped: 0,
    pledgeMissesMutedByPreference: 0,
    pledgeErrors: 0,
    pledgeMembersCapped: false,
};

const VERDICT_COUNTER: Record<
    Exclude<PledgeVerdict, 'missed'>,
    'pledgeVerdictsKept' | 'pledgeVerdictsCovered' | 'pledgeVerdictsNotJudged'
> = {
    kept: 'pledgeVerdictsKept',
    covered: 'pledgeVerdictsCovered',
    notJudged: 'pledgeVerdictsNotJudged',
};

/** Read everything one member's verdict needs and judge their week. */
const judgeMember = async (member: IPledgedPactMemberRow, goal: any, weekStart: string, timeZone: string): Promise<PledgeVerdict> => {
    const weekEnd = addDays(weekStart, 6);

    const [checkins, coveredDates, streak] = await Promise.all([
        Store.habitCheckins.getByUserAndDateRange(member.userId, weekStart, weekEnd, member.habitGoalId),
        Store.pactStreakDays.getCreditedDatesForPacts([member.pactId], weekStart, weekEnd),
        Store.streaks.getByUserAndHabit(member.userId, member.habitGoalId),
    ]);
    const history = streak ? await Store.streaks.getHistoryByStreakId(streak.id, STREAK_HISTORY_READ_LIMIT) : [];

    const completed = (checkins || []).filter((row: any) => row.status === 'completed');

    return judgePledgeWeek({
        weekStart,
        cadence: getCadence(goal),
        goal: { ...goal, isMeasured: isMeasuredHabitGoal(goal) },
        pledgedAt: member.pledge.pledgedAt,
        timeZone,
        pactStartDate: member.pactStartDate ? normalizeDateString(member.pactStartDate) : null,
        completedDates: new Set(completed.map((row: any) => normalizeDateString(row.scheduledDate))),
        coveredDates,
        weekAmount: completed.reduce((sum: number, row: any) => sum + (Number(row.savedAmount) || 0), 0),
        streak: streak ? {
            currentStreak: Number(streak.currentStreak) || 0,
            gracePeriodDays: Number(streak.gracePeriodDays) || 0,
            graceDaysUsed: Number(streak.graceDaysUsed) || 0,
        } : null,
        streakEvents: (history || []).map((event: any) => ({
            eventType: event.eventType,
            eventDate: normalizeDateString(event.eventDate),
        })),
    });
};

export const runPledgeVerdictPass = async (
    queuePush: QueueRecapFn,
    now: Date = new Date(),
): Promise<IPledgeVerdictCounters> => {
    const counters: IPledgeVerdictCounters = { ...EMPTY_PLEDGE_VERDICT_COUNTERS };

    if (!arePledgeVerdictsEnabled()) {
        return counters;
    }

    const members = await Store.pactMembers.getPledgedMembersForVerdict(PLEDGE_VERDICT_MAX_MEMBERS);
    counters.pledgeMembersEvaluated = members.length;
    counters.pledgeMembersCapped = members.length >= PLEDGE_VERDICT_MAX_MEMBERS;

    const dueMembers = members.filter((member) => member.pledge
        && isRecapDay(getLocalDate(resolveCheckinTimeZone(member.settingsTimezone), now)));
    counters.pledgeMembersOnVerdictDay = dueMembers.length;
    if (!dueMembers.length) {
        return counters;
    }

    const [goals, preferencesByUserId] = await Promise.all([
        Store.habitGoals.getByIds(Array.from(new Set(dueMembers.map((member) => member.habitGoalId)))),
        Store.users.getHabitReminderPreferences(Array.from(new Set(dueMembers.map((member) => member.userId)))),
    ]);
    const goalsById = new Map<string, any>((goals || []).map((goal: any) => [goal.id, goal]));

    // Concurrent across the cohort, like the recap pass. Counters are mutated inside, which is
    // safe: these are awaits on one thread, not parallel execution.
    await Promise.all(dueMembers.map(async (member) => {
        try {
            const goal = goalsById.get(member.habitGoalId);
            if (!goal) {
                counters.pledgeVerdictsNotJudged += 1;
                return;
            }

            const preferences = preferencesByUserId[member.userId] || {};
            const schedule = resolveReminderSchedule(preferences, now);
            const weekStart = getRecapWeekStart(schedule.localDate);

            const verdict = await judgeMember(member, goal, weekStart, schedule.timeZone);
            if (verdict !== 'missed') {
                counters[VERDICT_COUNTER[verdict]] += 1;
                return;
            }

            // The account-wide habits switch, honoured here so the row is never written — the
            // same call the weekly recap makes.
            if (preferences.settingsPushHabitReminders === false) {
                counters.pledgeMissesMutedByPreference += 1;
                return;
            }

            const outcome = await queuePush(
                member.userId,
                PushNotifications.Types.pledgeMissed,
                pledgeMissedDedupeKey(member.pactId, weekStart),
                {
                    pactId: member.pactId,
                    habitName: goal.name || '',
                    weekStartDate: weekStart,
                    pledgeAmount: member.pledge.amount,
                    charityKey: member.pledge.charityKey,
                },
                schedule.morningAt,
            );

            if (outcome === 'queued') {
                counters.pledgeMissesQueued += 1;
            } else if (outcome === 'duplicate') {
                counters.pledgeMissesDeduped += 1;
            } else {
                counters.pledgeErrors += 1;
            }
        } catch (err: any) {
            counters.pledgeErrors += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: failed to judge or queue a pledge verdict'],
                traceArgs: {
                    'user.id': member.userId,
                    'pact.id': member.pactId,
                    'pushNotification.brandVariation': String(BrandVariations.HABITS),
                },
            });
        }
    }));

    return counters;
};
