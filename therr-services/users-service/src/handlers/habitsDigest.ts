import { RequestHandler } from 'express';
import { PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
import { getTodayDateString, normalizeDateString } from '../utilities/streakHelpers';

// Upper bound per run so a runaway pact count can't turn the digest into a
// multi-minute request. Raise (or page the query) when active pacts approach
// this number.
const DIGEST_MAX_PACTS = 500;
const PACT_EXPIRING_WARNING_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface IDigestCounters {
    pactsEvaluated: number;
    streakAtRiskSent: number;
    partnerMissedSent: number;
    pactExpiringSent: number;
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
 * Designed to be triggered once per day by an internal cron (e.g. a k8s
 * CronJob curling users-service directly). The route is deliberately NOT
 * registered in the API gateway, so it is unreachable from the public
 * internet. Running it more than once per day re-sends the same
 * notifications — schedule accordingly.
 */
const runDailyHabitsDigest: RequestHandler = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const counters: IDigestCounters = {
        pactsEvaluated: 0,
        streakAtRiskSent: 0,
        partnerMissedSent: 0,
        pactExpiringSent: 0,
        errors: 0,
    };

    const today = getTodayDateString();
    const yesterday = normalizeDateString(new Date(Date.now() - MS_PER_DAY));

    const sendPush = (toUserId: string, type: PushNotifications.Types, extras: any = {}) => sendEmailAndOrPushNotification(
        Store.users.findUser,
        req.headers,
        {
            authorization,
            locale,
            toUserId,
            type,
            whiteLabelOrigin,
            brandVariation,
            ...extras,
        },
    ).catch((err) => {
        counters.errors += 1;
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Habits digest: failed to send push'],
            traceArgs: { 'push.type': type, 'user.id': toUserId },
        });
    });

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
                        // eslint-disable-next-line no-await-in-loop
                        await Promise.all(members.map((member: any) => {
                            counters.pactExpiringSent += 1;
                            return sendPush(member.userId, PushNotifications.Types.pactExpiring, {
                                pactId: pact.id,
                                habitName,
                                daysRemaining,
                            });
                        }));
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
                            counters.streakAtRiskSent += 1;
                            // eslint-disable-next-line no-await-in-loop
                            await sendPush(member.userId, PushNotifications.Types.streakAtRisk, {
                                pactId: pact.id,
                                habitName,
                                streakCount: streak.currentStreak,
                            });
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
                        // eslint-disable-next-line no-await-in-loop
                        await Promise.all(otherMembers.map((other: any) => {
                            counters.partnerMissedSent += 1;
                            return sendPush(other.userId, PushNotifications.Types.partnerMissedDay, {
                                pactId: pact.id,
                                habitName,
                                partnerName,
                            });
                        }));
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
            traceArgs: { ...counters },
        });

        return res.status(200).send(counters);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABITS_DIGEST:ERROR' });
    }
};

export default runDailyHabitsDigest;
