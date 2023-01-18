import printLogs from 'therr-js-utilities/print-logs';
import Redis from 'ioredis';
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

/**
 * Connects and reconnects to Redis with custom exponential backoff
 */
const connectToRedis = (options, callback) => {
    redisClient.disconnect();
    // We must connect manually since lazyConnect is true
    const redisConnectPromises = [redisClient.connect()];

    Promise.all(redisConnectPromises).then((responses: any[]) => {
        clearTimeout(connectionTimerId);
        connectionRetryCount = 0;
        connectionWaitTime = 0;

        // Wait for both pub and sub redis instances to connect before starting Express/Socket.io server
        callback();
    }).catch((e) => {
        console.error(e);
        printLogs({
            level: 'verbose',
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

export default redisClient;
