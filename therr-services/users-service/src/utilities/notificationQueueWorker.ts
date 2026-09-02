import { BrandVariations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { INotificationQueueRow } from '../store/NotificationQueueStore';
import sendEmailAndOrPushNotification, { resolveDeviceTokenForBrand } from './sendEmailAndOrPushNotification';
import evaluateCheckinNudgeFreshness from './checkinNudgeFreshness';

/**
 * Drains main.notificationQueue and sends what is due.
 *
 * WHY IT LIVES HERE, not in therr-messaging-automator
 *
 * Sending needs the notification copy, all three locales, the per-brand Firebase
 * app, the Android channel routing and the brand intent actions — everything in
 * push-notifications-service, reached through `sendEmailAndOrPushNotification`.
 * A Cloud Function that sent directly would have to duplicate that surface in a
 * repo with no CI checking the coupling (docs/CROSS_REPO_INTEGRATION.md). The
 * automator stays a *clock* that pokes this service; the send stays behind it.
 *
 * WHY NOT pg-boss
 *
 * pg-boss self-migrates its own `pgboss` schema at boot, outside the Knex
 * migration system that `therr/require-idempotent-migration` and the
 * expand/contract discipline exist to protect — in a database two sibling repos
 * read directly. What we actually needed from it (dedup, delayed scheduling,
 * bounded retry, SKIP LOCKED) is a unique index and the ~150 lines in
 * NotificationQueueStore. Revisit if job types multiply or workflows appear.
 *
 * SHAPE
 *
 * A single interval timer, started from index.ts and cleared on SIGTERM. Each
 * tick claims a bounded batch per brand, sends, and records the outcome. Ticks
 * never overlap: `isTicking` skips a tick that arrives while the previous one is
 * still going, which matters because a slow push service would otherwise stack
 * ticks until the pod runs out of connections.
 */

// Tunables. Deliberately module constants rather than env vars for now: nothing
// has run in production yet, so there is no operational experience to configure
// against, and an env var implies a knob someone has reason to turn.
const TICK_INTERVAL_MS = 30 * 1000;
const CLAIM_BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3;
const REQUEUE_BATCH_SIZE = 25;

// The safety valve on send frequency. docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md
// caps at 3-5/day per user across all types and notes that past that point
// frequency *reduces* DAU. 5 is the top of that range, enforced here rather than
// trusted to each producer, because a cap that every caller has to remember is
// not a cap.
const MAX_SENDS_PER_USER_PER_DAY = 5;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Types the daily cap may DELAY but must never DROP.
 *
 * The cap drops rather than defers, and the reasoning for that is sound for
 * everything it was written against: those notifications recur, their dedupe
 * keys are stamped with the day, and a reminder arriving a day late is worse
 * than one that never arrives. Tomorrow's row is queued tomorrow regardless.
 *
 * A once-ever notification inverts every part of that. `pact-ended` is keyed on
 * the pact alone (`pact-ended:<pactId>`, the only dateless key any producer in
 * this service builds — every other one ends in a date), because a pact ends
 * exactly once and a date would let two sweeps announce it twice. The same
 * property means a dropped row is never re-queued: the member is simply never
 * told their cycle closed, and the renew CTA that is the entire reason the push
 * is sent at that moment goes with it. Late is strictly better than never here,
 * because the thing it announces stays true.
 *
 * Membership rule for anything added later: a type belongs here if and only if
 * its dedupe key carries no date. That is what makes a drop permanent.
 */
export const UNCAPPABLE_TYPES: Set<string> = new Set(['pact-ended']);

/**
 * How long an uncappable row waits for the cap window to open before it is sent
 * over the cap.
 *
 * The window is a rolling 24h, so a user at their limit today usually has room
 * within hours. A user who is genuinely at 5/day every day would defer forever
 * without this bound, which would reproduce the exact failure the exemption
 * exists to prevent -- silence, just arrived at more slowly. Exceeding the cap
 * by one, once per pact, is the smaller cost.
 */
const MAX_CAP_DEFERRAL_MS = 24 * 60 * 60 * 1000;

/**
 * How long to wait before re-testing the cap for a deferred uncappable row.
 * Hourly: the window rolls continuously, and this is one row and one COUNT.
 */
const CAP_DEFERRAL_RETRY_MS = 60 * 60 * 1000;

/**
 * Minimum gap between two notifications to the same user.
 *
 * The daily cap bounds the *number* of notifications; it says nothing about
 * their spacing, and a tick claims 25 rows and sends them sequentially in a few
 * hundred milliseconds. So a user with four due rows got four pushes in the
 * same second, which reads as a malfunction however reasonable each one is on
 * its own. The digest's per-user roll-up removes most of that volume at the
 * source; this covers what is left — a partner check-in landing on top of a
 * pact-expiring warning landing on top of a milestone.
 *
 * Deferred, never dropped: unlike the daily cap (where a reminder arriving a
 * day late is worse than none), everything reaching this rule is still timely
 * fifteen minutes from now.
 */
const MIN_GAP_BETWEEN_SENDS_MS = 15 * 60 * 1000;

/**
 * How long a row may be held back by spacing before it goes out regardless.
 *
 * Without a horizon, a user who keeps receiving notifications could push a
 * low-priority row out indefinitely. Six hours is chosen so a nudge queued by
 * the evening digest still lands the same evening.
 */
const MAX_DEFERRAL_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Send order within a claimed batch.
 *
 * `claimDue` orders by `scheduledFor`, which for a digest run is the same
 * timestamp for every row — so the order is effectively arbitrary, and with
 * spacing in play the *first* row is the one that goes out now while the rest
 * wait. That makes ordering user-visible: a "you hit 30 days!" celebration
 * should not delay tonight's "your streak is on the line" by fifteen minutes.
 *
 * Lower sorts first. Anything unlisted sorts last, which is the right default
 * for a new type nobody has thought about yet.
 */
const TYPE_SEND_PRIORITY: Record<string, number> = {
    'streak-at-risk': 0,
    // The "last chance" nudge, scheduled for the user's local evening. Ranked
    // alongside `streak-at-risk` rather than with the reminders because by the
    // time it is due there are only hours left in the user's day: deferring it
    // fifteen minutes behind a celebration is deferring it past the point it
    // means anything.
    'evening-check-in': 0,
    'daily-habit-reminder': 1,
    // Ahead of the recurring reminders on purpose. The daily cap *drops* what it
    // cannot send (see `sendOne`), on the reasoning that a reminder arriving a
    // day late is worse than none -- which is true of everything else in this
    // map and false of this one. `pact-ended` is keyed without a date because a
    // pact ends exactly once, so a dropped row is never re-queued and the member
    // is simply never told their cycle closed, losing the renew CTA that is the
    // whole reason the notification is sent at that moment.
    'pact-ended': 1,
    'pact-expiring': 2,
    'pact-invitation': 2,
    'partner-checked-in': 3,
    'partner-missed-day': 3,
    'habit-maintenance-check-in': 4,
    'habit-comeback': 4,
};
const DEFAULT_SEND_PRIORITY = 100;

export const compareBySendPriority = (a: INotificationQueueRow, b: INotificationQueueRow): number => {
    const priorityA = TYPE_SEND_PRIORITY[a.type] ?? DEFAULT_SEND_PRIORITY;
    const priorityB = TYPE_SEND_PRIORITY[b.type] ?? DEFAULT_SEND_PRIORITY;
    if (priorityA !== priorityB) {
        return priorityA - priorityB;
    }
    // Stable within a priority: oldest first, matching claimDue's own ordering.
    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
};

// Retention. Sweeping on its own slow cadence rather than every tick: this is
// housekeeping, and running it 120 times an hour would spend far more write-pool
// time on DELETEs than on sends.
const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_BATCH_SIZE = 500;
// Must stay comfortably longer than RATE_WINDOW_MS — `countSentSince` reads
// 'sent' rows to enforce the daily cap, so deleting them inside that window
// would hand a user back their budget early.
const COMPLETED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
// Failed rows outlive completed ones. They are the only record that a send was
// attempted and lost, and they are the ones worth finding when someone asks why
// a notification never arrived.
const FAILED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;
let isTicking = false;
let lastRetentionSweepAt = 0;

const sendOne = async (row: INotificationQueueRow): Promise<void> => {
    // Relevance first, before the rate-limit budget is even consulted.
    //
    // A check-in nudge is the one thing in this queue that can stop being true
    // between being queued and being due: the digest decides in the morning and
    // the "last chance" row is scheduled for the user's local evening, and in
    // between the user very often checks in. Suppressing here rather than at
    // enqueue time is the whole reason a second daily reminder is not spam —
    // see checkinNudgeFreshness for why it fails open.
    //
    // Ordered ahead of the daily cap deliberately: a row that no longer needs
    // sending must not consume one of the user's five sends, or an irrelevant
    // nudge would crowd out a timely notification later the same day.
    const freshness = await evaluateCheckinNudgeFreshness(row);
    if (!freshness.shouldSend) {
        await Store.notificationQueue.markSkipped(row.id, freshness.reason || 'no-longer-relevant');
        return;
    }

    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const sentToday = await Store.notificationQueue
        .countSentSince(row.brandVariation, row.userId, since)
        .catch(() => 0);

    if (sentToday >= MAX_SENDS_PER_USER_PER_DAY) {
        // Dropped, not deferred. Deferring would just move the same notification
        // into tomorrow's budget and crowd out whatever is timely then — and a
        // reminder that arrives a day late is worse than one that never arrives.
        //
        // Except for the once-ever types, where a drop is permanent and there is
        // no tomorrow's row to crowd anything out — see UNCAPPABLE_TYPES. Those
        // wait for the rolling window to open, and go out over the cap if it
        // never does. `defer` decrements `attempts`, so holding a row this way
        // cannot exhaust MAX_ATTEMPTS.
        const waitedMs = Date.now() - new Date(row.createdAt).getTime();

        if (!UNCAPPABLE_TYPES.has(row.type)) {
            await Store.notificationQueue.markSkipped(row.id, `daily cap reached (${sentToday})`);
            return;
        }

        if (waitedMs < MAX_CAP_DEFERRAL_MS) {
            await Store.notificationQueue.defer(
                row.id,
                new Date(Date.now() + CAP_DEFERRAL_RETRY_MS),
                `daily cap reached (${sentToday}) — deferred, once-ever type`,
            );
            return;
        }
        // Falls through to send over the cap. The spacing rule below has its own
        // six-hour horizon, which a row that has waited this long has already
        // cleared, so it cannot be held a second time on the way out.
    }

    // Un-addressable rows, resolved before anything is built.
    //
    // Second-most-common production error in the first 30 days: 36 × "Exactly
    // one of topic, token or condition is required" — `resolveDeviceTokenForBrand`
    // found nothing and the send was attempted anyway. Now that failures
    // propagate (the send route answers 502), those rows would burn all three
    // attempts every day and settle as 'failed', which buries real failures in
    // noise from users who simply have no device registered for this brand.
    // 'skipped' says the same thing and stays measurable.
    //
    // The legacy `users.deviceMobileFirebaseToken` column is read here too, not
    // just the brand-scoped table: `resolveDeviceTokenForBrand` falls back to it
    // for users whose device has not re-registered since Phase 2, and skipping
    // them would silence real recipients to tidy up a log.
    const [recipient] = await Store.users
        .findUser({ id: row.userId }, ['deviceMobileFirebaseToken'])
        .catch(() => [] as { deviceMobileFirebaseToken: string }[]);
    const deviceToken = await resolveDeviceTokenForBrand(
        row.brandVariation,
        row.userId,
        recipient?.deviceMobileFirebaseToken,
    ).catch(() => null);
    if (!deviceToken) {
        await Store.notificationQueue.markSkipped(row.id, 'no-device-token');
        return;
    }

    // Minimum spacing. Deferred rather than dropped — see
    // MIN_GAP_BETWEEN_SENDS_MS — unless the row has already waited out the
    // deferral horizon, at which point arriving close to something else beats
    // not arriving at all.
    const lastSentAt = await Store.notificationQueue
        .getLastSentAt(row.brandVariation, row.userId)
        .catch(() => null);
    const now = Date.now();
    if (lastSentAt) {
        const msSinceLastSend = now - lastSentAt.getTime();
        const hasWaitedLongEnough = now - new Date(row.createdAt).getTime() >= MAX_DEFERRAL_WINDOW_MS;

        if (msSinceLastSend < MIN_GAP_BETWEEN_SENDS_MS && !hasWaitedLongEnough) {
            const nextAttemptAt = new Date(lastSentAt.getTime() + MIN_GAP_BETWEEN_SENDS_MS);
            await Store.notificationQueue.defer(
                row.id,
                nextAttemptAt,
                `spaced: last send ${Math.round(msSinceLastSend / 1000)}s ago`,
            );
            return;
        }
    }

    const payload = row.payload || {};

    // Synthetic internal headers. This is a background job with no originating
    // request; push-notifications-service is VPC-internal and mounts no
    // authenticate middleware, so there is no token to forward and nothing that
    // would verify one. Kept explicit so it is obvious that the absence of
    // `authorization` here is a fact about the internal network, not an
    // oversight.
    const headers: any = {
        'x-platform': 'mobile',
        'x-brand-variation': row.brandVariation,
        'x-localecode': payload.locale || 'en-us',
        'x-userid': payload.fromUserId || '',
    };

    await sendEmailAndOrPushNotification(
        Store.users.findUser,
        headers,
        {
            // `payload` is spread FIRST so the queue row always wins. It carries
            // whatever a producer chose to store, and `ISendPushNotification`
            // itself declares `toUserId`, `type` and `brandVariation` — so a
            // producer that copies the shape of an existing inline
            // sendEmailAndOrPushNotification call into `payload` is doing the
            // natural thing. Spreading it last let those keys override the row:
            // `toUserId` selects the recipient, and `brandVariation` selects
            // which brand's device token is resolved, so a stale or copied value
            // would send the wrong person a push through the wrong Firebase
            // project — the exact failure the brand scoping on this table exists
            // to prevent. The row is the authority; the payload is decoration.
            ...payload,
            authorization: '',
            locale: payload.locale || 'en-us',
            toUserId: row.userId,
            type: row.type as any,
            whiteLabelOrigin: payload.whiteLabelOrigin || '',
            brandVariation: row.brandVariation,
        },
        {
            // Queue entries are push-only. The retention emails have their own
            // triggers and their own unsubscribe semantics; routing them through
            // here too would double-send.
            shouldSendPushNotification: true,
            shouldSendEmail: false,
            // Unlike the inline callers, this one needs to know. Without it the
            // send failure is logged and swallowed, `markSent` runs anyway, and
            // the row records a delivery that never happened — which also means
            // it is never retried.
            shouldThrowOnError: true,
        },
    );

    await Store.notificationQueue.markSent(row.id);
};

const drainBrand = async (brand: BrandVariations): Promise<number> => {
    // Bounded retry first, so a batch orphaned by a crashed tick becomes
    // eligible again before this tick claims new work.
    await Store.notificationQueue.requeueFailed(brand, MAX_ATTEMPTS, REQUEUE_BATCH_SIZE).catch(() => 0);

    const rows = await Store.notificationQueue.claimDue(brand, CLAIM_BATCH_SIZE);
    if (!rows.length) return 0;

    // Order by what the notification is, not just when it was queued. With
    // minimum spacing in play the first row for a user is the one that goes out
    // now and the rest are deferred, so this decides which of a user's due
    // notifications they actually see tonight. `claimDue` orders by
    // `scheduledFor`, which is identical across a digest run.
    rows.sort(compareBySendPriority);

    // Sequential, not Promise.all: each send fans out to push-notifications-service
    // and the DB, and a burst of 25 concurrent sends from a replicas:1 pod is a
    // good way to exhaust the write pool. Throughput is not the constraint here —
    // a 30s tick with batches of 25 is 3,000/hour/brand, far past current volume.
    // eslint-disable-next-line no-restricted-syntax
    for (const row of rows) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await sendOne(row);
        } catch (err: any) {
            // claimDue already set status='failed' and incremented attempts, so
            // an exception escaping here leaves the row correct for requeue.
            // eslint-disable-next-line no-await-in-loop
            await Store.notificationQueue
                .markFailed(row.id, String(err?.message || err).slice(0, 500))
                .catch(() => undefined);
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Notification queue: send failed'],
                traceArgs: {
                    'error.message': err?.message,
                    'notificationQueue.id': row.id,
                    'notificationQueue.type': row.type,
                    'pushNotification.brandVariation': row.brandVariation,
                    'user.id': row.userId,
                    source: 'users-service',
                },
            });
        }
    }

    return rows.length;
};

/**
 * Drops rows that have outlived their usefulness. Bounded per sweep so a table
 * that has gone untended for a while is worked down over several hours rather
 * than in one long-running DELETE that sits on the write pool.
 *
 * Never touches 'pending' — only terminal states, and only well past the window
 * anything still reads them for.
 */
const sweepRetention = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastRetentionSweepAt < RETENTION_INTERVAL_MS) return;
    lastRetentionSweepAt = now;

    const deletedCompleted = await Store.notificationQueue
        .deleteCompletedBefore(new Date(now - COMPLETED_RETENTION_MS), RETENTION_BATCH_SIZE)
        .catch(() => 0);
    const deletedFailed = await Store.notificationQueue
        .deleteExhaustedFailedBefore(MAX_ATTEMPTS, new Date(now - FAILED_RETENTION_MS), RETENTION_BATCH_SIZE)
        .catch(() => 0);

    if (deletedCompleted || deletedFailed) {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Notification queue: retention sweep'],
            traceArgs: {
                'notificationQueue.deletedCompleted': deletedCompleted,
                'notificationQueue.deletedFailed': deletedFailed,
                source: 'users-service',
            },
        });
    }
};

const resetRetentionThrottleForTests = (): void => {
    lastRetentionSweepAt = 0;
};

const tick = async (): Promise<void> => {
    if (isTicking) return;
    isTicking = true;
    try {
        // Housekeeping first, and self-throttled, so it can never crowd out a
        // send: it no-ops on all but roughly one tick in 120.
        await sweepRetention();

        const brands = Object.values(BrandVariations) as BrandVariations[];
        // eslint-disable-next-line no-restricted-syntax
        for (const brand of brands) {
            // eslint-disable-next-line no-await-in-loop
            await drainBrand(brand).catch((err: any) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Notification queue: brand drain failed'],
                    traceArgs: {
                        'error.message': err?.message,
                        'pushNotification.brandVariation': String(brand),
                        source: 'users-service',
                    },
                });
            });
        }
    } finally {
        isTicking = false;
    }
};

/**
 * Starts the drain loop. Safe to call once, from index.ts after the server is
 * listening. Returns a stop function for the shutdown path.
 *
 * Disabled by default via NOTIFICATION_QUEUE_WORKER_ENABLED so this can deploy
 * dark: the table and the producers can land, be observed filling up, and only
 * then be allowed to send. An always-on worker on first deploy would make the
 * first thing anyone learns about this system a user-visible one.
 */
const startNotificationQueueWorker = (): (() => void) => {
    if (process.env.NOTIFICATION_QUEUE_WORKER_ENABLED !== 'true') {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Notification queue worker disabled (NOTIFICATION_QUEUE_WORKER_ENABLED != true)'],
            traceArgs: { source: 'users-service' },
        });
        return () => undefined;
    }

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Notification queue worker started'],
        traceArgs: {
            'notificationQueue.tickIntervalMs': TICK_INTERVAL_MS,
            'notificationQueue.batchSize': CLAIM_BATCH_SIZE,
            'notificationQueue.maxSendsPerUserPerDay': MAX_SENDS_PER_USER_PER_DAY,
            source: 'users-service',
        },
    });

    timer = setInterval(() => { tick(); }, TICK_INTERVAL_MS);
    // Never hold the event loop open on shutdown.
    timer.unref();

    return () => {
        if (timer) clearInterval(timer);
        timer = undefined;
    };
};

export {
    startNotificationQueueWorker,
    // Exported for tests — lets a single tick be driven deterministically
    // instead of waiting on the interval.
    tick as runNotificationQueueTick,
    // Also test-only. The retention throttle is module state that outlives an
    // individual test, so without a reset the first tick in a process consumes
    // the sweep and every later assertion about it sees a no-op.
    resetRetentionThrottleForTests,
    MAX_SENDS_PER_USER_PER_DAY,
    MAX_ATTEMPTS,
};
