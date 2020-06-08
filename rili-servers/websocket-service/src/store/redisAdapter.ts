import socketioRedis from 'socket.io-redis';
import printLogs from 'rili-js-utilities/print-logs';
import beeline from '../beeline';
import { redisPub, redisSub } from './redisClient';

const redisAdapter = socketioRedis({
    pubClient: redisPub,
    subClient: redisSub,
});

redisAdapter.pubClient.on('error', (err: string) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_PUB_CLIENT_ERROR',
        messages: err.toString(),
        tracer: beeline,
        traceArgs: {
            uid: redisAdapter.uid,
        },
    });
});
redisAdapter.subClient.on('error', (err: string) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_SUB_CLIENT_ERROR',
        messages: err.toString(),
        tracer: beeline,
        traceArgs: {
            uid: redisAdapter.uid,
        },
    });
});

redisAdapter.subClient.on('subscribe', (channel: any, count: any) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_SUB_CLIENT',
        messages: `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`,
        tracer: beeline,
        traceArgs: {
            uid: redisAdapter.uid,
        },
    });
});

redisAdapter.subClient.on('message', (channel: any, message: any) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_SUB_CLIENT',
        messages: `Message from channel ${channel}: ${message}`,
        tracer: beeline,
        traceArgs: {
            uid: redisAdapter.uid,
        },
    });
});

export default redisAdapter;
