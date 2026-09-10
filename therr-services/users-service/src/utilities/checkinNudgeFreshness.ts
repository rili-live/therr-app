import { PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { INotificationQueueRow } from '../store/NotificationQueueStore';

/**
 * "Is this check-in nudge still worth sending?", asked at send time.
 *
 * ## Why a producer-side decision is not enough
 *
 * Every other notification in the queue is a fact: a partner checked in, a pact
 * ended, a milestone was crossed. Those are still true whenever the row drains.
 * A check-in nudge is the opposite — it is a statement about something the user
 * has *not yet done*, and the whole point of scheduling it for their local
 * evening is that hours pass between deciding and sending.
 *
 * In those hours the user very often does the thing. Sending "last chance,
 * your 12-day streak is on the line" to someone who checked in at lunchtime is
 * not a small blemish: it is the single fastest way to teach someone that the
 * app's reminders do not know what they have done, which is the same lesson
 * that makes people turn notifications off. `docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`
 * is explicit that past a point frequency *reduces* DAU, and a wrong
 * notification costs more than an extra one.
 *
 * So the gate is not an optimisation. It is what makes deferring a nudge into
 * the evening safe at all, and it is the reason the digest is allowed to queue
 * a second reminder per day without that being spam.
 *
 * ## What it checks
 *
 * The producer stamps the row with the habit goals the nudge covers and the
 * local calendar date it lands on. This re-reads `habits.habit_checkins` for
 * exactly those pairs on that date, in one query, and suppresses the row only
 * when **every** habit it names is already complete. A partial completion still
 * sends — there is something left to do, and the copy names the count.
 *
 * ## Fail open, deliberately
 *
 * A read failure returns "send". The alternative — swallowing the notification
 * when the database hiccups — turns an infrastructure blip into silence that
 * nobody would ever notice, on the feature whose entire purpose is not being
 * silent. A duplicate-feeling nudge is visible and recoverable; a missing one
 * is neither.
 *
 * Rows queued before this landed carry no `habitGoalIds`, so they pass through
 * unchanged rather than being suppressed for lack of evidence.
 */

/**
 * The types whose relevance can expire between queueing and sending.
 *
 * All three are the same notification wearing different copy — the digest's
 * per-user roll-up picks between them (`utilities/checkinNudgeRollup.ts`) — so
 * they share one gate. Nothing else in the queue belongs here: a `pactEnded` or
 * a `streakMilestone` is a fact about the past and is still true tonight.
 */
export const CHECKIN_NUDGE_TYPES: Set<string> = new Set([
    String(PushNotifications.Types.streakAtRisk),
    String(PushNotifications.Types.dailyHabitReminder),
    String(PushNotifications.Types.eveningCheckIn),
]);

export interface IFreshnessDecision {
    shouldSend: boolean;
    /** Recorded on the skipped row, so suppression is measurable rather than invisible. */
    reason?: string;
}

const SEND: IFreshnessDecision = { shouldSend: true };

export const isCheckinNudgeType = (type: string): boolean => CHECKIN_NUDGE_TYPES.has(type);

const readHabitGoalIds = (payload: Record<string, any> | null | undefined): string[] => {
    const raw = payload?.habitGoalIds;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((id): id is string => typeof id === 'string' && !!id);
};

/**
 * Decide whether a claimed queue row should still go out.
 *
 * Only ever consulted for `CHECKIN_NUDGE_TYPES`; every other type returns
 * `shouldSend` without touching the database.
 */
const evaluateCheckinNudgeFreshness = async (row: INotificationQueueRow): Promise<IFreshnessDecision> => {
    if (!isCheckinNudgeType(row.type)) {
        return SEND;
    }

    const habitGoalIds = readHabitGoalIds(row.payload);
    const checkinDate = row.payload?.checkinDate;

    // A producer that predates the stamp, or one that could not resolve a goal.
    // Sending is the old behaviour and the safe one.
    if (!habitGoalIds.length || typeof checkinDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkinDate)) {
        return SEND;
    }

    try {
        const completed = await Store.habitCheckins.getCompletedOnDateForPairs(
            habitGoalIds.map((habitGoalId) => ({ userId: row.userId, habitGoalId })),
            checkinDate,
        );

        // Every habit named is done. There is nothing left for the user to act
        // on, so the honest output is no notification.
        if (completed.size >= habitGoalIds.length) {
            return {
                shouldSend: false,
                reason: `already-checked-in (${completed.size}/${habitGoalIds.length} on ${checkinDate})`,
            };
        }

        return SEND;
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Notification queue: check-in freshness read failed; sending anyway'],
            traceArgs: {
                'error.message': err?.message,
                'notificationQueue.id': row.id,
                'notificationQueue.type': row.type,
                'user.id': row.userId,
                source: 'users-service',
            },
        });
        return SEND;
    }
};

export default evaluateCheckinNudgeFreshness;
