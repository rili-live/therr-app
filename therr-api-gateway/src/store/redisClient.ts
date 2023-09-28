import printLogs from 'therr-js-utilities/print-logs';
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
const connectToRedis = (client: Redis.Redis, options, callback) => {
    client.disconnect();
    // We must connect manually since lazyConnect is true
    const redisConnectPromises = [
        client.connect()
            .catch((e) => { console.log('Handled error thrown after attempting to connect to Redis'); }),
    ];

    Promise.all(redisConnectPromises).then((responses: any[]) => {
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

export {
    redisEphemeralClient,
};

export default redisClient;
