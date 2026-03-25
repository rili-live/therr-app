// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';
import Redis from 'ioredis';

const maxRetryDelay = 1000 * 60 * 2; // 2 minutes

const redisClient = new Redis({
    host: process.env.REDIS_GENERIC_HOST,
    port: Number(process.env.REDIS_GENERIC_PORT),
    keyPrefix: 'push-notifications-service:',
    connectionName: 'pushNotificationsRedis',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times: number) {
        if (times > 100) {
            logSpan({
                level: 'error',
                messageOrigin: 'REDIS_CONNECTION_ERROR',
                messages: 'Max Redis reconnection attempts exceeded',
                traceArgs: {
                    'error.message': 'Max reconnection attempts exceeded',
                    issue: 'redis-max-retries',
                    source: 'push-notifications-service',
                },
            });
            return null; // stop retrying
        }
        return Math.min(times * 200, maxRetryDelay);
    },
});

// Redis Error handling
redisClient.on('error', (error: any) => {
    logSpan({
        level: 'error',
        messageOrigin: 'REDIS_CONNECTION_ERROR',
        messages: error.toString(),
        traceArgs: {
            'error.message': error?.message,
            issue: 'redis-connection-error',
            source: 'push-notifications-service',
        },
    });
});

export default redisClient;
