// import printLogs from 'therr-js-utilities/print-logs';
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';
import logSpan from 'therr-js-utilities/log-or-update-span';

const maxConnectionRetries = 100;
let connectionRetryCount = 0;
let connectionWaitTime = 0;
let connectionTimerId;

const redisClient = new Redis({
    host: process.env.REDIS_GENERIC_HOST,
    port: Number(process.env.REDIS_GENERIC_PORT),
    keyPrefix: 'api-gateway:',
    lazyConnect: true,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 5000);
        return delay;
    },
    /**
     * Redis is a single point of failure because we rely on rate limiting.
     * This config property causes it to retry indefinitely until Redis is back online
     */
    maxRetriesPerRequest: null,
});

const redisEphemeralClient = new Redis({
    host: process.env.REDIS_EPHEMERAL_HOST,
    port: Number(process.env.REDIS_EPHEMERAL_PORT),
    keyPrefix: 'api-gateway:',
    lazyConnect: true,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 5000);
        return delay;
    },
    /**
     * Redis is a single point of failure because we rely on rate limiting.
     * This config property causes it to retry indefinitely until Redis is back online
     */
    maxRetriesPerRequest: null,
});

// Redis Error handling
redisClient.on('error', (error: any) => {
    logSpan({
        level: 'error',
        messageOrigin: 'REDIS_CONNECTION_ERROR',
        messages: error.toString(),
        traceArgs: {},
    });
});
redisEphemeralClient.on('error', (error: any) => {
    logSpan({
        level: 'error',
        messageOrigin: 'REDIS_EPHEMERAL_CONNECTION_ERROR',
        messages: error.toString(),
        traceArgs: {},
    });
});

/**
 * Connects and reconnects to Redis with custom exponential backoff
 */
const connectToRedis = (client: Redis, options, callback) => {
    client.disconnect();
    // We must connect manually since lazyConnect is true
    const redisConnectPromises = [
        client.connect()
            .catch(() => { console.log('Handled error thrown after attempting to connect to Redis'); }),
    ];

    Promise.all(redisConnectPromises).then(() => {
        clearTimeout(connectionTimerId);
        connectionRetryCount = 0;
        connectionWaitTime = 0;

        // Wait for both pub and sub redis instances to connect before starting Express/Socket.io server
        callback();
    }).catch((e) => {
        console.error(e);
        logSpan({
            level: 'error',
            messageOrigin: 'REDIS_LOG',
            messages: [e.message],
            traceArgs: {},
        });

        if (connectionRetryCount <= maxConnectionRetries) {
            clearTimeout(connectionTimerId);

            connectionTimerId = setTimeout(() => {
                connectionRetryCount += 1;
                connectToRedis(client, options, callback);

                if (connectionWaitTime === 0) {
                    connectionWaitTime = 50;
                } else if (connectionWaitTime < 100) {
                    connectionWaitTime *= 4;
                } else if (connectionWaitTime >= (1000 * 60 * 5)) {
                    connectionWaitTime = 1000 * 60 * 5;
                } else {
                    connectionWaitTime *= 5;
                }
            }, connectionWaitTime);
        }
    });
};

// TODO: Consider moving this to the server start. For now, let's fail fast.
connectToRedis(redisClient, {}, () => { console.log('Attempting to connect to Redis...'); });
connectToRedis(redisEphemeralClient, {}, () => { console.log('Attempting to connect to ephemeral Redis...'); });

/**
 * This must be instantiated after the redisClient connects because it also calls connect which causes an error otherwise
 */
export const RateLimiterRedisStore = new RedisStore({
    prefix: 'api-gateway:rl:', // This overrides the default prefix in redisClient
    // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
    sendCommand: (...args: string[]) => redisClient.call(...args),
});

redisClient.on('connect', () => {
    // This fixes a bug where rate-limit-redis fails to load the script it gets unloaded when Redis restarts
    console.log('Connected to Redis');
    RateLimiterRedisStore.loadScript();
});

redisEphemeralClient.on('connect', () => {
    console.log('Connected to ephemeral Redis');
});

// Token blacklist helpers for server-side logout
const TOKEN_BLACKLIST_PREFIX = 'token-blacklist:';

export const blacklistToken = async (jti: string, expiresInSeconds: number): Promise<void> => {
    if (!jti || expiresInSeconds <= 0) return;

    try {
        await redisClient.set(`${TOKEN_BLACKLIST_PREFIX}${jti}`, '1', 'EX', expiresInSeconds);
    } catch (err) {
        console.error('Failed to blacklist token:', err);
    }
};

export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
    if (!jti) return false;

    try {
        const result = await redisClient.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
        return result !== null;
    } catch (err) {
        // Fail open: if Redis is down, don't block authenticated users
        console.error('Failed to check token blacklist:', err);
        return false;
    }
};

// Refresh token store helpers
//
// Key shape evolution (multi-app auth):
//   Legacy (pre-multi-app): refresh-token:<jti>           -> userId
//   Current:                refresh-token:<brand>:<userId>:<jti> -> userId
//
// Both shapes coexist during the transition. Newly minted tokens always use the current shape.
// `scanAndRevokeTokens` matches `refresh-token:*` so both shapes are handled by per-user revoke.
// `revokeRefreshToken` accepts an options object so callers can target either shape directly when
// they have full context.
const REFRESH_TOKEN_PREFIX = 'refresh-token:';
const LEGACY_BRAND_TAG = 'unknown';

const refreshTokenKey = (brand: string | undefined, userId: string | undefined, jti: string) => (
    brand && userId
        ? `${REFRESH_TOKEN_PREFIX}${brand}:${userId}:${jti}`
        : `${REFRESH_TOKEN_PREFIX}${jti}`
);

export const storeRefreshToken = async (
    userId: string,
    jti: string,
    expiresInSeconds: number,
    brand?: string,
): Promise<void> => {
    if (!userId || !jti || expiresInSeconds <= 0) return;

    try {
        await redisClient.set(
            refreshTokenKey(brand || LEGACY_BRAND_TAG, userId, jti),
            userId,
            'EX',
            expiresInSeconds,
        );
    } catch (err) {
        console.error('Failed to store refresh token:', err);
    }
};

export const getRefreshTokenUserId = async (
    jti: string,
    options?: { brand?: string; userId?: string },
): Promise<string | null> => {
    if (!jti) return null;

    try {
        if (options?.brand && options?.userId) {
            return await redisClient.get(refreshTokenKey(options.brand, options.userId, jti));
        }
        return await redisClient.get(refreshTokenKey(undefined, undefined, jti));
    } catch (err) {
        console.error('Failed to get refresh token:', err);
        return null;
    }
};

export const revokeRefreshToken = async (
    jti: string,
    options?: { brand?: string; userId?: string },
): Promise<void> => {
    if (!jti) return;

    try {
        const targetKey = options?.brand && options?.userId
            ? refreshTokenKey(options.brand, options.userId, jti)
            : refreshTokenKey(undefined, undefined, jti);
        await redisClient.del(targetKey);
    } catch (err) {
        console.error('Failed to revoke refresh token:', err);
    }
};

const scanAndRevokeTokens = (
    userId: string,
    keyPrefix: string,
    cursor: string,
    matchPattern: string,
): Promise<void> => redisClient
    .scan(cursor, 'MATCH', matchPattern, 'COUNT', '100')
    .then(([nextCursor, keys]) => {
        if (!keys.length) {
            return nextCursor !== '0' ? scanAndRevokeTokens(userId, keyPrefix, nextCursor, matchPattern) : undefined;
        }

        // Strip the ioredis keyPrefix so pipeline commands re-add it correctly
        const strippedKeys = keys.map((key) => key.replace(keyPrefix, ''));
        const getPipeline = redisClient.pipeline();
        strippedKeys.forEach((key) => getPipeline.get(key));

        return getPipeline.exec().then((results) => {
            const delPipeline = redisClient.pipeline();
            strippedKeys.forEach((key, i) => {
                if (results && results[i] && results[i][1] === userId) {
                    delPipeline.del(key);
                }
            });
            return delPipeline.exec();
        }).then(() => (nextCursor !== '0' ? scanAndRevokeTokens(userId, keyPrefix, nextCursor, matchPattern) : undefined));
    });

export const revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
    if (!userId) return;

    const KEY_PREFIX = 'api-gateway:';

    try {
        // Match both shapes so legacy and current keys are revoked together.
        await scanAndRevokeTokens(userId, KEY_PREFIX, '0', `${KEY_PREFIX}${REFRESH_TOKEN_PREFIX}*`);
    } catch (err) {
        console.error('Failed to revoke all user refresh tokens:', err);
    }
};

// Per-brand refresh-token revocation. Used by the default logout path so that signing out of one
// app (e.g. Habits) leaves sister-app sessions (e.g. Therr) untouched. Legacy refresh-token keys
// (no brand in the key) are revoked when called with brand === LEGACY_BRAND_TAG.
export const revokeUserBrandRefreshTokens = async (userId: string, brand: string): Promise<void> => {
    if (!userId || !brand) return;

    const KEY_PREFIX = 'api-gateway:';

    try {
        const matchPattern = `${KEY_PREFIX}${REFRESH_TOKEN_PREFIX}${brand}:${userId}:*`;
        await scanAndRevokeTokens(userId, KEY_PREFIX, '0', matchPattern);
    } catch (err) {
        console.error('Failed to revoke user/brand refresh tokens:', err);
    }
};

// API key cache helpers (short TTL for fast auth without DB hit on every request)
const API_KEY_CACHE_PREFIX = 'api-key-cache:';
const API_KEY_CACHE_TTL = 300; // 5 minutes

export interface ICachedApiKeyContext {
    userId: string;
    userName: string;
    accessLevels: string[];
    organizations: { [key: string]: string[] };
    keyPrefix: string;
}

export const cacheApiKeyContext = async (keyPrefix: string, context: ICachedApiKeyContext): Promise<void> => {
    try {
        await redisClient.set(
            `${API_KEY_CACHE_PREFIX}${keyPrefix}`,
            JSON.stringify(context),
            'EX',
            API_KEY_CACHE_TTL,
        );
    } catch (err) {
        console.error('Failed to cache API key context:', err);
    }
};

export const getCachedApiKeyContext = async (keyPrefix: string): Promise<ICachedApiKeyContext | null> => {
    try {
        const result = await redisClient.get(`${API_KEY_CACHE_PREFIX}${keyPrefix}`);
        if (result) {
            return JSON.parse(result);
        }
        return null;
    } catch (err) {
        // Fail open: if Redis is down, fall through to DB validation
        console.error('Failed to get cached API key context:', err);
        return null;
    }
};

export const invalidateApiKeyCache = async (keyPrefix: string): Promise<void> => {
    try {
        await redisClient.del(`${API_KEY_CACHE_PREFIX}${keyPrefix}`);
    } catch (err) {
        console.error('Failed to invalidate API key cache:', err);
    }
};

export {
    redisEphemeralClient,
};

export default redisClient;
