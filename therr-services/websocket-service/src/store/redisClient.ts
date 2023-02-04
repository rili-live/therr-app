import printLogs from 'therr-js-utilities/print-logs';
import Redis from 'ioredis';
import { LogLevelMap } from 'therr-js-utilities/constants';
import beeline from '../beeline'; // eslint-disable-line import/order

const nodes = [
    {
        host: process.env.REDIS_PUB_HOST,
        port: Number(process.env.REDIS_PUB_PORT),
    },
];

const maxConnectionRetries = 100;
let connectionRetryCount = 0;
let connectionWaitTime = 0;
let connectionTimerId;

// TODO: RSERV-6: Configure redis clusters
// NOTE: Redis cluster only works on Docker for Linux (ie. Ubuntu) using the host network (https://docs.docker.com/network/host/)
// const redisPubCluster = new Redis.Cluster(nodes);
// const redisSubCluster = new Redis.Cluster(nodes);

const redisKeyPrefix = 'websocket-service:';

const redisPub: Redis.Redis = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketPub',
    lazyConnect: true,
    keyPrefix: redisKeyPrefix,
});

// TODO: Use separate publish and subscribe Redis hosts
const redisSub: Redis.Redis = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketSub',
    lazyConnect: true,
    keyPrefix: redisKeyPrefix,
});

/**
 * Connects and reconnects to Redis with custom exponential backoff
 */
export const connectToRedis = (options, callback) => {
    redisPub.disconnect();
    redisSub.disconnect();
    // We must connect manually since lazyConnect is true
    const redisConnectPromises = [redisPub.connect(), redisSub.connect()];

    Promise.all(redisConnectPromises).then((responses: any[]) => {
        console.info(responses);
        clearTimeout(connectionTimerId);
        connectionRetryCount = 0;
        connectionWaitTime = 0;

        // connection ready
        if ((Number(process.env.LOG_LEVEL) || 2) <= LogLevelMap.verbose) {
            redisPub.monitor().then((monitor) => {
                monitor.on('monitor', (time, args, source, database) => {
                    printLogs({
                        time,
                        level: 'verbose',
                        messageOrigin: 'REDIS_PUB_LOG',
                        messages: [`Source: ${source}, Database: ${database}`, ...args],
                        tracer: options.tracer,
                        traceArgs: {},
                    });
                });
            });
        }

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

// Redis Error handling
redisPub.on('error', (error: any) => {
    printLogs({
        level: 'error',
        messageOrigin: 'REDIS_PUB_CLUSTER_CONNECTION_ERROR',
        messages: error.toString(),
        tracer: beeline,
        traceArgs: {},
    });
});

redisSub.on('error', (error: any) => {
    printLogs({
        level: 'error',
        messageOrigin: 'REDIS_SUB_CLUSTER_CONNECTION_ERROR',
        messages: error.toString(),
        tracer: beeline,
        traceArgs: {},
    });
});

redisSub.on('subscribe', (channel: any, count: any) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_SUB_CLIENT',
        messages: `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`,
        tracer: beeline,
        traceArgs: {},
    });
});

redisSub.on('message', (channel: any, message: any) => {
    printLogs({
        level: 'verbose',
        messageOrigin: 'REDIS_SUB_CLIENT',
        messages: `Message from channel ${channel}: ${message}`,
        tracer: beeline,
        traceArgs: {},
    });
});

export {
    redisPub,
    redisSub,
};
