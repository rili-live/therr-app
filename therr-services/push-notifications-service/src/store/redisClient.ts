import printLogs from 'therr-js-utilities/print-logs';
import Redis from 'ioredis';
import beeline from '../beeline';

const redisClient = new Redis({
    host: process.env.REDIS_GENERIC_HOST,
    port: Number(process.env.REDIS_GENERIC_PORT),
});

// Redis Error handling
redisClient.on('error', (error: any) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_CONNECTION_ERROR',
        messages: error.toString(),
        tracer: beeline,
        traceArgs: {},
    });
});

export default redisClient;
