import logSpan from 'therr-js-utilities/log-or-update-span';
import Redis from 'ioredis';

const redisClient = new Redis({
    host: process.env.REDIS_GENERIC_HOST,
    port: Number(process.env.REDIS_GENERIC_PORT),
    keyPrefix: 'push-notifications-service:',
});

// Redis Error handling
redisClient.on('error', (error: any) => {
    logSpan({
        level: 'verbose',
        messageOrigin: 'REDIS_CONNECTION_ERROR',
        messages: error.toString(),
        traceArgs: {
            'error.message': error?.message,
            issue: 'redis-connection-error',
        },
    });
});

export default redisClient;
