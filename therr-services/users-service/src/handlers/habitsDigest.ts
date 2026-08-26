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
import { getTodayDateString, normalizeDateString } from '../utilities/streakHelpers';

// Upper bound per run so a runaway pact count can't turn the digest into a
// multi-minute request. Raise (or page the query) when active pacts approach
// this number.
const DIGEST_MAX_PACTS = 500;
const PACT_EXPIRING_WARNING_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
    // row filed under '' would sit pending forever. Pacts are a HABITS feature,
    // so a missing header (a hand-run curl) means habits, not "unknown".
    const brand = brandVariation || BrandVariations.HABITS;

    const counters: IDigestCounters = {
        pactsEvaluated: 0,
        pactsExpired: 0,
        streakAtRiskSent: 0,
        partnerMissedSent: 0,
        pactExpiringSent: 0,
        deduped: 0,
        errors: 0,
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

                    // Lifecycle: milestones, maintenance check-ins and comeback
                    // offers. Runs once per (user, habit) per digest, before the
                    // nudge below, because its decision is what decides whether
                    // that nudge is allowed to go out at all.
                    const key = pairKey(member.userId, pact.habitGoalId);
                    const decision = lifecycle.decisions[key];
                    if (decision && !lifecycleHandled.has(key)) {
                        lifecycleHandled.add(key);
                        const dayCount = lifecycle.ages[key] || 0;
                        const { consistencyPercent } = decision;
                        const delivered: { maintenanceStage?: number; comeback?: boolean } = {};

                        if (decision.milestone === 'established') {
                            // Keyed on the date the taper happened: a habit that
                            // lapses and is rebuilt earns this again, and should.
                            // eslint-disable-next-line no-await-in-loop
                            const queued = await queuePush(
                                member.userId,
                                PushNotifications.Types.habitEstablished,
                                `habit-established:${pact.habitGoalId}:${today}`,
                                {
                                    habitId: pact.habitGoalId, habitName, dayCount, consistencyPercent,
                                },
                            );
                            if (queued) counters.habitEstablishedSent += 1;
                        }

                        if (decision.milestone === 'automaticity') {
                            // eslint-disable-next-line no-await-in-loop
                            const queued = await queuePush(
                                member.userId,
                                PushNotifications.Types.habitAutomaticity,
                                `habit-automaticity:${pact.habitGoalId}:${today}`,
                                {
                                    habitId: pact.habitGoalId, habitName, dayCount, consistencyPercent,
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
                            // eslint-disable-next-line no-await-in-loop
                            const outcome = await queuePushOutcome(
                                member.userId,
                                PushNotifications.Types.habitMaintenanceCheckIn,
                                `habit-maintenance:${pact.habitGoalId}:${anchor}:${decision.maintenanceDue}`,
                                {
                                    habitId: pact.habitGoalId,
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
                            // eslint-disable-next-line no-await-in-loop
                            const outcome = await queuePushOutcome(
                                member.userId,
                                PushNotifications.Types.habitComeback,
                                `habit-comeback:${pact.habitGoalId}:${today}`,
                                {
                                    habitId: pact.habitGoalId,
                                    habitName,
                                    bestStreakCount: lifecycle.bestStreaks[key] || 0,
                                },
                            );
                            if (outcome === 'queued') counters.comebackSent += 1;
                            if (outcome !== 'failed') delivered.comeback = true;
                        }

                        // eslint-disable-next-line no-await-in-loop
                        await persistPhaseDecision(member.userId, pact.habitGoalId, decision, today, delivered)
                            .catch((err: any) => {
                                counters.errors += 1;
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: [err?.message, 'Habits digest: failed to persist habit phase'],
                                    traceArgs: { 'user.id': member.userId, habitGoalId: pact.habitGoalId },
                                });
                            });
                    }

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
