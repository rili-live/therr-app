import printLogs from 'rili-public-library/utilities/print-logs.js';
import Redis from 'ioredis';
import beeline from '../beeline'; // eslint-disable-line import/order

const nodes = [
    {
        host: process.env.REDIS_NODE_ONE_HOST,
        port: Number(process.env.REDIS_NODE_ONE_PORT),
    },
];

// TODO: RSERV-6: Configure redis clusters
// NOTE: Redis cluster only works on Docker for Linux (ie. Ubuntu) using the host network (https://docs.docker.com/network/host/)
// const redisPubCluster = new Redis.Cluster(nodes);
// const redisSubCluster = new Redis.Cluster(nodes);

const redisClient: Redis.Redis = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketPub',
    lazyConnect: true,
});

// Redis Error handling
redisClient.on('error', (error: string) => {
    printLogs({
        info: 'verbose',
        messageOrigin: 'REDIS_PUB_CLUSTER_CONNECTION_ERROR',
        messages: error.toString(),
        tracer: beeline,
        traceArgs: {},
    });
});

export default redisClient;
