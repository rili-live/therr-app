import printLogs from 'therr-js-utilities/print-logs';
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';
import beeline from '../beeline';

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

// Redis Error handling
redisClient.on('error', (error: any) => {
    printLogs({
        level: 'error',
        messageOrigin: 'REDIS_CONNECTION_ERROR',
        messages: error.toString(),
        tracer: beeline,
        traceArgs: {},
    });
});

/**
 * Connects and reconnects to Redis with custom exponential backoff
 */
const connectToRedis = (options, callback) => {
    redisClient.disconnect();
    // We must connect manually since lazyConnect is true
    const redisConnectPromises = [
        redisClient.connect()
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
        printLogs({
            level: 'error',
            messageOrigin: 'REDIS_LOG',
            messages: [e.message],
            tracer: options.tracer,
            traceArgs: {},
        });

        if (connectionRetryCount <= maxConnectionRetries) {
            clearTimeout(connectionTimerId);

            connectionTimerId = setTimeout(() => {
                connectionRetryCount += 1;
                connectToRedis(options, callback);

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
connectToRedis({
    tracer: beeline,
}, () => { console.log('Attempting to connect to Redis...'); });

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

export default redisClient;
