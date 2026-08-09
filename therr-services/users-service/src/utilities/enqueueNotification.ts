import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';

/**
 * The one entry point producers use to schedule a notification.
 *
 * Prefer this over calling `sendEmailAndOrPushNotification` inline whenever the
 * notification is *not* an immediate reaction to something the recipient will
 * see happen. Inline sending is still correct for tightly-coupled feedback (a
 * pact invite the sender is watching for); everything periodic, batched, or
 * deferred belongs in the queue, where it gets dedup, scheduling and the
 * per-user daily cap for free.
 *
 * See docs/NOTIFICATION_QUEUE_DESIGN.md.
 */

export interface IEnqueueNotificationArgs {
    brandVariation: BrandVariations | string;
    toUserId: string;
    type: PushNotifications.Types;
    /**
     * What makes this notification distinct — INCLUDING its period.
     *
     * This is the whole dedup mechanism, and the one thing a caller can get
     * wrong in a way that reintroduces duplicate sends. Rules of thumb:
     *
     *   - A once-per-day notification must contain the date:
     *       `streak-at-risk:<pactId>:2026-08-08`
     *   - A once-per-event notification must contain the event id and nothing
     *     time-varying:
     *       `pact-accepted:<pactId>:<memberId>`
     *   - Never interpolate `Date.now()` or a random value. That makes every
     *     enqueue unique, which silently turns dedup off.
     */
    dedupeKey: string;
    /** Forwarded verbatim to sendEmailAndOrPushNotification (habitName, streakCount, …). */
    payload?: Record<string, any>;
    /** Defaults to now(). Set it to defer — this is the send-time personalization hook. */
    scheduledFor?: Date;
}

/**
 * Returns true when a new row was queued, false when an identical one already
 * existed for this period. `false` is a normal outcome, not an error — it is
 * what makes a producer safe to re-run.
 *
 * Never throws. A producer is typically inside a request that must succeed
 * whether or not a notification gets scheduled, so failures are logged and
 * swallowed — matching how the existing inline send path already behaves.
 */
const enqueueNotification = async (args: IEnqueueNotificationArgs): Promise<boolean> => {
    try {
        const row = await Store.notificationQueue.enqueue(args.brandVariation, {
            userId: args.toUserId,
            type: String(args.type),
            dedupeKey: args.dedupeKey,
            payload: args.payload,
            scheduledFor: args.scheduledFor,
        });
        return !!row;
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to enqueue notification'],
            traceArgs: {
                'error.message': err?.message,
                'notificationQueue.type': String(args.type),
                'notificationQueue.dedupeKey': args.dedupeKey,
                'pushNotification.brandVariation': String(args.brandVariation),
                'user.id': args.toUserId,
                source: 'users-service',
            },
        });
        return false;
    }
};

export default enqueueNotification;
