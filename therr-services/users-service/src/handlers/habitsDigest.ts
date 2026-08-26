import { RequestHandler } from 'express';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import enqueueNotification, { EnqueueOutcome } from '../utilities/enqueueNotification';
import handleHttpError from '../utilities/handleHttpError';
import {
    buildHabitLifecycleContext,
    isPhaseEngineEnabled,
    pairKey,
    persistPhaseDecision,
    EMPTY_LIFECYCLE_CONTEXT,
    IHabitPair,
} from '../utilities/habitLifecycleContext';
import { getTodayDateString, isHabitDueToday, normalizeDateString } from '../utilities/streakHelpers';
import { IUserHabitReminderRow } from '../store/UserHabitsStore';

// Upper bound per run so a runaway pact count can't turn the digest into a
// multi-minute request. Raise (or page the query) when active pacts approach
// this number.
export const DIGEST_MAX_PACTS = 500;
// The reminder pass is per *habit*, not per pact, and most users track more
// habits than they hold pacts — so this is deliberately several times
// DIGEST_MAX_PACTS. Same contract: raise it (or page the query) when the active
// habit count approaches the cap, rather than letting the run silently cover
// only the oldest habits.
export const DIGEST_MAX_HABITS = 2000;
const PACT_EXPIRING_WARNING_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Kill switch for the daily reminder pass.
 *
 * Defaults **on**, unlike HABIT_PHASE_ENGINE_ENABLED, and for the opposite
 * reason: the phase engine deploys dark because turning it on *removes*
 * reminders from users who get them today, while this pass exists precisely
 * because the users it covers get nothing at all today — a solo habit, or a
 * habit whose streak is at zero, reached no notification path before it. A flag
 * defaulting off would ship the fix and leave the silence in place.
 *
 * It stays a flag because it is the one lever that raises send volume: set
 * HABIT_DAILY_REMINDERS_ENABLED=false to stop the pass without a deploy. Note
 * that the per-user 5/day cap in notificationQueueWorker still applies on top,
 * and nothing is delivered at all unless NOTIFICATION_QUEUE_WORKER_ENABLED is
 * true.
 */
const areDailyRemindersEnabled = (): boolean => process.env.HABIT_DAILY_REMINDERS_ENABLED !== 'false';

interface IDigestCounters {
    pactsEvaluated: number;
    // Pacts whose window had passed and that this run closed out. Additive to
    // the shape therr-messaging-automator logs, so an older automator simply
    // does not print it.
    pactsExpired: number;
    // Retained under their original names because therr-messaging-automator logs
    // this exact shape (see its IHabitsDigestCounters). They now count rows
    // *queued*, not pushes sent — the worker decides what actually goes out.
    streakAtRiskSent: number;
    partnerMissedSent: number;
    pactExpiringSent: number;
    // Notifications this run decided on that were already queued for the same
    // period. On a second run of the same day every one of the three types
    // lands here instead, which is what makes re-running the digest a no-op.
    // Only genuine constraint conflicts land here — a failed enqueue is an
    // `error`, so "zeros + deduped" stays a reliable signal for "already ran".
    deduped: number;
    errors: number;
    // Daily reminder pass. `habitsEvaluated` counts rows read from
    // habits.user_habits, so a zero here means the pass is disabled or nobody is
    // tracking a habit — which is the distinction worth drawing first when the
    // complaint is "no notifications". `dailyRemindersSent` counts rows queued.
    habitsEvaluated: number;
    dailyRemindersSent: number;
    // Habits skipped because today is not one of their scheduled days (a 3x/week
    // habit on an off day). Reported so a suspiciously quiet run can be told
    // apart from a mis-parsed cadence.
    remindersNotDue: number;
    // True when the run read exactly DIGEST_MAX_PACTS / DIGEST_MAX_HABITS rows,
    // i.e. the LIMIT was reached and there is very likely a tail this run never
    // looked at. Both queries order oldest-first, so the rows that fall off the
    // end belong to the *newest* users — precisely the cohort the reminder pass
    // exists to reach. Without these flags that tail goes dark silently: the
    // counters keep rising, nothing errors, and the run still looks healthy.
    pactsCapped: boolean;
    habitsCapped: boolean;
    // Lifecycle engine (docs/HABIT_LIFECYCLE_MESSAGING.md). All zero when
    // HABIT_PHASE_ENGINE_ENABLED is not 'true', which is also how a reader tells
    // a run with the engine off from one where nobody happened to cross a gate.
    phasesEvaluated: number;
    habitEstablishedSent: number;
    habitAutomaticitySent: number;
    maintenanceCheckInSent: number;
    comebackSent: number;
    // Nudges the taper suppressed. The single most important number here: it is
    // the only direct evidence the engine is reducing send volume rather than
    // merely adding new message types on top of the existing ones.
    nudgesTapered: number;
}

/**
 * Daily partner-activity digest — the scheduled half of the HABITS
 * accountability loop. Event-driven pushes (partnerCheckedIn, pactAccepted)
 * only fire when someone acts; this job covers the silence:
 *
 *  - streakAtRisk  → to each member with an active streak who hasn't
 *                    completed today's check-in (run it in the evening).
 *  - partnerMissedDay → to the other members when a member failed to
 *                    complete yesterday's check-in.
 *  - pactExpiring  → to all active members when the pact ends within 3 days.
 *
 * It also sweeps pacts whose window has passed into `expired` before reading
 * the active set — see the sweep below.
 *
 * Designed to be triggered once per day by an internal cron (today, a Cloud
 * Scheduler job poking therr-messaging-automator). The route is deliberately
 * NOT registered in the API gateway, so it is unreachable from the public
 * internet.
 *
 * SAFE TO RE-RUN. This handler decides *what* to notify; it queues rather than
 * sends, and every dedupe key it writes is stamped with the period it belongs
 * to, so a second run in the same day collides on
 * `main.notificationQueue`'s UNIQUE (brandVariation, userId, dedupeKey) and
 * inserts nothing. That constraint replaces the standing "never add a second
 * trigger path" convention — a retry, an overlapping scheduler firing or a
 * manual curl now costs a wasted read pass rather than a duplicate push.
 * The keys are the whole mechanism: see docs/NOTIFICATION_QUEUE_DESIGN.md.
 */
const runDailyHabitsDigest: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    // main.notificationQueue deliberately has no default for brandVariation, and
    // the worker only ever claims rows under a known BrandVariations value — a
    // row filed under '' would sit pending forever.
    //
    // Pinned to HABITS rather than taken from the header. Everything this handler
    // reads lives in the `habits.*` schema, which carries no brandVariation column
    // precisely because the whole schema belongs to Friends with Habits (see the
    // archetype note in 20260815000001_habits.user_habits.js). Every row it acts on
    // is a HABITS row regardless of what the caller claims to be.
    //
    // `enqueueNotification`, though, files rows under whatever brand it is given,
    // and brandVariation leads the UNIQUE (brandVariation, userId, dedupeKey)
    // constraint. A wrong header would therefore write habit reminders into another
    // brand's partition, where they dedupe against the wrong keys and are claimed by
    // the wrong app's worker — with nothing failing anywhere.
    //
    // Coerced rather than rejected. The one production caller
    // (therr-messaging-automator's habitsDigest.ts) hardcodes
    // `x-brand-variation: habits`, so a mismatch is a misconfiguration — but this
    // pass exists because a cohort of users was getting no notification at all, and
    // answering 400 would put them back there. Filing under the correct brand and
    // logging the discrepancy keeps the reminders flowing and still makes it visible.
    const brand = BrandVariations.HABITS;
    if (brandVariation && brandVariation !== BrandVariations.HABITS) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: [
                `Habits digest called with x-brand-variation '${brandVariation}'; `
                + 'the habits schema is single-brand, so notifications were filed under '
                + `'${BrandVariations.HABITS}' regardless. Check the caller's headers.`,
            ],
            traceArgs: { 'pushNotification.brandVariation': String(brandVariation) },
        });
    }

    const counters: IDigestCounters = {
        pactsEvaluated: 0,
        pactsExpired: 0,
        streakAtRiskSent: 0,
        partnerMissedSent: 0,
        pactExpiringSent: 0,
        deduped: 0,
        errors: 0,
        habitsEvaluated: 0,
        dailyRemindersSent: 0,
        remindersNotDue: 0,
        pactsCapped: false,
        habitsCapped: false,
        phasesEvaluated: 0,
        habitEstablishedSent: 0,
        habitAutomaticitySent: 0,
        maintenanceCheckInSent: 0,
        comebackSent: 0,
        nudgesTapered: 0,
    };

    const today = getTodayDateString();
    const yesterday = normalizeDateString(new Date(Date.now() - MS_PER_DAY));

    /**
     * Resolves true when a row was queued. `enqueueNotification` never throws, so
     * a queue failure is reported rather than aborting the pact loop — but it is
     * counted under `errors`, NOT under `deduped`. The two are the same "nothing
     * was inserted" from here, and conflating them would make a dead queue (no
     * table, exhausted write pool) report as a clean second run of the day, which
     * is precisely the distinction the caller uses these counters to draw.
     */
    const queuePushOutcome = async (
        toUserId: string,
        type: PushNotifications.Types,
        dedupeKey: string,
        extras: Record<string, any> = {},
    ): Promise<EnqueueOutcome> => {
        const outcome = await enqueueNotification({
            brandVariation: brand,
            toUserId,
            type,
            dedupeKey,
            // The worker reads `locale` and `whiteLabelOrigin` off the payload
            // when it builds the send, so they have to travel with the row —
            // by the time it drains, this request's headers are long gone.
            payload: { ...extras, locale, whiteLabelOrigin },
        });
        if (outcome === 'duplicate') {
            counters.deduped += 1;
        } else if (outcome === 'failed') {
            counters.errors += 1;
        }
        return outcome;
    };

    /**
     * Boolean form, for the notifications whose only job is to be counted.
     *
     * The lifecycle notifications use `queuePushOutcome` directly because they
     * must distinguish 'duplicate' from 'failed': a duplicate means the row is
     * already queued and the user's maintenance stage should advance, while a
     * failure must leave that stage open so the next run retries it. Collapsing
     * the two to a boolean here would silently consume a check-in nobody sent.
     */
    const queuePush = async (
        toUserId: string,
        type: PushNotifications.Types,
        dedupeKey: string,
        extras: Record<string, any> = {},
    ): Promise<boolean> => (await queuePushOutcome(toUserId, type, dedupeKey, extras)) === 'queued';

    try {
        // Close out pacts whose window has passed, before anything reads the
        // active set.
        //
        // `PactsStore.expire()`, `PactsStore.getExpiredPacts()` and
        // `pactHelpers.shouldExpirePact` have all existed since the pact schema
        // landed and nothing has ever called any of them, so a pact reached its
        // endDate and simply stayed `active` forever: still drawing digest
        // reads, still rendering as in-flight, still counting against the
        // one-live-pact-per-habit rule that gates renewal.
        //
        // Sweeping first is what stops a pact being warned that it expires in
        // zero days on the same run that ends it. A failure here is logged and
        // the digest continues — an unswept pact is the behaviour every run
        // before this one had.
        const expiredPacts = await Store.pacts.getExpiredPacts().catch((err: any) => {
            counters.errors += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: failed to read expired pacts'],
            });
            return [] as any[];
        });
        // eslint-disable-next-line no-restricted-syntax
        for (const expiring of expiredPacts) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await Store.pacts.expire(expiring.id);
                counters.pactsExpired += 1;
            } catch (err: any) {
                counters.errors += 1;
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message, 'Habits digest: failed to expire pact'],
                    traceArgs: { pactId: expiring.id },
                });
            }
        }

        const activePacts = await Store.pacts.get({ status: 'active' }, undefined, DIGEST_MAX_PACTS);
        counters.pactsCapped = activePacts.length >= DIGEST_MAX_PACTS;
        if (counters.pactsCapped) {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: [
                    'Habits digest: active pact count reached DIGEST_MAX_PACTS — '
                    + 'pacts beyond the limit were not evaluated in this run',
                ],
                traceArgs: { 'habitsDigest.limit': DIGEST_MAX_PACTS },
            });
        }
        const habitNameCache = new Map<string, string>();
        const userNameCache = new Map<string, string>();

        const getHabitName = async (habitGoalId: string): Promise<string> => {
            if (!habitNameCache.has(habitGoalId)) {
                const goal = await Store.habitGoals.getById(habitGoalId).catch(() => null);
                habitNameCache.set(habitGoalId, goal?.name || 'your habit');
            }
            return habitNameCache.get(habitGoalId) as string;
        };

        const getUserDisplayName = async (userId: string): Promise<string> => {
            if (!userNameCache.has(userId)) {
                const rows = await Store.users.findUser({ id: userId }, ['userName', 'firstName']).catch(() => []);
                userNameCache.set(userId, rows?.[0]?.firstName || rows?.[0]?.userName || 'Your partner');
            }
            return userNameCache.get(userId) as string;
        };

        // Membership is resolved up front rather than inside the notification
        // loop so the lifecycle engine can batch-load its four reads across
        // every (user, habit) pair in the run. Doing it lazily would make the
        // engine O(members · pacts) queries and undo the flat read-pool profile
        // this job's sequential structure exists to protect.
        const pactRecords: { pact: any; members: any[] }[] = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const pact of activePacts) {
            counters.pactsEvaluated += 1;
            try {
                // eslint-disable-next-line no-await-in-loop
                const members = (await Store.pactMembers.getByPactId(pact.id))
                    .filter((m: any) => m.status === 'active');
                if (members.length) {
                    pactRecords.push({ pact, members });
                }
            } catch (err: any) {
                counters.errors += 1;
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message, 'Habits digest: failed to load pact members'],
                    traceArgs: { pactId: pact.id },
                });
            }
        }

        // Every habit anyone is actively tracking — the spine of the reminder
        // pass below, and the reason a solo habit is now reachable at all.
        //
        // Read before the lifecycle context is built so these pairs can be part
        // of it: a solo habit has the same phases as a pact-backed one, and
        // evaluating it here is what stops the new reminder from ignoring the
        // taper that docs/HABIT_LIFECYCLE_MESSAGING.md exists to enforce.
        //
        // A failure is logged and the run continues with no reminder pass. The
        // partner-accountability notifications are the older, load-bearing half
        // of this job and must not be taken down by the newer one.
        const remindableHabits = areDailyRemindersEnabled()
            ? await Store.userHabits.getActiveForReminders(today, DIGEST_MAX_HABITS).catch((err: any) => {
                counters.errors += 1;
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message, 'Habits digest: failed to read trackable habits'],
                });
                return [] as IUserHabitReminderRow[];
            })
            : [];
        counters.habitsEvaluated = remindableHabits.length;
        counters.habitsCapped = remindableHabits.length >= DIGEST_MAX_HABITS;
        if (counters.habitsCapped) {
            // The reminder pass orders by `startedAt ASC`, so the habits that fall
            // off the end are the most recently started ones — new users, who are
            // exactly who a daily reminder is meant to retain. Raise the limit or
            // page the query; do not let this warning become routine.
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: [
                    'Habits digest: trackable habit count reached DIGEST_MAX_HABITS — '
                    + 'the newest habits were not evaluated in this run',
                ],
                traceArgs: { 'habitsDigest.limit': DIGEST_MAX_HABITS },
            });
        }

        // One lifecycle decision per (user, habit), deduplicated across pacts:
        // a user pursuing one goal through two pacts has one habit, and must
        // taper, celebrate and be checked in on exactly once.
        const engineEnabled = isPhaseEngineEnabled();
        const uniquePairs = new Map<string, IHabitPair>();
        if (engineEnabled) {
            pactRecords.forEach(({ pact, members }) => {
                members.forEach((member: any) => {
                    uniquePairs.set(pairKey(member.userId, pact.habitGoalId), {
                        userId: member.userId,
                        habitGoalId: pact.habitGoalId,
                    });
                });
            });
            remindableHabits.forEach((habit) => {
                uniquePairs.set(pairKey(habit.userId, habit.habitGoalId), {
                    userId: habit.userId,
                    habitGoalId: habit.habitGoalId,
                });
            });
        }
        const lifecycle = engineEnabled
            ? await buildHabitLifecycleContext([...uniquePairs.values()], today)
            : EMPTY_LIFECYCLE_CONTEXT;
        counters.phasesEvaluated = Object.keys(lifecycle.decisions).length;

        // Tracks which (user, habit) pairs have already had their lifecycle
        // notifications queued and their phase persisted this run. Without it a
        // user in two pacts on the same goal would be processed twice; the
        // queue's dedupe key would still stop the duplicate *push*, but the
        // second pass would also write `lastComebackAt` and advance the
        // maintenance stage a second time.
        const lifecycleHandled = new Set<string>();

        /**
         * (user, habit) pairs the pact loop has already spoken to about today's
         * check-in. The daily-reminder pass reads it to stay out of the way:
         * `streakAtRisk` is the stronger, streak-aware message and wins wherever
         * both apply.
         */
        const nudgedPairs = new Set<string>();

        /**
         * Milestones, maintenance check-ins and the comeback offer for one
         * (user, habit) pair — plus the phase write that records what was
         * delivered.
         *
         * Lifted out of the pact loop because the lifecycle belongs to the *habit*,
         * not to the pact: a solo habit has exactly the same phases, and until the
         * daily-reminder pass below existed there was simply no code path that
         * reached one. `lifecycleHandled` keeps it to once per pair per run, which
         * matters in both directions now — a user pursuing one goal through two
         * pacts, and a habit visited by both the pact loop and the reminder pass.
         */
        const queueLifecycleNotifications = async (
            userId: string,
            habitGoalId: string,
            habitName: string,
        ): Promise<void> => {
            const key = pairKey(userId, habitGoalId);
            const decision = lifecycle.decisions[key];
            if (!decision || lifecycleHandled.has(key)) {
                return;
            }
            lifecycleHandled.add(key);
            const dayCount = lifecycle.ages[key] || 0;
            const { consistencyPercent } = decision;
            const delivered: { maintenanceStage?: number; comeback?: boolean } = {};

            if (decision.milestone === 'established') {
                // Keyed on the date the taper happened: a habit that
                // lapses and is rebuilt earns this again, and should.
                const queued = await queuePush(
                    userId,
                    PushNotifications.Types.habitEstablished,
                    `habit-established:${habitGoalId}:${today}`,
                    {
                        habitId: habitGoalId, habitName, dayCount, consistencyPercent,
                    },
                );
                if (queued) counters.habitEstablishedSent += 1;
            }

            if (decision.milestone === 'automaticity') {
                const queued = await queuePush(
                    userId,
                    PushNotifications.Types.habitAutomaticity,
                    `habit-automaticity:${habitGoalId}:${today}`,
                    {
                        habitId: habitGoalId, habitName, dayCount, consistencyPercent,
                    },
                );
                if (queued) counters.habitAutomaticitySent += 1;
            }

            if (decision.maintenanceDue !== undefined) {
                const anchor = lifecycle.rows[key]?.establishedAt
                    ? normalizeDateString(lifecycle.rows[key].establishedAt as string)
                    : today;
                // The anchor is in the key so that a habit which
                // lapsed and re-established can receive the 30/60/90
                // sequence again against its new establishment,
                // rather than colliding with the old cycle's keys.
                const outcome = await queuePushOutcome(
                    userId,
                    PushNotifications.Types.habitMaintenanceCheckIn,
                    `habit-maintenance:${habitGoalId}:${anchor}:${decision.maintenanceDue}`,
                    {
                        habitId: habitGoalId,
                        habitName,
                        dayCount: decision.maintenanceDue,
                        consistencyPercent,
                    },
                );
                if (outcome === 'queued') counters.maintenanceCheckInSent += 1;
                // 'duplicate' counts as delivered: the row is already
                // in the queue for this stage, so advancing is right.
                // Only a hard failure leaves the stage open to retry.
                if (outcome !== 'failed') delivered.maintenanceStage = decision.maintenanceDue;
            }

            if (decision.comebackDue) {
                const outcome = await queuePushOutcome(
                    userId,
                    PushNotifications.Types.habitComeback,
                    `habit-comeback:${habitGoalId}:${today}`,
                    {
                        habitId: habitGoalId,
                        habitName,
                        bestStreakCount: lifecycle.bestStreaks[key] || 0,
                    },
                );
                if (outcome === 'queued') counters.comebackSent += 1;
                if (outcome !== 'failed') delivered.comeback = true;
            }

            await persistPhaseDecision(userId, habitGoalId, decision, today, delivered)
                .catch((err: any) => {
                    counters.errors += 1;
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [err?.message, 'Habits digest: failed to persist habit phase'],
                        traceArgs: { 'user.id': userId, habitGoalId },
                    });
                });
        };

        // Sequential per pact keeps DB pressure flat; the run is a background
        // job where total wall time matters far less than read-pool spikes.
        // eslint-disable-next-line no-restricted-syntax
        for (const { pact, members } of pactRecords) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const habitName = await getHabitName(pact.habitGoalId);

                // Pact expiring soon → warn every active member (once per run)
                if (pact.endDate) {
                    const daysRemaining = Math.ceil((new Date(pact.endDate).getTime() - Date.now()) / MS_PER_DAY);
                    if (daysRemaining > 0 && daysRemaining <= PACT_EXPIRING_WARNING_DAYS) {
                        // Keyed on the date rather than on daysRemaining: the pact
                        // is meant to warn once a day for its last three days, and
                        // a run either side of midnight would otherwise compute a
                        // different daysRemaining for the same calendar day and
                        // queue a second warning.
                        // eslint-disable-next-line no-await-in-loop
                        const queued = await Promise.all(members.map((member: any) => queuePush(
                            member.userId,
                            PushNotifications.Types.pactExpiring,
                            `pact-expiring:${pact.id}:${today}`,
                            {
                                pactId: pact.id,
                                habitName,
                                daysRemaining,
                            },
                        )));
                        counters.pactExpiringSent += queued.filter(Boolean).length;
                    }
                }

                // eslint-disable-next-line no-restricted-syntax
                for (const member of members) {
                    // eslint-disable-next-line no-await-in-loop
                    const [todayCheckins, yesterdayCheckins] = await Promise.all([
                        Store.habitCheckins.getByUserAndDate(member.userId, today, pact.habitGoalId),
                        Store.habitCheckins.getByUserAndDate(member.userId, yesterday, pact.habitGoalId),
                    ]);
                    const completedToday = (todayCheckins || []).some((c: any) => c.status === 'completed');
                    const completedYesterday = (yesterdayCheckins || []).some((c: any) => c.status === 'completed');

                    // Read here rather than inside the nudge below because both
                    // the taper check and `nudgedPairs` need them.
                    const key = pairKey(member.userId, pact.habitGoalId);
                    const decision = lifecycle.decisions[key];

                    // Lifecycle: milestones, maintenance check-ins and comeback
                    // offers. Runs once per (user, habit) per digest, before the
                    // nudge below, because its decision is what decides whether
                    // that nudge is allowed to go out at all.
                    // eslint-disable-next-line no-await-in-loop
                    await queueLifecycleNotifications(member.userId, pact.habitGoalId, habitName);

                    // Evening nudge: streak on the line and no check-in yet today.
                    //
                    // Gated on the lifecycle decision. With the engine off there
                    // is no decision and this behaves exactly as before — daily,
                    // for anyone with a live streak. With it on, someone who has
                    // demonstrably built the habit gets this every third day, and
                    // someone past the automaticity gate stops getting it.
                    if (!completedToday) {
                        // eslint-disable-next-line no-await-in-loop
                        const streak = await Store.streaks.getByUserAndHabit(member.userId, pact.habitGoalId);
                        if (streak && streak.isActive && streak.currentStreak > 0) {
                            // Claimed either way — queued, tapered or failed. The
                            // reminder pass below covers every tracked habit,
                            // including this one, and must not follow a streak
                            // warning with a generic "get your streak going".
                            nudgedPairs.add(key);
                            if (decision && !decision.allowsDailyNudge) {
                                counters.nudgesTapered += 1;
                            } else {
                                // eslint-disable-next-line no-await-in-loop
                                const queued = await queuePush(
                                    member.userId,
                                    PushNotifications.Types.streakAtRisk,
                                    `streak-at-risk:${pact.id}:${today}`,
                                    {
                                        pactId: pact.id,
                                        habitName,
                                        streakCount: streak.currentStreak,
                                        // Selects the body that names the safety
                                        // net. Telling someone their streak is on
                                        // the line while silently holding a freeze
                                        // that would cover tonight is the loss
                                        // aversion without the rule it belongs to.
                                        freezesRemaining: Math.max(
                                            0,
                                            (streak.gracePeriodDays || 0) - (streak.graceDaysUsed || 0),
                                        ),
                                    },
                                );
                                if (queued) {
                                    counters.streakAtRiskSent += 1;
                                }
                            }
                        }
                    }

                    // Accountability: tell the other members their partner
                    // slipped yesterday. Skip brand-new members whose pact
                    // started today/yesterday (joinedAt after yesterday).
                    const memberJoinedAt = member.joinedAt || member.createdAt;
                    const joinedBeforeYesterday = !memberJoinedAt
                        || normalizeDateString(memberJoinedAt) < yesterday;
                    if (!completedYesterday && joinedBeforeYesterday) {
                        // eslint-disable-next-line no-await-in-loop
                        const partnerName = await getUserDisplayName(member.userId);
                        const otherMembers = members.filter((m: any) => m.userId !== member.userId);
                        // The key names the member who slipped, not the recipient:
                        // the recipient is already part of the unique constraint,
                        // and without the slipping member in the key a pact where
                        // two partners both missed yesterday would queue only the
                        // first notification.
                        // eslint-disable-next-line no-await-in-loop
                        const queued = await Promise.all(otherMembers.map((other: any) => queuePush(
                            other.userId,
                            PushNotifications.Types.partnerMissedDay,
                            `partner-missed-day:${pact.id}:${member.userId}:${yesterday}`,
                            {
                                pactId: pact.id,
                                habitName,
                                partnerName,
                            },
                        )));
                        counters.partnerMissedSent += queued.filter(Boolean).length;
                    }
                }
            } catch (err: any) {
                counters.errors += 1;
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message, 'Habits digest: failed to evaluate pact'],
                    traceArgs: { pactId: pact.id },
                });
            }
        }

        // ------------------------------------------------------------------
        // Daily habit reminder.
        //
        // The pact loop above can only reach someone through an active pact,
        // and only warns them when a live streak is on the line. That leaves
        // the two cohorts most in need of a nudge with no notification path at
        // all: someone tracking a habit on their own, and someone whose streak
        // sits at zero because they are new or just broke one. This pass covers
        // both, off habits.user_habits.
        //
        // `dailyHabitReminder` is a *display* notification rather than the
        // data-only shape streakAtRisk uses, so the OS renders it with no JS
        // involved — which is what makes it land for an app that is not running.
        //
        // Everything it skips, it skips for a reason worth stating:
        //   - already checked in today   → nothing to remind about
        //   - not due today              → a 3x/week habit on an off day
        //   - tapered by the phase engine → the habit is established; backing
        //                                   off is the whole point of the engine
        //   - already nudged above       → streakAtRisk said it better
        // eslint-disable-next-line no-restricted-syntax
        for (const habit of remindableHabits) {
            const key = pairKey(habit.userId, habit.habitGoalId);

            try {
                // Lifecycle first, and unconditionally — before every gate
                // below, including the check-in one.
                //
                // A solo habit had no code path into the engine at all until
                // now, and the day someone crosses the establish gate is
                // usually a day they *did* check in: gating this on
                // `completedToday` would withhold the milestone from exactly
                // the run that earned it, and leave `habits.habit_phases`
                // un-advanced with it. Idempotent per pair per run via
                // `lifecycleHandled`, so this is a no-op for anything the pact
                // loop already handled.
                // eslint-disable-next-line no-await-in-loop
                await queueLifecycleNotifications(habit.userId, habit.habitGoalId, habit.goalName);

                if (habit.completedToday || nudgedPairs.has(key)) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                if (!isHabitDueToday(habit, today)) {
                    counters.remindersNotDue += 1;
                    // eslint-disable-next-line no-continue
                    continue;
                }

                const decision = lifecycle.decisions[key];
                if (decision && !decision.allowsDailyNudge) {
                    counters.nudgesTapered += 1;
                    // eslint-disable-next-line no-continue
                    continue;
                }

                nudgedPairs.add(key);

                if (habit.streakIsActive && Number(habit.currentStreak) > 0) {
                    // A solo habit with a live streak gets the same loss-aversion
                    // copy a pact-backed one does. Keyed on the habit rather than
                    // a pact because there is no pact — and because the lifecycle
                    // for this pair is habit-keyed too.
                    // eslint-disable-next-line no-await-in-loop
                    const queued = await queuePush(
                        habit.userId,
                        PushNotifications.Types.streakAtRisk,
                        `streak-at-risk:habit:${habit.habitGoalId}:${today}`,
                        {
                            habitId: habit.habitGoalId,
                            pactId: habit.activePactId || undefined,
                            habitName: habit.goalName,
                            streakCount: Number(habit.currentStreak),
                            freezesRemaining: Math.max(
                                0,
                                Number(habit.gracePeriodDays || 0) - Number(habit.graceDaysUsed || 0),
                            ),
                        },
                    );
                    if (queued) counters.streakAtRiskSent += 1;
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    const queued = await queuePush(
                        habit.userId,
                        PushNotifications.Types.dailyHabitReminder,
                        `daily-habit-reminder:${habit.habitGoalId}:${today}`,
                        {
                            habitId: habit.habitGoalId,
                            pactId: habit.activePactId || undefined,
                            habitName: habit.goalName,
                        },
                    );
                    if (queued) counters.dailyRemindersSent += 1;
                }
            } catch (err: any) {
                counters.errors += 1;
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message, 'Habits digest: failed to evaluate habit reminder'],
                    traceArgs: { 'user.id': habit.userId, habitGoalId: habit.habitGoalId },
                });
            }
        }

        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Habits daily digest completed'],
            // The brand is worth logging now that it decides which partition of
            // the queue these rows land in — and therefore whether the worker
            // ever picks them up.
            traceArgs: { ...counters, 'pushNotification.brandVariation': String(brand) },
        });

        return res.status(200).send(counters);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABITS_DIGEST:ERROR' });
    }
};

export default runDailyHabitsDigest;
