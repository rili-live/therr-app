import logSpan from 'therr-js-utilities/log-or-update-span';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

// Interest engagement used to be one internal REST call — and one subquery-joined UPDATE in
// users-service — per content view. Views are the highest-volume event in the system, so
// preference writes scaled with impressions rather than with users, and row-level lock
// contention on main."userInterests" scaled with them too.
//
// Increments are now coalesced in-process per user and flushed on a short interval. A user
// scrolling twenty moments produces one request with merged interest counts instead of
// twenty requests.
//
// The buffer is deliberately in-memory rather than in Redis: engagement counts are
// best-effort telemetry, and a per-replica buffer needs no shared infrastructure and no
// additional Redis memory. The trade-off is that increments still buffered when a pod is
// killed are lost. That is acceptable for a counter whose call sites were already
// fire-and-forget, and a SIGTERM flush covers the common (graceful) case.
//
// NOTE: this file is intentionally identical to the reactions-service copy of the same
// name. Keep the two in sync.

const FLUSH_INTERVAL_MS = Number(process.env.INTEREST_ENGAGEMENT_FLUSH_INTERVAL_MS) || 10000;
// Backstop against unbounded growth if the flush target is unreachable for a long time.
const MAX_BUFFERED_USERS = Number(process.env.INTEREST_ENGAGEMENT_MAX_BUFFERED_USERS) || 1000;
const MAX_EVENT_INCREMENT = 5;

interface IBufferedEngagement {
    headers: InternalConfigHeaders;
    incrementsByKey: { [interestKey: string]: number };
}

// Keyed by userId — the flush endpoint derives the user from request headers, so one
// request per user is the smallest unit we can batch into.
const buffer = new Map<string, IBufferedEngagement>();
let flushTimer: NodeJS.Timeout | null = null;

const reportFlushFailure = (userId: string, entry: IBufferedEngagement, err: any) => {
    // Previously a bare console.log, which meant a fully broken preference-learning loop
    // would raise no alert anywhere.
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Failed to flush interest engagement', err?.message],
        traceArgs: {
            'user.id': userId,
            issue: 'interest engagement increments dropped',
            'interest.keyCount': Object.keys(entry.incrementsByKey).length,
        },
    });
};

// Never rejects, and never throws synchronously: flushes are driven by a background timer,
// so an escaping error would surface as an unhandled rejection rather than a failed request.
const flushUser = (userId: string, entry: IBufferedEngagement) => {
    try {
        return internalRestRequest({
            headers: entry.headers,
        }, {
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/interests/increment`,
            data: {
                interestIncrements: entry.incrementsByKey,
                // Legacy shape, sent alongside the new one so that during a rolling deploy an
                // older users-service pod still records something sensible rather than nothing.
                interestDisplayNameKeys: Object.keys(entry.incrementsByKey),
                incrBy: Math.min(MAX_EVENT_INCREMENT, Math.max(...Object.values(entry.incrementsByKey))),
            },
        }).catch((err) => reportFlushFailure(userId, entry, err));
    } catch (err) {
        reportFlushFailure(userId, entry, err);
        return Promise.resolve();
    }
};

const flushInterestEngagement = () => {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    if (!buffer.size) {
        return Promise.resolve([]);
    }

    // Swap the buffer out before awaiting so increments arriving during the flush
    // accumulate into the next window instead of being dropped.
    const draining = Array.from(buffer.entries());
    buffer.clear();

    return Promise.all(draining.map(([userId, entry]) => flushUser(userId, entry)));
};

const scheduleFlush = () => {
    if (flushTimer) {
        return;
    }
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushInterestEngagement();
    }, FLUSH_INTERVAL_MS);
    // Don't hold the event loop open purely for a pending flush.
    flushTimer.unref?.();
};

const incrementInterestEngagement = (interestsKeys: string[], incrBy: number, headers: InternalConfigHeaders) => {
    if (!interestsKeys?.length) {
        return Promise.resolve({});
    }

    const userId = (headers as any)?.['x-userid'];
    if (!userId) {
        return Promise.resolve({});
    }

    const amount = Math.min(MAX_EVENT_INCREMENT, Math.max(1, Math.floor(Number(incrBy) || 1)));
    const existing = buffer.get(userId);
    // Headers are refreshed on every event so the flush carries the most recent auth token
    // rather than one captured at the start of the window.
    const entry: IBufferedEngagement = existing || { headers, incrementsByKey: {} };
    entry.headers = headers;

    interestsKeys.forEach((key) => {
        if (!key) {
            return;
        }
        entry.incrementsByKey[key] = (entry.incrementsByKey[key] || 0) + amount;
    });

    buffer.set(userId, entry);

    if (buffer.size >= MAX_BUFFERED_USERS) {
        return flushInterestEngagement().then(() => ({}));
    }

    scheduleFlush();

    return Promise.resolve({});
};

// Best-effort drain on graceful shutdown (k8s pod eviction). Deliberately does not call
// process.exit — the store's own SIGTERM handler owns pool draining and exit.
process.on('SIGTERM', () => {
    flushInterestEngagement();
});

export { flushInterestEngagement };

export default incrementInterestEngagement;
