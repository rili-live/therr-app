import { BrandVariations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { INotificationQueueRow } from '../store/NotificationQueueStore';
import sendEmailAndOrPushNotification from './sendEmailAndOrPushNotification';

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

let timer: NodeJS.Timeout | undefined;
let isTicking = false;

const sendOne = async (row: INotificationQueueRow): Promise<void> => {
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const sentToday = await Store.notificationQueue
        .countSentSince(row.brandVariation, row.userId, since)
        .catch(() => 0);

    if (sentToday >= MAX_SENDS_PER_USER_PER_DAY) {
        // Dropped, not deferred. Deferring would just move the same notification
        // into tomorrow's budget and crowd out whatever is timely then — and a
        // reminder that arrives a day late is worse than one that never arrives.
        await Store.notificationQueue.markSkipped(row.id, `daily cap reached (${sentToday})`);
        return;
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
        // Queue entries are push-only. The retention emails have their own
        // triggers and their own unsubscribe semantics; routing them through
        // here too would double-send.
        { shouldSendPushNotification: true, shouldSendEmail: false },
    );

    await Store.notificationQueue.markSent(row.id);
};

const drainBrand = async (brand: BrandVariations): Promise<number> => {
    // Bounded retry first, so a batch orphaned by a crashed tick becomes
    // eligible again before this tick claims new work.
    await Store.notificationQueue.requeueFailed(brand, MAX_ATTEMPTS, REQUEUE_BATCH_SIZE).catch(() => 0);

    const rows = await Store.notificationQueue.claimDue(brand, CLAIM_BATCH_SIZE);
    if (!rows.length) return 0;

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

const tick = async (): Promise<void> => {
    if (isTicking) return;
    isTicking = true;
    try {
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
    MAX_SENDS_PER_USER_PER_DAY,
    MAX_ATTEMPTS,
};
