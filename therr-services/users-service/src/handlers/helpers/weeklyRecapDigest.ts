/**
 * The weekly recap producer: one pass inside the daily habits digest.
 *
 * ## Why it rides the daily digest instead of a weekly scheduler job
 *
 * "Monday" is a per-user fact, not a global one. There is exactly one Cloud
 * Scheduler firing (therr-messaging-automator, docs/CROSS_REPO_INTEGRATION.md)
 * and no timezone bucketing anywhere in this codebase; a weekly job would fire
 * on Monday in one zone and be a day out for roughly half the world. Running
 * daily and asking each user "is it your Monday?" gets every zone its own
 * Monday as that single instant sweeps across them — the same shape
 * `evaluateAllDailyStreaks` already uses, for the same reason.
 *
 * It also means no second trigger path, which is the standing rule for this
 * digest. A run that happens twice in a day inserts nothing the second time:
 * the dedupe key is stamped with the *week*, not the day.
 *
 * ## Who gets one
 *
 * A user who did something in the week being recapped. A recap reading
 * "0 check-ins, 0 perfect days" is a report card for a week the user already
 * knows went badly, and the lapsed-user path (`habitComeback`, via the phase
 * engine) exists precisely to say something more useful to that person. The
 * gate is `totals.checkinCount > 0`, counted and reported so a suspiciously
 * quiet run can be told apart from a broken one.
 */

import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { EnqueueOutcome } from '../../utilities/enqueueNotification';
import { getLocalDate, resolveCheckinTimeZone } from '../../utilities/dailyStreak';
import { resolveReminderSchedule } from '../../utilities/localReminderSchedule';
import {
    getRecapWeekStart,
    isRecapDay,
    weeklyRecapDedupeKey,
} from '../../utilities/weeklyRecap';
import { buildWeeklyRecap } from './weeklyRecap';

/**
 * Kill switch. Defaults **on**: the recap is additive — it reaches users on a
 * day the digest already touches them, and the per-user 5/day cap in
 * notificationQueueWorker still bounds the total. It stays a flag because it is
 * a send-volume increase, and this is the lever that stops it without a deploy.
 */
export const areWeeklyRecapsEnabled = (): boolean => process.env.HABIT_WEEKLY_RECAPS_ENABLED !== 'false';

/** Page size for the user sweep. Matches EVALUATE_ALL_PAGE_SIZE in helpers/dailyStreak.ts. */
const RECAP_PAGE_SIZE = 200;

export interface IWeeklyRecapCounters {
    /** Users considered. Every user with a habit streak row is walked; most are not on their Monday. */
    recapUsersEvaluated: number;
    /** Users whose local day was the start of a week — the ~1/7 the rest of the counters are about. */
    recapUsersOnRecapDay: number;
    recapsQueued: number;
    /** Already queued for the same week. A second run of the week lands entirely here. */
    recapsDeduped: number;
    /** Skipped because the week held no completed check-in. Expected and healthy; see the header. */
    recapsSkippedEmptyWeek: number;
    /** Skipped because the user turned habit pushes off. */
    recapsMutedByPreference: number;
    recapErrors: number;
}

export const EMPTY_WEEKLY_RECAP_COUNTERS: IWeeklyRecapCounters = {
    recapUsersEvaluated: 0,
    recapUsersOnRecapDay: 0,
    recapsQueued: 0,
    recapsDeduped: 0,
    recapsSkippedEmptyWeek: 0,
    recapsMutedByPreference: 0,
    recapErrors: 0,
};

/** What the pass needs from the digest: its enqueue function, already pinned to the HABITS brand. */
export type QueueRecapFn = (
    toUserId: string,
    type: PushNotifications.Types,
    dedupeKey: string,
    extras: Record<string, any>,
    scheduledFor: Date | undefined,
) => Promise<EnqueueOutcome>;

export const runWeeklyRecapPass = async (
    queueRecap: QueueRecapFn,
    now: Date = new Date(),
): Promise<IWeeklyRecapCounters> => {
    const counters: IWeeklyRecapCounters = { ...EMPTY_WEEKLY_RECAP_COUNTERS };

    if (!areWeeklyRecapsEnabled()) {
        return counters;
    }

    let afterUserId: string | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const targets = await Store.userDailyStreaks.getEvaluationTargets(RECAP_PAGE_SIZE, afterUserId);
        if (!targets.length) {
            break;
        }
        counters.recapUsersEvaluated += targets.length;

        // Narrow to this page's Monday cohort before reading anything else. The
        // zone comes off the same join the sweep already returns, so deciding
        // here costs no query — and it is what keeps the recap's cost at one
        // seventh of the user base per run rather than all of it.
        const dueTargets = targets.filter((target) => {
            const timeZone = resolveCheckinTimeZone(target.settingsTimezone);
            return isRecapDay(getLocalDate(timeZone, now));
        });
        counters.recapUsersOnRecapDay += dueTargets.length;

        if (dueTargets.length) {
            // One read for the page's preferences, same reason the check-in
            // nudge drain batches: a per-user lookup turns a background pass
            // into one round trip per user against the read pool. A failure
            // degrades to "no preferences", which means the fallback zone and
            // default quiet hours — the behaviour every notification here had
            // before local scheduling existed.
            // eslint-disable-next-line no-await-in-loop
            const preferencesByUserId = await Store.users
                .getHabitReminderPreferences(dueTargets.map((target) => target.userId))
                .catch((err: any) => {
                    counters.recapErrors += 1;
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [err?.message, 'Habits digest: failed to read preferences for the weekly recap pass'],
                    });
                    return {};
                });

            // Concurrent across the page, serial across pages — the same shape
            // `evaluateAllDailyStreaks` uses, and for the same reason. Each
            // recap is four reads, so walking the Monday cohort one user at a
            // time would add a round trip's latency per user to a digest that
            // is already the longest request this service serves. The page size
            // bounds the concurrency, and the cohort is roughly a seventh of it.
            //
            // Counters are mutated inside, which is safe: these are awaits on a
            // single thread, not parallel execution.
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(dueTargets.map(async (target) => {
                const preferences = preferencesByUserId[target.userId] || {};

                try {
                    // The user's own kill switch, honoured here rather than at
                    // the worker so the row is never written. A recap is not a
                    // reminder, but someone who turned habit pushes off did not
                    // mean "except on Mondays".
                    if (preferences.settingsPushHabitReminders === false) {
                        counters.recapsMutedByPreference += 1;
                        return;
                    }

                    const schedule = resolveReminderSchedule(preferences, now);
                    const weekStartDate = getRecapWeekStart(schedule.localDate);

                    const recap = await buildWeeklyRecap({
                        userId: target.userId,
                        weekStartDate,
                        timeZone: schedule.timeZone,
                        now,
                    });

                    if (recap.totals.checkinCount === 0) {
                        counters.recapsSkippedEmptyWeek += 1;
                        return;
                    }

                    // Delivered in the user's morning slot — the same instant
                    // the daily nudge targets. The two can collide, and that is
                    // handled where it belongs: the queue worker's minimum
                    // spacing defers whichever it drains second by 15 minutes
                    // rather than sending both in the same breath.
                    //
                    // The copy fields are the *only* numbers the push may cite.
                    // Everything else the screen shows is re-read when the user
                    // taps, so a recap that took a week to be opened is still
                    // accurate; these three are a snapshot and are never
                    // re-derived on the device.
                    const outcome = await queueRecap(
                        target.userId,
                        PushNotifications.Types.weeklyRecap,
                        weeklyRecapDedupeKey(weekStartDate),
                        {
                            weekStartDate,
                            // Which story to tell, decided once (see
                            // utilities/weeklyRecap.ts) so the push body and the
                            // screen's header cannot contradict each other.
                            recapHeadline: recap.headline,
                            checkinCount: recap.totals.checkinCount,
                            perfectDays: recap.totals.upheldDays,
                            streakCount: recap.streakAtWeekEnd,
                            habitName: recap.topHabit?.name || '',
                            habitCount: recap.habits.length,
                        },
                        schedule.morningAt,
                    );

                    if (outcome === 'queued') {
                        counters.recapsQueued += 1;
                    } else if (outcome === 'duplicate') {
                        counters.recapsDeduped += 1;
                    } else {
                        counters.recapErrors += 1;
                    }
                } catch (err: any) {
                    counters.recapErrors += 1;
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [err?.message, 'Habits digest: failed to build or queue a weekly recap'],
                        traceArgs: {
                            'user.id': target.userId,
                            'pushNotification.brandVariation': String(BrandVariations.HABITS),
                        },
                    });
                }
            }));
        }

        afterUserId = targets[targets.length - 1].userId;
    }

    return counters;
};
