import { RequestHandler } from 'express';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import enqueueNotification from '../utilities/enqueueNotification';
import handleHttpError from '../utilities/handleHttpError';
import { getTodayDateString, normalizeDateString } from '../utilities/streakHelpers';

// Upper bound per run so a runaway pact count can't turn the digest into a
// multi-minute request. Raise (or page the query) when active pacts approach
// this number.
const DIGEST_MAX_PACTS = 500;
const PACT_EXPIRING_WARNING_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface IDigestCounters {
    pactsEvaluated: number;
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
        streakAtRiskSent: 0,
        partnerMissedSent: 0,
        pactExpiringSent: 0,
        deduped: 0,
        errors: 0,
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
    const queuePush = async (
        toUserId: string,
        type: PushNotifications.Types,
        dedupeKey: string,
        extras: Record<string, any> = {},
    ): Promise<boolean> => {
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
        return outcome === 'queued';
    };

    try {
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

        // Sequential per pact keeps DB pressure flat; the run is a background
        // job where total wall time matters far less than read-pool spikes.
        // eslint-disable-next-line no-restricted-syntax
        for (const pact of activePacts) {
            counters.pactsEvaluated += 1;
            try {
                // eslint-disable-next-line no-await-in-loop
                const members = (await Store.pactMembers.getByPactId(pact.id))
                    .filter((m: any) => m.status === 'active');
                if (!members.length) {
                    // eslint-disable-next-line no-continue
                    continue;
                }
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

                    // Evening nudge: streak on the line and no check-in yet today
                    if (!completedToday) {
                        // eslint-disable-next-line no-await-in-loop
                        const streak = await Store.streaks.getByUserAndHabit(member.userId, pact.habitGoalId);
                        if (streak && streak.isActive && streak.currentStreak > 0) {
                            // eslint-disable-next-line no-await-in-loop
                            const queued = await queuePush(
                                member.userId,
                                PushNotifications.Types.streakAtRisk,
                                `streak-at-risk:${pact.id}:${today}`,
                                {
                                    pactId: pact.id,
                                    habitName,
                                    streakCount: streak.currentStreak,
                                },
                            );
                            if (queued) {
                                counters.streakAtRiskSent += 1;
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
