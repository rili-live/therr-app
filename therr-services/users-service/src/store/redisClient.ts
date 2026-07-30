import Redis from 'ioredis';
// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IHandoffEntry } from 'therr-js-utilities/types';

// Re-exported so existing callers (handlers/auth.ts) keep their import surface unchanged.
export type { IHandoffEntry };

// Ephemeral Redis client for short-lived auth artifacts:
//  - cross-app handoff codes (60s TTL)
//
// Reuses the same ephemeral instance used by the gateway for token blacklist / rate-limit work.
// Lazy-connect + indefinite retry so a Redis blip doesn't crash the service on boot.
const redisEphemeralClient = new Redis({
    host: process.env.REDIS_EPHEMERAL_HOST,
    port: Number(process.env.REDIS_EPHEMERAL_PORT),
    keyPrefix: 'users-service:',
    lazyConnect: true,
    retryStrategy(times) {
        return Math.min(times * 50, 5000);
    },
    maxRetriesPerRequest: null,
});

redisEphemeralClient.on('error', (error: any) => {
    logSpan({
        level: 'error',
        messageOrigin: 'REDIS_EPHEMERAL_CONNECTION_ERROR',
        messages: error?.toString?.() || 'unknown redis error',
        traceArgs: {},
    });
});

redisEphemeralClient.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('users-service connected to ephemeral Redis');
});

// Best-effort connect; further commands trigger reconnects per ioredis retryStrategy.
redisEphemeralClient.connect().catch(() => {
    // eslint-disable-next-line no-console
    console.log('users-service: deferred Redis ephemeral connect (will retry on first use)');
});

const HANDOFF_PREFIX = 'handoff:';
const HANDOFF_TTL_SECONDS = 60;

const DISTRIBUTOR_GATE_PREFIX = 'distributor:gate:';

/**
 * Rate-limits the thought distributor to at most one run per user per window.
 *
 * The distributor is triggered from searchNotifications, i.e. on every notifications poll.
 * Each run costs a 3-table interests join, two candidate scans over the recent thought pool
 * with a correlated reply-count subquery, and a cross-service write of up to ~20 reaction
 * rows — so the cost scaled with polling frequency rather than with users or content.
 *
 * Footprint is deliberately tiny: one key per *recently active* user, ~90 bytes including
 * ioredis/Redis overhead, holding only the literal '1', and expiring on its own. At 100k
 * users active within a single window that is under 10 MB, and idle users hold nothing.
 * Nothing here is a cache that has to be warm — losing the whole keyspace only means the
 * next poll per user runs the distributor once more than it needed to.
 *
 * Fails OPEN: if Redis is unreachable the distributor runs, which is exactly the behavior
 * before this gate existed. A Redis outage should not silently stop stream population.
 */
export const tryAcquireDistributorRun = async (userId: string, windowSeconds: number): Promise<boolean> => {
    if (!userId || !windowSeconds || windowSeconds <= 0) {
        return true;
    }

    try {
        // NX makes claim-and-check a single atomic op, so concurrent polls from the same
        // user (multiple devices, or a client retry) can't both win the window.
        const result = await redisEphemeralClient.set(
            `${DISTRIBUTOR_GATE_PREFIX}${userId}`,
            '1',
            'EX',
            windowSeconds,
            'NX',
        );
        return result === 'OK';
    } catch (err) {
        logSpan({
            level: 'warn',
            messageOrigin: 'REDIS_EPHEMERAL_ERROR',
            messages: ['Failed to check thought distributor gate; running ungated', (err as any)?.message],
            traceArgs: {
                'user.id': userId,
            },
        });
        return true;
    }
};

export const mintHandoffCode = async (code: string, entry: IHandoffEntry): Promise<void> => {
    if (!code || !entry?.userId || !entry?.targetBrand) {
        throw new Error('mintHandoffCode requires code, userId, and targetBrand');
    }
    await redisEphemeralClient.set(
        `${HANDOFF_PREFIX}${code}`,
        JSON.stringify(entry),
        'EX',
        HANDOFF_TTL_SECONDS,
    );
};

// Atomic single-use redemption. GETDEL was added to Redis 6.2; we fall back to a MULTI pipeline
// for older servers so the value is always pulled and deleted together.
export const redeemHandoffCode = async (code: string): Promise<IHandoffEntry | null> => {
    if (!code) return null;
    let raw: string | null = null;
    try {
        if (typeof (redisEphemeralClient as any).getdel === 'function') {
            raw = await (redisEphemeralClient as any).getdel(`${HANDOFF_PREFIX}${code}`);
        } else {
            const pipeline = redisEphemeralClient.multi();
            pipeline.get(`${HANDOFF_PREFIX}${code}`);
            pipeline.del(`${HANDOFF_PREFIX}${code}`);
            const results = await pipeline.exec();
            raw = (results?.[0]?.[1] as string) ?? null;
        }
    } catch (err) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to redeem handoff code', (err as any)?.message],
            traceArgs: {},
        });
        return null;
    }
    if (!raw) return null;
    try {
        return JSON.parse(raw) as IHandoffEntry;
    } catch {
        return null;
    }
};

export const cancelHandoffCode = async (code: string): Promise<void> => {
    if (!code) return;
    try {
        await redisEphemeralClient.del(`${HANDOFF_PREFIX}${code}`);
    } catch {
        // Best effort
    }
};

export default redisEphemeralClient;
